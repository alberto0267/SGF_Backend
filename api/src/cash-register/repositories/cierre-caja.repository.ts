import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CierreCaja } from '../domain/cierre-caja';

type QueryRunner = <R = any>(sql: string, params?: any[]) => Promise<R>;

@Injectable()
export class CierreCajaRepository {
  constructor(private readonly db: DatabaseService) {}

  private run<R = any>(q: QueryRunner | undefined, sql: string, params?: any[]): Promise<R> {
    if (q) return q<R>(sql, params);
    return this.db.query<R>(sql, params);
  }

  async crear(cierre: CierreCaja, q?: QueryRunner): Promise<number> {
    const rows = await this.run<{ id: number }[]>(
      q,
      `INSERT INTO cash_register_closures
        (uuid, workcenter_id, employee_id, date, efectivo, n_ret, datafono, c_tarjeta, dif_arqueo_ef,
         retirada_valor, dif_datafono, dif_total, retiradas, t_ventas, t_efectivo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       RETURNING id`,
      [
        cierre.uuid, cierre.workcenterId, cierre.employeeId, cierre.date,
        cierre.efectivo, cierre.nRet, cierre.datafono, cierre.cTarjeta, cierre.difArqueoEf,
        cierre.retiradaValor, cierre.difDatafono, cierre.difTotal, cierre.retiradas, cierre.tVentas, cierre.tEfectivo,
      ],
    );
    return rows[0].id;
  }

  async buscarPorUuid(uuid: string): Promise<{ id: number; companyId: number; createdAt: Date; cierre: CierreCaja } | null> {
    const rows = await this.db.query<any[]>(
      `SELECT c.id, c.uuid, c.workcenter_id, c.employee_id, c.date::text AS date, c.created_at,
              c.efectivo, c.n_ret, c.datafono, c.c_tarjeta, c.dif_arqueo_ef, c.retirada_valor,
              w.company_id
       FROM cash_register_closures c
       JOIN workcenters w ON w.id = c.workcenter_id
       WHERE c.uuid = ?`,
      [uuid],
    );
    if (rows.length === 0) return null;
    const r = rows[0];

    const cierre = CierreCaja.fromPersistence(
      r.uuid,
      r.workcenter_id,
      r.employee_id,
      r.date,
      {
        efectivo: Number(r.efectivo),
        nRet: Number(r.n_ret),
        datafono: Number(r.datafono),
        cTarjeta: Number(r.c_tarjeta),
        difArqueoEf: Number(r.dif_arqueo_ef),
      },
      Number(r.retirada_valor),
    );

    return { id: r.id, companyId: r.company_id, createdAt: r.created_at, cierre };
  }

  async actualizar(cierre: CierreCaja, id: number, q?: QueryRunner): Promise<void> {
    await this.run(
      q,
      `UPDATE cash_register_closures SET
         efectivo = ?, n_ret = ?, datafono = ?, c_tarjeta = ?, dif_arqueo_ef = ?,
         dif_datafono = ?, dif_total = ?, retiradas = ?, t_ventas = ?, t_efectivo = ?
       WHERE id = ?`,
      [
        cierre.efectivo, cierre.nRet, cierre.datafono, cierre.cTarjeta, cierre.difArqueoEf,
        cierre.difDatafono, cierre.difTotal, cierre.retiradas, cierre.tVentas, cierre.tEfectivo, id,
      ],
    );
  }

  async registrarEdicion(closureId: number, editorId: number, comment: string, q?: QueryRunner): Promise<void> {
    await this.run(
      q,
      'INSERT INTO cash_register_closure_edits (closure_id, editor_id, comment) VALUES (?, ?, ?)',
      [closureId, editorId, comment],
    );
  }

  async getRetiradaValor(companyId: number): Promise<number> {
    const rows = await this.db.query<{ retirada_valor: string }[]>(
      'SELECT retirada_valor FROM companies WHERE id = ?',
      [companyId],
    );
    return Number(rows[0]?.retirada_valor ?? 500);
  }

  async setRetiradaValor(companyId: number, valor: number): Promise<void> {
    await this.db.query('UPDATE companies SET retirada_valor = ? WHERE id = ?', [valor, companyId]);
  }

  private buildFiltrosCierre(filters: {
    companyId?: number;
    workcenterIds?: number[];
    workcenterId?: number;
    employeeId?: number;
    year: number;
    month: number;
  }): { where: string; params: unknown[] } {
    const where: string[] = ['EXTRACT(YEAR FROM c.date) = ?', 'EXTRACT(MONTH FROM c.date) = ?'];
    const params: unknown[] = [filters.year, filters.month];

    if (filters.companyId !== undefined) {
      where.push('w.company_id = ?');
      params.push(filters.companyId);
    }
    if (filters.workcenterIds && filters.workcenterIds.length > 0) {
      const ph = filters.workcenterIds.map(() => '?').join(', ');
      where.push(`c.workcenter_id IN (${ph})`);
      params.push(...filters.workcenterIds);
    }
    if (filters.workcenterId !== undefined) {
      where.push('c.workcenter_id = ?');
      params.push(filters.workcenterId);
    }
    if (filters.employeeId !== undefined) {
      where.push('c.employee_id = ?');
      params.push(filters.employeeId);
    }

    return { where: where.join(' AND '), params };
  }

  async contarDiasConCierres(filters: {
    companyId?: number;
    workcenterIds?: number[];
    workcenterId?: number;
    employeeId?: number;
    year: number;
    month: number;
  }): Promise<number> {
    const { where, params } = this.buildFiltrosCierre(filters);
    const rows = await this.db.query<{ total: string }[]>(
      `SELECT COUNT(DISTINCT c.date) AS total
       FROM cash_register_closures c
       JOIN workcenters w ON w.id = c.workcenter_id
       WHERE ${where}`,
      params,
    );
    return Number(rows[0]?.total ?? 0);
  }

  async listarFechasPagina(
    filters: { companyId?: number; workcenterIds?: number[]; workcenterId?: number; employeeId?: number; year: number; month: number },
    offset: number,
    limit: number,
  ): Promise<string[]> {
    const { where, params } = this.buildFiltrosCierre(filters);
    const rows = await this.db.query<{ date: string }[]>(
      `SELECT DISTINCT c.date::text AS date
       FROM cash_register_closures c
       JOIN workcenters w ON w.id = c.workcenter_id
       WHERE ${where}
       ORDER BY date DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset],
    );
    return rows.map((r) => r.date);
  }

  async listarPorFechas(
    filters: { companyId?: number; workcenterIds?: number[]; workcenterId?: number; employeeId?: number; year: number; month: number },
    fechas: string[],
  ): Promise<any[]> {
    if (fechas.length === 0) return [];
    const { where, params } = this.buildFiltrosCierre(filters);
    const ph = fechas.map(() => '?').join(', ');
    return this.db.query<any[]>(
      `SELECT c.uuid, c.date::text AS date,
              w.name AS workcenter_name,
              eu.uuid AS employee_uuid,
              TRIM(COALESCE(ep.first_name, '') || ' ' || COALESCE(ep.last_name, '')) AS employee_nombre,
              c.efectivo, c.n_ret, c.datafono, c.c_tarjeta, c.dif_arqueo_ef,
              c.dif_datafono, c.dif_total, c.retiradas, c.t_ventas, c.t_efectivo
       FROM cash_register_closures c
       JOIN workcenters w ON w.id = c.workcenter_id
       JOIN users eu ON eu.id = c.employee_id
       LEFT JOIN profiles ep ON ep.user_id = eu.id
       WHERE ${where} AND c.date IN (${ph})
       ORDER BY c.date DESC, employee_nombre`,
      [...params, ...fechas],
    );
  }

  async listarPropios(employeeId: number, from?: string, to?: string): Promise<any[]> {
    const where: string[] = ['c.employee_id = ?'];
    const params: unknown[] = [employeeId];

    if (from) {
      where.push('c.date >= ?');
      params.push(from);
    }
    if (to) {
      where.push('c.date <= ?');
      params.push(to);
    }

    return this.db.query<any[]>(
      `SELECT c.uuid, c.date::text AS date, c.created_at,
              w.name AS workcenter_name,
              c.efectivo, c.n_ret, c.datafono, c.c_tarjeta, c.dif_arqueo_ef,
              c.dif_datafono, c.dif_total, c.retiradas, c.t_ventas, c.t_efectivo
       FROM cash_register_closures c
       JOIN workcenters w ON w.id = c.workcenter_id
       WHERE ${where.join(' AND ')}
       ORDER BY c.date DESC`,
      params,
    );
  }

  async resumenMes(companyId: number, year: number, month: number): Promise<any[]> {
    return this.db.query<any[]>(
      `SELECT eu.uuid AS employee_uuid,
              TRIM(COALESCE(ep.first_name, '') || ' ' || COALESCE(ep.last_name, '')) AS nombre,
              COALESCE(SUM(c.efectivo), 0) AS efectivo,
              COALESCE(SUM(c.n_ret), 0) AS n_ret,
              COALESCE(SUM(c.datafono), 0) AS datafono,
              COALESCE(SUM(c.c_tarjeta), 0) AS c_tarjeta,
              COALESCE(SUM(c.dif_arqueo_ef), 0) AS dif_arqueo_ef,
              COALESCE(SUM(c.dif_datafono), 0) AS dif_datafono,
              COALESCE(SUM(c.dif_total), 0) AS dif_total,
              COALESCE(SUM(c.retiradas), 0) AS retiradas,
              COALESCE(SUM(c.t_ventas), 0) AS t_ventas,
              COALESCE(SUM(c.t_efectivo), 0) AS t_efectivo
       FROM cash_register_closures c
       JOIN workcenters w ON w.id = c.workcenter_id
       JOIN users eu ON eu.id = c.employee_id
       LEFT JOIN profiles ep ON ep.user_id = eu.id
       WHERE w.company_id = ? AND EXTRACT(YEAR FROM c.date) = ? AND EXTRACT(MONTH FROM c.date) = ?
       GROUP BY eu.uuid, ep.first_name, ep.last_name
       ORDER BY nombre`,
      [companyId, year, month],
    );
  }

  async daySummary(date: string, companyId?: number, workcenterId?: number): Promise<any> {
    const where: string[] = ['c.date = ?'];
    const params: unknown[] = [date];

    if (companyId !== undefined) {
      where.push('w.company_id = ?');
      params.push(companyId);
    }
    if (workcenterId !== undefined) {
      where.push('c.workcenter_id = ?');
      params.push(workcenterId);
    }

    const rows = await this.db.query<any[]>(
      `SELECT
         COALESCE(SUM(c.efectivo), 0) AS efectivo,
         COALESCE(SUM(c.n_ret), 0) AS n_ret,
         COALESCE(SUM(c.datafono), 0) AS datafono,
         COALESCE(SUM(c.c_tarjeta), 0) AS c_tarjeta,
         COALESCE(SUM(c.dif_arqueo_ef), 0) AS dif_arqueo_ef,
         COALESCE(SUM(c.dif_datafono), 0) AS dif_datafono,
         COALESCE(SUM(c.dif_total), 0) AS dif_total,
         COALESCE(SUM(c.retiradas), 0) AS retiradas,
         COALESCE(SUM(c.t_ventas), 0) AS t_ventas,
         COALESCE(SUM(c.t_efectivo), 0) AS t_efectivo
       FROM cash_register_closures c
       JOIN workcenters w ON w.id = c.workcenter_id
       WHERE ${where.join(' AND ')}`,
      params,
    );
    return rows[0];
  }

  async setResumenHora(workcenterId: number, hora: string): Promise<void> {
    await this.db.query('UPDATE workcenters SET resumen_hora = ? WHERE id = ?', [hora, workcenterId]);
  }

  async findWorkcentersParaResumen(horaActual: string): Promise<{ id: number; uuid: string; name: string; company_id: number; owner_id: number }[]> {
    return this.db.query<any[]>(
      `SELECT w.id, w.uuid, w.name, w.company_id, o.id AS owner_id
       FROM workcenters w
       JOIN users o ON o.company_id = w.company_id
       JOIN roles r ON r.id = o.role_id AND r.name = 'Owner'
       WHERE w.resumen_hora = ?
         AND (w.resumen_last_sent IS NULL OR w.resumen_last_sent < CURRENT_DATE)
         AND w.active = true`,
      [horaActual],
    );
  }

  async marcarResumenEnviado(workcenterId: number): Promise<void> {
    await this.db.query('UPDATE workcenters SET resumen_last_sent = CURRENT_DATE WHERE id = ?', [workcenterId]);
  }
}
