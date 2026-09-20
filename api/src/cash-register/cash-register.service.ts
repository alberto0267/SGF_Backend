import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository } from '../auth/repositories/user.repository';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkcenterRepository } from '../workcenters/repositories/workcenter.repository';
import { CierreCaja } from './domain/cierre-caja';
import { CreateCierreDto } from './dto/create-cierre.dto';
import { EditCierreDto } from './dto/edit-cierre.dto';
import { QueryClosuresDto } from './dto/query-closures.dto';
import { QueryDaySummaryDto } from './dto/query-day-summary.dto';
import { QueryMisCierresDto } from './dto/query-mis-cierres.dto';
import { QueryMesDto } from './dto/query-mes.dto';
import { CierreCajaRepository } from './repositories/cierre-caja.repository';

const MINUTOS_EDICION_EMPLEADO = 30;

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

function mapTotales(r: any) {
  return {
    efectivo: Number(r.efectivo),
    nRet: Number(r.n_ret),
    datafono: Number(r.datafono),
    cTarjeta: Number(r.c_tarjeta),
    difArqueoEf: Number(r.dif_arqueo_ef),
    difDatafono: Number(r.dif_datafono),
    difTotal: Number(r.dif_total),
    retiradas: Number(r.retiradas),
    tVentas: Number(r.t_ventas),
    tEfectivo: Number(r.t_efectivo),
  };
}

@Injectable()
export class CashRegisterService {
  constructor(
    private readonly repo: CierreCajaRepository,
    private readonly userRepo: UserRepository,
    private readonly workcenterRepo: WorkcenterRepository,
    private readonly notifications: NotificationsService,
    private readonly db: DatabaseService,
  ) {}

  async crear(employeeId: number, dto: CreateCierreDto) {
    const wcs = await this.userRepo.findWorkcentersByUserId(employeeId);
    if (wcs.length === 0) throw new BadRequestException('No tienes centro de trabajo asignado');
    const workcenterId = wcs[0].workcenter_id;
    const companyId = wcs[0].company_id;

    const retiradaValor = await this.repo.getRetiradaValor(companyId);
    const cierre = CierreCaja.crear(
      {
        workcenterId,
        employeeId,
        date: dto.date,
        efectivo: dto.efectivo,
        nRet: dto.nRet,
        datafono: dto.datafono,
        cTarjeta: dto.cTarjeta,
        difArqueoEf: dto.difArqueoEf,
      },
      retiradaValor,
    );

    try {
      await this.repo.crear(cierre);
    } catch (e: any) {
      if (e?.code === '23505') throw new ConflictException('Ya existe un cierre tuyo para esa fecha');
      throw e;
    }

    await this.notificarOwners(
      companyId,
      `Nuevo cierre de caja (${dto.date}): ventas ${cierre.tVentas}€, descuadre ${cierre.difTotal}€.`,
    );

    return { uuid: cierre.uuid };
  }

  async editar(editorId: number, editorRole: string, uuid: string, dto: EditCierreDto) {
    const found = await this.repo.buscarPorUuid(uuid);
    if (!found) throw new NotFoundException('Cierre no encontrado');

    const editaLoSuyo = editorId === found.cierre.employeeId;

    if (editorRole === 'Owner') {
      const empresaEditor = await this.userRepo.findCompanyIdByUserId(editorId);
      if (empresaEditor === null || empresaEditor !== found.companyId) {
        throw new ForbiddenException('No tienes acceso a este cierre');
      }
    } else if (editorRole === 'Manager') {
      const workcenterRows = await this.userRepo.findWorkcentersByUserId(editorId);
      const workcenterIds = workcenterRows.map((w) => w.workcenter_id);
      if (!workcenterIds.includes(found.cierre.workcenterId)) {
        throw new ForbiddenException('No tienes acceso a este cierre');
      }
    } else {
      if (!editaLoSuyo) throw new ForbiddenException('Solo puedes editar tus propios cierres');
      const minutos = (Date.now() - found.createdAt.getTime()) / 60000;
      if (minutos > MINUTOS_EDICION_EMPLEADO) {
        throw new BadRequestException(`Solo puedes editar tu cierre hasta ${MINUTOS_EDICION_EMPLEADO} minutos después de crearlo`);
      }
    }

    found.cierre.editarValores({
      efectivo: dto.efectivo,
      nRet: dto.nRet,
      datafono: dto.datafono,
      cTarjeta: dto.cTarjeta,
      difArqueoEf: dto.difArqueoEf,
    });

    await this.db.transaction(async (q) => {
      await this.repo.actualizar(found.cierre, found.id, q);
      await this.repo.registrarEdicion(found.id, editorId, dto.comentario, q);
    });

    if (editaLoSuyo) {
      await this.notificarOwners(found.companyId, `Cierre editado (${found.cierre.date}): ${dto.comentario}`);
    } else {
      await this.notifications.notify(
        found.cierre.employeeId,
        'Cierre editado',
        `Tu cierre del ${found.cierre.date} fue editado: ${dto.comentario}`,
      );
    }
  }

  async listar(userId: number, role: string, query: QueryClosuresDto) {
    const scope: { companyId?: number; workcenterIds?: number[] } = {};

    if (role === 'Owner') {
      const companyId = await this.userRepo.findCompanyIdByUserId(userId);
      if (!companyId) throw new NotFoundException('Empresa no encontrada');
      scope.companyId = companyId;
    } else {
      const workcenterRows = await this.userRepo.findWorkcentersByUserId(userId);
      const workcenterIds = workcenterRows.map((w) => w.workcenter_id);
      if (workcenterIds.length === 0) return { data: [], page: 1, limit: 3, total: 0, totalPages: 0 };
      scope.workcenterIds = workcenterIds;
    }

    let workcenterId: number | undefined;
    if (query.workcenterUuid) {
      const wc = await this.workcenterRepo.findByUuid(query.workcenterUuid);
      if (!wc) throw new NotFoundException('Centro de trabajo no encontrado');
      if (scope.companyId !== undefined && wc.company_id !== scope.companyId) {
        throw new NotFoundException('Centro de trabajo no encontrado');
      }
      if (scope.workcenterIds && !scope.workcenterIds.includes(wc.id)) {
        throw new NotFoundException('Centro de trabajo no encontrado');
      }
      workcenterId = wc.id;
    }

    let employeeId: number | undefined;
    if (query.employeeUuid) {
      const found = await this.userRepo.findIdsByUuids([query.employeeUuid]);
      if (found.length === 0) throw new NotFoundException('Empleado no encontrado');
      employeeId = found[0].id;
    }

    const filters = { ...scope, workcenterId, employeeId, year: query.year, month: query.month };

    const page = query.page ?? 1;
    const limit = query.limit ?? 3;
    const total = await this.repo.contarDiasConCierres(filters);
    const fechas = await this.repo.listarFechasPagina(filters, (page - 1) * limit, limit);
    const rows = await this.repo.listarPorFechas(filters, fechas);

    return {
      data: this.agruparPorDia(rows),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  async misCierres(employeeId: number, query: QueryMisCierresDto) {
    const rows = await this.repo.listarPropios(employeeId, query.from, query.to);
    return rows.map((r) => ({
      uuid: r.uuid,
      fecha: r.date,
      workcenter: r.workcenter_name,
      ...mapTotales(r),
    }));
  }

  async resumen(ownerId: number, query: QueryMesDto) {
    const companyId = await this.userRepo.findCompanyIdByUserId(ownerId);
    if (!companyId) throw new NotFoundException('Empresa no encontrada');

    const rows = await this.repo.resumenMes(companyId, query.year, query.month);
    const empleados = rows.map((r) => ({
      employeeUuid: r.employee_uuid,
      nombre: r.nombre,
      ...mapTotales(r),
    }));

    const campos = ['efectivo', 'nRet', 'datafono', 'cTarjeta', 'difArqueoEf', 'difDatafono', 'difTotal', 'retiradas', 'tVentas', 'tEfectivo'] as const;
    const totalGeneral: any = {};
    for (const campo of campos) {
      totalGeneral[campo] = redondear(empleados.reduce((s, e) => s + (e as any)[campo], 0));
    }

    return { empleados, totalGeneral };
  }

  async daySummary(ownerId: number, query: QueryDaySummaryDto) {
    const companyId = await this.userRepo.findCompanyIdByUserId(ownerId);
    if (!companyId) throw new NotFoundException('Empresa no encontrada');

    let workcenterId: number | undefined;
    if (query.workcenterUuid) {
      const wc = await this.workcenterRepo.findByUuid(query.workcenterUuid);
      if (!wc || wc.company_id !== companyId) throw new NotFoundException('Centro de trabajo no encontrado');
      workcenterId = wc.id;
    }

    const totales = await this.repo.daySummary(query.date, companyId, workcenterId);
    return { fecha: query.date, ...mapTotales(totales) };
  }

  async cambiarResumenHora(ownerId: number, workcenterUuid: string, hora: string) {
    const companyId = await this.userRepo.findCompanyIdByUserId(ownerId);
    if (!companyId) throw new NotFoundException('Empresa no encontrada');

    const wc = await this.workcenterRepo.findByUuid(workcenterUuid);
    if (!wc || wc.company_id !== companyId) throw new NotFoundException('Centro de trabajo no encontrado');

    await this.repo.setResumenHora(wc.id, hora);
  }

  async cambiarRetiradaValor(ownerId: number, valor: number) {
    const companyId = await this.userRepo.findCompanyIdByUserId(ownerId);
    if (!companyId) throw new NotFoundException('Empresa no encontrada');
    await this.repo.setRetiradaValor(companyId, valor);
  }

  async enviarResumenesProgramados(horaActual: string): Promise<void> {
    const workcenters = await this.repo.findWorkcentersParaResumen(horaActual);
    const hoy = new Date().toISOString().slice(0, 10);

    for (const wc of workcenters) {
      const totales = await this.repo.daySummary(hoy, undefined, wc.id);
      const t = mapTotales(totales);
      await this.notifications.notify(
        wc.owner_id,
        `Resumen de caja — ${wc.name}`,
        `Ventas ${t.tVentas}€, efectivo ${t.tEfectivo}€, descuadre ${t.difTotal}€.`,
      );
      await this.repo.marcarResumenEnviado(wc.id);
    }
  }

  private async notificarOwners(companyId: number, mensaje: string): Promise<void> {
    const owners = await this.userRepo.findOwnersByCompanyId(companyId);
    await Promise.all(owners.map((o) => this.notifications.notify(o.id, 'Cierre de caja', mensaje)));
  }

  private agruparPorDia(rows: any[]): any[] {
    const num = (v: any) => Number(v);
    const map = new Map<string, any>();

    for (const r of rows) {
      if (!map.has(r.date)) {
        map.set(r.date, {
          fecha: r.date,
          cierres: [],
          totales: { efectivo: 0, datafono: 0, cTarjeta: 0, difArqueoEf: 0, difDatafono: 0, difTotal: 0, retiradas: 0, tVentas: 0, tEfectivo: 0 },
        });
      }
      const dia = map.get(r.date);
      const cierre = {
        uuid: r.uuid,
        workcenter: r.workcenter_name,
        empleadoUuid: r.employee_uuid,
        empleado: r.employee_nombre,
        efectivo: num(r.efectivo),
        nRet: num(r.n_ret),
        datafono: num(r.datafono),
        cTarjeta: num(r.c_tarjeta),
        difArqueoEf: num(r.dif_arqueo_ef),
        difDatafono: num(r.dif_datafono),
        difTotal: num(r.dif_total),
        retiradas: num(r.retiradas),
        tVentas: num(r.t_ventas),
        tEfectivo: num(r.t_efectivo),
      };
      dia.cierres.push(cierre);
      dia.totales.efectivo = redondear(dia.totales.efectivo + cierre.efectivo);
      dia.totales.datafono = redondear(dia.totales.datafono + cierre.datafono);
      dia.totales.cTarjeta = redondear(dia.totales.cTarjeta + cierre.cTarjeta);
      dia.totales.difArqueoEf = redondear(dia.totales.difArqueoEf + cierre.difArqueoEf);
      dia.totales.difDatafono = redondear(dia.totales.difDatafono + cierre.difDatafono);
      dia.totales.difTotal = redondear(dia.totales.difTotal + cierre.difTotal);
      dia.totales.retiradas = redondear(dia.totales.retiradas + cierre.retiradas);
      dia.totales.tVentas = redondear(dia.totales.tVentas + cierre.tVentas);
      dia.totales.tEfectivo = redondear(dia.totales.tEfectivo + cierre.tEfectivo);
    }

    return Array.from(map.values());
  }
}
