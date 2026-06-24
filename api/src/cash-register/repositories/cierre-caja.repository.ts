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

  async buscarPorUuid(uuid: string): Promise<{ id: number; companyId: number; cierre: CierreCaja } | null> {
    const rows = await this.db.query<any[]>(
      `SELECT c.id, c.uuid, c.workcenter_id, c.employee_id, c.date::text AS date,
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

    return { id: r.id, companyId: r.company_id, cierre };
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

  async listarMes(companyId: number, year: number, month: number): Promise<any[]> {
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
       WHERE w.company_id = ? AND EXTRACT(YEAR FROM c.date) = ? AND EXTRACT(MONTH FROM c.date) = ?
       ORDER BY c.date, employee_nombre`,
      [companyId, year, month],
    );
  }

  async resumenMes(companyId: number, year: number, month: number): Promise<any[]> {
    return this.db.query<any[]>(
      `SELECT eu.uuid AS employee_uuid,
              TRIM(COALESCE(ep.first_name, '') || ' ' || COALESCE(ep.last_name, '')) AS nombre,
              COALESCE(SUM(c.dif_total), 0) AS neto,
              COALESCE(SUM(CASE WHEN c.dif_total < 0 THEN c.dif_total ELSE 0 END), 0) AS faltas,
              COALESCE(SUM(c.t_ventas), 0) AS ventas
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
}
