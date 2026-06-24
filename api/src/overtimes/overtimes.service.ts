import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { UserRepository } from '../auth/repositories/user.repository';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOvertimeRequestDto } from './dto/create-overtime-request.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { QueryOvertimeDto } from './dto/query-overtime.dto';
import { QueryPaymentDto } from './dto/query-payment.dto';
import { OvertimeRepository } from './repositories/overtime.repository';

@Injectable()
export class OvertimesService {
  constructor(
    private readonly overtimeRepo: OvertimeRepository,
    private readonly userRepo: UserRepository,
    private readonly notificationsService: NotificationsService,
    private readonly db: DatabaseService,
  ) {}

  async create(managerId: number, dto: CreateOvertimeRequestDto) {
    const workcenterRows = await this.userRepo.findWorkcentersByUserId(managerId);
    if (workcenterRows.length === 0) throw new BadRequestException('El manager no tiene workcenter asignado');

    const workcenterId = workcenterRows[0].workcenter_id;
    const companyId = workcenterRows[0].company_id;

    const employeeUuids = dto.items.map((i) => i.employeeUuid);
    const foundUsers = await this.userRepo.findIdsByUuids(employeeUuids);

    if (foundUsers.length !== employeeUuids.length) {
      throw new NotFoundException('Uno o más empleados no existen');
    }

    const employeeIds = foundUsers.map((u) => u.id);
    const workcenterMembers = await this.userRepo.findUsersInWorkcenter([workcenterId]);
    const memberIds = new Set(workcenterMembers.map((m) => m.user_id));

    const outsider = employeeIds.find((id) => !memberIds.has(id));
    if (outsider) throw new ForbiddenException('Uno o más empleados no pertenecen a tu workcenter');

    const uuidMap = new Map(foundUsers.map((u) => [u.uuid, u.id]));
    const uuid = crypto.randomUUID();

    await this.db.transaction(async (q) => {
      const requestId = await this.overtimeRepo.createRequest(
        { uuid, workcenterId, requestedBy: managerId, date: dto.date, reason: dto.reason },
        q,
      );
      const items = dto.items.map((i) => ({ requestId, employeeId: uuidMap.get(i.employeeUuid)!, hours: i.hours }));
      await this.overtimeRepo.createItems(items, q);
    });

    const owners = await this.userRepo.findOwnersByCompanyId(companyId);
    await Promise.all(
      owners.map((o) =>
        this.notificationsService.notify(
          o.id,
          'Nueva solicitud de horas extras',
          `Se ha solicitado aprobación de horas extras para ${dto.items.length} empleado(s) el ${dto.date}.`,
        ),
      ),
    );

    return { uuid };
  }

  private groupOvertimeRows(rows: any[]): any[] {
    const map = new Map<string, any>();
    for (const row of rows) {
      if (!map.has(row.uuid)) {
        map.set(row.uuid, {
          uuid: row.uuid,
          date: row.date,
          reason: row.reason,
          status: row.status,
          created_at: row.created_at,
          approved_at: row.approved_at,
          workcenter_name: row.workcenter_name,
          manager_first_name: row.manager_first_name,
          manager_last_name: row.manager_last_name,
          employees: [],
        });
      }
      if (row.employee_uuid) {
        map.get(row.uuid).employees.push({
          uuid: row.employee_uuid,
          first_name: row.employee_first_name,
          last_name: row.employee_last_name,
          dni: row.employee_dni,
          hours: row.hours,
        });
      }
    }
    return Array.from(map.values());
  }

  async findAll(userId: number, role: string, query: QueryOvertimeDto) {
    if (role === 'Owner') {
      const companyId = await this.userRepo.findCompanyIdByUserId(userId);
      if (!companyId) throw new NotFoundException('Empresa no encontrada');
      const rows = await this.overtimeRepo.findAll({ companyId, ...query });
      return this.groupOvertimeRows(rows);
    }

    const workcenterRows = await this.userRepo.findWorkcentersByUserId(userId);
    if (workcenterRows.length === 0) return [];
    const { workcenterIdFilter: _w, ...managerQuery } = query;
    const rows = await this.overtimeRepo.findAll({ workcenterId: workcenterRows[0].workcenter_id, ...managerQuery });
    return this.groupOvertimeRows(rows);
  }

  async findApprovedDetail(userId: number, role: string, query: { month?: number; year?: number }) {
    if (role === 'Owner') {
      const companyId = await this.userRepo.findCompanyIdByUserId(userId);
      if (!companyId) throw new NotFoundException('Empresa no encontrada');
      return this.overtimeRepo.findApprovedDetail({ companyId, ...query });
    }

    const workcenterRows = await this.userRepo.findWorkcentersByUserId(userId);
    if (workcenterRows.length === 0) return [];
    const workcenterIds = workcenterRows.map((w) => w.workcenter_id);
    return this.overtimeRepo.findApprovedDetail({ workcenterIds, ...query });
  }

  async approve(uuid: string, ownerId: number) {
    const companyId = await this.userRepo.findCompanyIdByUserId(ownerId);
    const request = await this.overtimeRepo.findByUuid(uuid);

    if (!request) throw new NotFoundException('Solicitud no encontrada');
    if (request.company_id !== companyId) throw new ForbiddenException('No tienes acceso a esta solicitud');
    if (request.status !== 'pending') throw new BadRequestException('La solicitud ya fue procesada');

    const items = await this.overtimeRepo.getItems(request.id);
    const requestDate = new Date(request.date);
    const year = requestDate.getFullYear();
    const month = requestDate.getMonth() + 1;

    await this.db.transaction(async (q) => {
      await this.overtimeRepo.approve(request.id, ownerId, q);
      for (const item of items) {
        await this.overtimeRepo.upsertAccumulation(item.employee_id, year, month, item.hours, q);
      }
    });

    await this.notificationsService.notify(
      request.requested_by,
      'Horas extras aprobadas',
      `Tu solicitud de horas extras del ${request.date} ha sido aprobada.`,
    );
  }

  async reject(uuid: string, ownerId: number) {
    const companyId = await this.userRepo.findCompanyIdByUserId(ownerId);
    const request = await this.overtimeRepo.findByUuid(uuid);

    if (!request) throw new NotFoundException('Solicitud no encontrada');
    if (request.company_id !== companyId) throw new ForbiddenException('No tienes acceso a esta solicitud');
    if (request.status !== 'pending') throw new BadRequestException('La solicitud ya fue procesada');

    await this.overtimeRepo.reject(request.id, ownerId);

    await this.notificationsService.notify(
      request.requested_by,
      'Horas extras rechazadas',
      `Tu solicitud de horas extras del ${request.date} ha sido rechazada.`,
    );
  }

  async registerPayment(ownerId: number, dto: CreatePaymentDto) {
    const companyId = await this.userRepo.findCompanyIdByUserId(ownerId);
    if (!companyId) throw new NotFoundException('Empresa no encontrada');

    const found = await this.userRepo.findIdsByUuids([dto.employeeUuid]);
    if (found.length === 0) throw new NotFoundException('Empleado no encontrado');
    const employeeId = found[0].id;

    const accumulation = await this.overtimeRepo.findAccumulationByEmployeeMonth(employeeId, dto.year, dto.month);
    if (!accumulation) throw new NotFoundException('No hay horas acumuladas para ese empleado en ese mes');
    if (accumulation.company_id !== companyId) throw new ForbiddenException('El empleado no pertenece a tu empresa');

    const alreadyPaid = await this.overtimeRepo.sumPayments(accumulation.id);
    const total = Number(accumulation.total_hours);
    if (alreadyPaid + dto.hours > total) {
      throw new BadRequestException(`Sobre-pago: se deben ${total}h y ya hay ${alreadyPaid}h saldadas`);
    }

    const id = await this.overtimeRepo.createPayment({
      accumulationId: accumulation.id,
      hours: dto.hours,
      method: dto.method,
      comment: dto.comment,
      paidBy: ownerId,
    });
    return { id };
  }

  async findPayments(ownerId: number, query: QueryPaymentDto) {
    const companyId = await this.userRepo.findCompanyIdByUserId(ownerId);
    if (!companyId) throw new NotFoundException('Empresa no encontrada');

    const found = await this.userRepo.findIdsByUuids([query.employeeUuid]);
    if (found.length === 0) throw new NotFoundException('Empleado no encontrado');
    const employeeId = found[0].id;

    const accumulation = await this.overtimeRepo.findAccumulationByEmployeeMonth(employeeId, query.year, query.month);
    if (!accumulation) return [];
    if (accumulation.company_id !== companyId) throw new ForbiddenException('El empleado no pertenece a tu empresa');

    return this.overtimeRepo.findPaymentsByAccumulation(accumulation.id);
  }

  async findAccumulation(userId: number, role: string, query: { month?: number; year?: number }) {
    if (role === 'Owner') {
      const companyId = await this.userRepo.findCompanyIdByUserId(userId);
      if (!companyId) throw new NotFoundException('Empresa no encontrada');
      return this.overtimeRepo.findAccumulation({ companyId, ...query });
    }

    const workcenterRows = await this.userRepo.findWorkcentersByUserId(userId);
    if (workcenterRows.length === 0) return [];
    const workcenterIds = workcenterRows.map((w) => w.workcenter_id);
    return this.overtimeRepo.findAccumulation({ workcenterIds, ...query });
  }
}
