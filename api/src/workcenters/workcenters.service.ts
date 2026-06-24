import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { AuditService } from '../audit/audit.service';
import { UserRepository } from '../auth/repositories/user.repository';
import { CompanyRepository } from '../companies/repositories/company.repository';
import { DatabaseService } from '../database/database.service';
import { CreateWorkcenterDto } from './dto/create-workcenter.dto';
import { UpdateWorkcenterDto } from './dto/update-workcenter.dto';
import { WorkcenterRepository } from './repositories/workcenter.repository';

@Injectable()
export class WorkcentersService {
  constructor(
    private readonly companyRepo: CompanyRepository,
    private readonly workcenterRepo: WorkcenterRepository,
    private readonly userRepo: UserRepository,
    private readonly db: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async findAll(filters: { name?: string; page: number; limit: number }) {
    const { data, total } = await this.workcenterRepo.findAll(filters);
    return { data, total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(total / filters.limit) };
  }

  async findMine(userId: number, filters: { name?: string; page: number; limit: number }) {
    const companyId = await this.userRepo.findCompanyIdByUserId(userId);
    if (!companyId) throw new NotFoundException('Empresa no encontrada');
    const { data, total } = await this.workcenterRepo.findAllByCompany(companyId, filters);
    return { data, total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(total / filters.limit) };
  }

  async create(dto: CreateWorkcenterDto, actorId: number, ip: string, source: 'web' | 'app') {
    const company = await this.companyRepo.findByUuid(dto.companyUuid);
    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }

    const uuid = crypto.randomUUID();
    const id = await this.workcenterRepo.create({
      uuid,
      name: dto.name,
      address: dto.address,
      email: dto.email,
      companyId: company.id,
    });

    const result = {
      id,
      uuid,
      name: dto.name,
      address: dto.address,
      email: dto.email,
      companyId: company.id,
      active: true,
    };

    await this.auditService.log({
      actorId,
      entityType: 'workcenter',
      entityId: id,
      action: 'create',
      source,
      ip,
      after: result,
      status: 'success',
    });

    return result;
  }

  async update(uuid: string, dto: UpdateWorkcenterDto, actorId: number, ip: string, source: 'web' | 'app') {
    const workcenter = await this.workcenterRepo.findFullByUuid(uuid);
    if (!workcenter) throw new NotFoundException('Centro de trabajo no encontrado');

    if (dto.email && await this.workcenterRepo.existsByEmailExcluding(dto.email, workcenter.id)) {
      throw new ConflictException('El email ya está en uso por otro centro de trabajo');
    }

    await this.workcenterRepo.update(workcenter.id, dto);

    await this.auditService.log({
      actorId,
      entityType: 'workcenter',
      entityId: workcenter.id,
      action: 'update',
      source,
      ip,
      before: workcenter,
      after: { ...workcenter, ...dto },
      status: 'success',
    });

    return { ...workcenter, ...dto };
  }

  async hardDelete(uuid: string, actorId: number, ip: string, source: 'web' | 'app') {
    const workcenter = await this.workcenterRepo.findFullByUuid(uuid);
    if (!workcenter) throw new NotFoundException('Centro de trabajo no encontrado');

    await this.db.transaction(async (q) => {
      await this.workcenterRepo.deleteUserAssignments(workcenter.id, q);
      await this.workcenterRepo.delete(workcenter.id, q);
    });

    await this.auditService.log({
      actorId,
      entityType: 'workcenter',
      entityId: workcenter.id,
      action: 'delete',
      source,
      ip,
      before: workcenter,
      status: 'success',
    });
  }
}
