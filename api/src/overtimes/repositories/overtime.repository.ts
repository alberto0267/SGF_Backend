import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

type QueryRunner = <R = any>(sql: string, params?: any[]) => Promise<R>;

export interface CreateRequestData {
  uuid: string;
  workcenterId: number;
  requestedBy: number;
  date: string;
  reason?: string;
}

export interface CreateItemData {
  requestId: number;
  employeeId: number;
  hours: number;
}

export interface CreatePaymentData {
  accumulationId: number;
  hours: number;
  method: 'money' | 'hours_off';
  comment?: string;
  paidBy: number;
}

@Injectable()
export class OvertimeRepository {
  constructor(private readonly db: DatabaseService) {}

  private run<R = any>(q: QueryRunner | undefined, sql: string, params?: any[]): Promise<R> {
    if (q) return q<R>(sql, params);
    return this.db.query<R>(sql, params);
  }

  async createRequest(data: CreateRequestData, q?: QueryRunner): Promise<number> {
    const rows = await this.run<{ id: number }[]>(
      q,
      'INSERT INTO overtime_requests (uuid, workcenter_id, requested_by, date, reason) VALUES (?, ?, ?, ?, ?) RETURNING id',
      [data.uuid, data.workcenterId, data.requestedBy, data.date, data.reason ?? null],
    );
    return rows[0].id;
  }

  async createItems(items: CreateItemData[], q?: QueryRunner): Promise<void> {
    if (items.length === 0) return;
    const placeholders = items.map(() => '(?, ?, ?)').join(', ');
    const values = items.flatMap((i) => [i.requestId, i.employeeId, i.hours]);
    await this.run(q, `INSERT INTO overtime_request_items (request_id, employee_id, hours) VALUES ${placeholders}`, values);
  }

  async findByUuid(uuid: string, q?: QueryRunner): Promise<{
    id: number; uuid: string; workcenter_id: number; requested_by: number; date: string;
    reason: string | null; status: string; approved_by: number | null; approved_at: Date | null;
    company_id: number;
  } | null> {
    const rows = await this.run<any[]>(
      q,
      `SELECT r.id, r.uuid, r.workcenter_id, r.requested_by, r.date, r.reason, r.status,
              r.approved_by, r.approved_at, w.company_id
       FROM overtime_requests r
       JOIN workcenters w ON w.id = r.workcenter_id
       WHERE r.uuid = ?`,
      [uuid],
    );
    return rows[0] ?? null;
  }

  async getItems(requestId: number, q?: QueryRunner): Promise<{ employee_id: number; hours: number }[]> {
    return this.run<{ employee_id: number; hours: number }[]>(
      q,
      'SELECT employee_id, hours FROM overtime_request_items WHERE request_id = ?',
      [requestId],
    );
  }

  async approve(id: number, ownerId: number, q?: QueryRunner): Promise<void> {
    await this.run(
      q,
      `UPDATE overtime_requests SET status = 'approved', approved_by = ?, approved_at = NOW() WHERE id = ?`,
      [ownerId, id],
    );
  }

  async reject(id: number, ownerId: number, q?: QueryRunner): Promise<void> {
    await this.run(
      q,
      `UPDATE overtime_requests SET status = 'rejected', approved_by = ?, approved_at = NOW() WHERE id = ?`,
      [ownerId, id],
    );
  }

  async upsertAccumulation(employeeId: number, year: number, month: number, hours: number, q?: QueryRunner): Promise<void> {
    await this.run(
      q,
      `INSERT INTO overtime_accumulation (employee_id, year, month, total_hours)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (employee_id, year, month) DO UPDATE SET total_hours = overtime_accumulation.total_hours + EXCLUDED.total_hours`,
      [employeeId, year, month, hours],
    );
  }

  async findAccumulationByEmployeeMonth(
    employeeId: number,
    year: number,
    month: number,
    q?: QueryRunner,
  ): Promise<{ id: number; total_hours: number; company_id: number } | null> {
    const rows = await this.run<any[]>(
      q,
      `SELECT a.id, a.total_hours, u.company_id
       FROM overtime_accumulation a
       JOIN users u ON u.id = a.employee_id
       WHERE a.employee_id = ? AND a.year = ? AND a.month = ?`,
      [employeeId, year, month],
    );
    return rows[0] ?? null;
  }

  async sumPayments(accumulationId: number, q?: QueryRunner): Promise<number> {
    const rows = await this.run<{ total: string }[]>(
      q,
      'SELECT COALESCE(SUM(hours), 0) AS total FROM overtime_payments WHERE accumulation_id = ?',
      [accumulationId],
    );
    return Number(rows[0].total);
  }

  async createPayment(data: CreatePaymentData, q?: QueryRunner): Promise<number> {
    const rows = await this.run<{ id: number }[]>(
      q,
      `INSERT INTO overtime_payments (accumulation_id, hours, method, comment, paid_by)
       VALUES (?, ?, ?, ?, ?) RETURNING id`,
      [data.accumulationId, data.hours, data.method, data.comment ?? null, data.paidBy],
    );
    return rows[0].id;
  }

  async findPaymentsByAccumulation(accumulationId: number): Promise<any[]> {
    return this.db.query<any[]>(
      `SELECT pay.id, pay.hours, pay.method, pay.comment, pay.created_at,
              pp.first_name AS paid_by_first_name, pp.last_name AS paid_by_last_name
       FROM overtime_payments pay
       JOIN users pu ON pu.id = pay.paid_by
       LEFT JOIN profiles pp ON pp.user_id = pu.id
       WHERE pay.accumulation_id = ?
       ORDER BY pay.created_at DESC`,
      [accumulationId],
    );
  }

  async findAll(filters: {
    companyId?: number;
    workcenterId?: number;
    month?: number;
    year?: number;
    status?: string;
    workcenterIdFilter?: number;
    search?: string;
  }): Promise<any[]> {
    const where: string[] = [];
    const params: unknown[] = [];

    if (filters.companyId !== undefined) {
      where.push('w.company_id = ?');
      params.push(filters.companyId);
    }
    if (filters.workcenterId !== undefined) {
      where.push('r.workcenter_id = ?');
      params.push(filters.workcenterId);
    }
    if (filters.workcenterIdFilter !== undefined) {
      where.push('r.workcenter_id = ?');
      params.push(filters.workcenterIdFilter);
    }
    if (filters.month !== undefined) {
      where.push('EXTRACT(MONTH FROM r.date) = ?');
      params.push(filters.month);
    }
    if (filters.year !== undefined) {
      where.push('EXTRACT(YEAR FROM r.date) = ?');
      params.push(filters.year);
    }
    if (filters.status) {
      where.push('r.status = ?');
      params.push(filters.status);
    }
    if (filters.search) {
      where.push('(mp.first_name LIKE ? OR mp.last_name LIKE ?)');
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    return this.db.query<any[]>(
      `SELECT r.uuid, r.date, r.reason, r.status, r.created_at, r.approved_at,
              w.name AS workcenter_name,
              mp.first_name AS manager_first_name, mp.last_name AS manager_last_name,
              eu.uuid AS employee_uuid,
              ep.first_name AS employee_first_name,
              ep.last_name AS employee_last_name,
              ep.dni AS employee_dni,
              i.hours
       FROM overtime_requests r
       JOIN workcenters w ON w.id = r.workcenter_id
       JOIN users mu ON mu.id = r.requested_by
       LEFT JOIN profiles mp ON mp.user_id = mu.id
       LEFT JOIN overtime_request_items i ON i.request_id = r.id
       LEFT JOIN users eu ON eu.id = i.employee_id
       LEFT JOIN profiles ep ON ep.user_id = eu.id
       ${whereClause}
       ORDER BY r.created_at DESC, r.id, ep.last_name`,
      params,
    );
  }

  async findApprovedDetail(filters: {
    companyId?: number;
    workcenterIds?: number[];
    month?: number;
    year?: number;
  }): Promise<any[]> {
    const where: string[] = ["r.status = 'approved'"];
    const params: unknown[] = [];

    if (filters.companyId !== undefined) {
      where.push('w.company_id = ?');
      params.push(filters.companyId);
    }
    if (filters.workcenterIds && filters.workcenterIds.length > 0) {
      const ph = filters.workcenterIds.map(() => '?').join(', ');
      where.push(`r.workcenter_id IN (${ph})`);
      params.push(...filters.workcenterIds);
    }
    if (filters.month !== undefined) {
      where.push('EXTRACT(MONTH FROM r.date) = ?');
      params.push(filters.month);
    }
    if (filters.year !== undefined) {
      where.push('EXTRACT(YEAR FROM r.date) = ?');
      params.push(filters.year);
    }

    return this.db.query<any[]>(
      `SELECT r.uuid AS request_uuid,
              r.date,
              r.reason,
              r.approved_at,
              w.name AS workcenter_name,
              mp.first_name AS manager_first_name,
              mp.last_name AS manager_last_name,
              op.first_name AS approved_by_first_name,
              op.last_name AS approved_by_last_name,
              eu.uuid AS employee_uuid,
              ep.first_name AS employee_first_name,
              ep.last_name AS employee_last_name,
              i.hours
       FROM overtime_requests r
       JOIN workcenters w ON w.id = r.workcenter_id
       JOIN users mu ON mu.id = r.requested_by
       LEFT JOIN profiles mp ON mp.user_id = mu.id
       JOIN users ou ON ou.id = r.approved_by
       LEFT JOIN profiles op ON op.user_id = ou.id
       JOIN overtime_request_items i ON i.request_id = r.id
       JOIN users eu ON eu.id = i.employee_id
       LEFT JOIN profiles ep ON ep.user_id = eu.id
       WHERE ${where.join(' AND ')}
       ORDER BY r.approved_at DESC, r.id, ep.last_name`,
      params,
    );
  }

  async findAccumulation(filters: {
    companyId?: number;
    workcenterIds?: number[];
    month?: number;
    year?: number;
  }): Promise<any[]> {
    const where: string[] = [];
    const params: unknown[] = [];

    if (filters.companyId !== undefined) {
      where.push('u.company_id = ?');
      params.push(filters.companyId);
    }
    if (filters.workcenterIds && filters.workcenterIds.length > 0) {
      const ph = filters.workcenterIds.map(() => '?').join(', ');
      where.push(`uw.workcenter_id IN (${ph})`);
      params.push(...filters.workcenterIds);
    }
    if (filters.month !== undefined) {
      where.push('a.month = ?');
      params.push(filters.month);
    }
    if (filters.year !== undefined) {
      where.push('a.year = ?');
      params.push(filters.year);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    return this.db.query<any[]>(
      `SELECT a.year, a.month, a.total_hours,
              COALESCE(pay.paid, 0) AS hours_paid,
              a.total_hours - COALESCE(pay.paid, 0) AS hours_pending,
              u.uuid AS employee_uuid,
              p.first_name, p.last_name
       FROM overtime_accumulation a
       JOIN users u ON u.id = a.employee_id
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN user_workcenters uw ON uw.user_id = u.id
       LEFT JOIN (
         SELECT accumulation_id, SUM(hours) AS paid
         FROM overtime_payments
         GROUP BY accumulation_id
       ) pay ON pay.accumulation_id = a.id
       ${whereClause}
       GROUP BY a.id, u.id, p.user_id, pay.paid
       ORDER BY a.year DESC, a.month DESC, p.last_name`,
      params,
    );
  }
}
