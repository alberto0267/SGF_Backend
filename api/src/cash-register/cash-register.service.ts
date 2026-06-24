import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository } from '../auth/repositories/user.repository';
import { DatabaseService } from '../database/database.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CierreCaja } from './domain/cierre-caja';
import { CreateCierreDto } from './dto/create-cierre.dto';
import { EditCierreDto } from './dto/edit-cierre.dto';
import { QueryMesDto } from './dto/query-mes.dto';
import { CierreCajaRepository } from './repositories/cierre-caja.repository';

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

@Injectable()
export class CashRegisterService {
  constructor(
    private readonly repo: CierreCajaRepository,
    private readonly userRepo: UserRepository,
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

    if (editorRole === 'Owner') {
      const empresaEditor = await this.userRepo.findCompanyIdByUserId(editorId);
      if (empresaEditor === null || empresaEditor !== found.companyId) {
        throw new ForbiddenException('No tienes acceso a este cierre');
      }
    } else if (editorId !== found.cierre.employeeId) {
      throw new ForbiddenException('Solo puedes editar tus propios cierres');
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

    if (editorRole === 'Owner') {
      await this.notifications.notify(
        found.cierre.employeeId,
        'Cierre editado por el owner',
        `Tu cierre del ${found.cierre.date} fue editado: ${dto.comentario}`,
      );
    } else {
      await this.notificarOwners(found.companyId, `Cierre editado (${found.cierre.date}): ${dto.comentario}`);
    }
  }

  async listar(ownerId: number, query: QueryMesDto) {
    const companyId = await this.userRepo.findCompanyIdByUserId(ownerId);
    if (!companyId) throw new NotFoundException('Empresa no encontrada');
    const rows = await this.repo.listarMes(companyId, query.year, query.month);
    return this.agruparPorDia(rows);
  }

  async resumen(ownerId: number, query: QueryMesDto) {
    const companyId = await this.userRepo.findCompanyIdByUserId(ownerId);
    if (!companyId) throw new NotFoundException('Empresa no encontrada');

    const empleados = (await this.repo.resumenMes(companyId, query.year, query.month)).map((e) => ({
      employeeUuid: e.employee_uuid,
      nombre: e.nombre,
      neto: Number(e.neto),
      faltas: Number(e.faltas),
      ventas: Number(e.ventas),
    }));

    const totalVentas = redondear(empleados.reduce((s, e) => s + e.ventas, 0));
    return { totalVentas, empleados };
  }

  async cambiarRetiradaValor(ownerId: number, valor: number) {
    const companyId = await this.userRepo.findCompanyIdByUserId(ownerId);
    if (!companyId) throw new NotFoundException('Empresa no encontrada');
    await this.repo.setRetiradaValor(companyId, valor);
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
          totales: { efectivo: 0, datafono: 0, cTarjeta: 0, difTotal: 0, retiradas: 0, tVentas: 0, tEfectivo: 0 },
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
      dia.totales.difTotal = redondear(dia.totales.difTotal + cierre.difTotal);
      dia.totales.retiradas = redondear(dia.totales.retiradas + cierre.retiradas);
      dia.totales.tVentas = redondear(dia.totales.tVentas + cierre.tVentas);
      dia.totales.tEfectivo = redondear(dia.totales.tEfectivo + cierre.tEfectivo);
    }

    return Array.from(map.values());
  }
}
