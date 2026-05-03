import { Injectable } from '@nestjs/common';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { DatabaseService } from '../../database/database.service';

type QueryRunner = <R = any>(sql: string, params?: any[]) => Promise<R>;

export interface CreateWorkcenterData {
  uuid: string;
  name: string;
  address?: string;
  email?: string;
  companyId: number;
}

@Injectable()
export class WorkcenterRepository {
  constructor(private readonly db: DatabaseService) {}

  private run<R = any>(q: QueryRunner | undefined, sql: string, params?: any[]): Promise<R> {
    if (q) return q<R>(sql, params);
    return this.db.query<R>(sql, params);
  }

  async create(data: CreateWorkcenterData, q?: QueryRunner): Promise<number> {
    const result = await this.run<ResultSetHeader>(
      q,
      'INSERT INTO workcenters (uuid, name, address, email, company_id) VALUES (?, ?, ?, ?, ?)',
      [data.uuid, data.name, data.address, data.email, data.companyId],
    );
    return result.insertId;
  }

  async findByUuid(uuid: string, q?: QueryRunner): Promise<{ id: number; company_id: number } | null> {
    const rows = await this.run<RowDataPacket[]>(q, 'SELECT id, company_id FROM workcenters WHERE uuid = ?', [uuid]);
    return (rows[0] as { id: number; company_id: number }) ?? null;
  }

  async findFullByUuid(uuid: string, q?: QueryRunner): Promise<{ id: number; uuid: string; name: string; address: string | null; email: string | null; company_id: number; active: number } | null> {
    const rows = await this.run<RowDataPacket[]>(q, 'SELECT id, uuid, name, address, email, company_id, active FROM workcenters WHERE uuid = ?', [uuid]);
    return (rows[0] as any) ?? null;
  }

  async existsByEmailExcluding(email: string, workcenterId: number, q?: QueryRunner): Promise<boolean> {
    const rows = await this.run<RowDataPacket[]>(q, 'SELECT id FROM workcenters WHERE email = ? AND id != ?', [email, workcenterId]);
    return rows.length > 0;
  }

  async update(id: number, data: { name?: string; address?: string; email?: string }, q?: QueryRunner): Promise<void> {
    const fields = Object.entries(data).filter(([, v]) => v !== undefined).map(([k]) => `${k} = ?`);
    const values = Object.entries(data).filter(([, v]) => v !== undefined).map(([, v]) => v);
    if (fields.length === 0) return;
    await this.run(q, `UPDATE workcenters SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);
  }

  async deleteUserAssignments(workcenterId: number, q?: QueryRunner): Promise<void> {
    await this.run(q, 'DELETE FROM user_workcenters WHERE workcenter_id = ?', [workcenterId]);
  }

  async delete(id: number, q?: QueryRunner): Promise<void> {
    await this.run(q, 'DELETE FROM workcenters WHERE id = ?', [id]);
  }

  async findAll(filters: { name?: string; page: number; limit: number }): Promise<{ data: RowDataPacket[]; total: number }> {
    const where: string[] = [];
    const params: unknown[] = [];

    if (filters.name) {
      where.push('w.name LIKE ?');
      params.push(`%${filters.name}%`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const offset = (filters.page - 1) * filters.limit;

    const [data, countRows] = await Promise.all([
      this.db.query<RowDataPacket[]>(
        `SELECT w.uuid, w.name, w.address, w.email, w.active, w.created_at,
                c.name AS company, c.uuid AS company_uuid,
                COUNT(uw.user_id) AS worker_count
         FROM workcenters w
         JOIN companies c ON c.id = w.company_id
         LEFT JOIN user_workcenters uw ON uw.workcenter_id = w.id
         ${whereClause}
         GROUP BY w.id
         ORDER BY w.created_at DESC LIMIT ? OFFSET ?`,
        [...params, filters.limit, offset],
      ),
      this.db.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM workcenters w ${whereClause}`,
        params,
      ),
    ]);

    return { data, total: countRows[0]['total'] as number };
  }

  async findAllByCompany(companyId: number, filters: { name?: string; page: number; limit: number }): Promise<{ data: RowDataPacket[]; total: number }> {
    const where: string[] = ['w.company_id = ?'];
    const params: unknown[] = [companyId];

    if (filters.name) {
      where.push('w.name LIKE ?');
      params.push(`%${filters.name}%`);
    }

    const whereClause = `WHERE ${where.join(' AND ')}`;
    const offset = (filters.page - 1) * filters.limit;

    const [data, countRows] = await Promise.all([
      this.db.query<RowDataPacket[]>(
        `SELECT w.uuid, w.name, w.address, w.email, w.active, w.created_at,
                COUNT(uw.user_id) AS worker_count
         FROM workcenters w
         LEFT JOIN user_workcenters uw ON uw.workcenter_id = w.id
         ${whereClause}
         GROUP BY w.id
         ORDER BY w.created_at DESC LIMIT ? OFFSET ?`,
        [...params, filters.limit, offset],
      ),
      this.db.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM workcenters w ${whereClause}`,
        params,
      ),
    ]);

    return { data, total: countRows[0]['total'] as number };
  }
}
