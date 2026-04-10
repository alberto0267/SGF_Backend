import { Injectable } from '@nestjs/common';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { DatabaseService } from '../../database/database.service';

type QueryRunner = <R = any>(sql: string, params?: any[]) => Promise<R>;

export interface CreateWorkcenterData {
  uuid: string;
  name: string;
  address: string;
  email: string;
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
}
