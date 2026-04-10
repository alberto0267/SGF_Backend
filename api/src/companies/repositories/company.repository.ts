import { Injectable } from '@nestjs/common';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { DatabaseService } from '../../database/database.service';

type QueryRunner = <R = any>(sql: string, params?: any[]) => Promise<R>;

export interface CreateCompanyData {
  uuid: string;
  name: string;
  nif: string;
  address: string;
  phone?: string;
}

export interface CreateWorkCenterData {
  uuid: string;
  name: string;
  companyId: number;
  address?: string;
  email?: string;
}

@Injectable()
export class CompanyRepository {
  constructor(private readonly db: DatabaseService) {}

  private run<R = any>(q: QueryRunner | undefined, sql: string, params?: any[]): Promise<R> {
    if (q) return q<R>(sql, params);
    return this.db.query<R>(sql, params);
  }

  async existsByNif(nif: string, q?: QueryRunner): Promise<boolean> {
    const rows = await this.run<RowDataPacket[]>(q, 'SELECT id FROM companies WHERE nif = ?', [nif]);
    return rows.length > 0;
  }

  async create(data: CreateCompanyData, q?: QueryRunner): Promise<number> {
    const result = await this.run<ResultSetHeader>(
      q,
      'INSERT INTO companies (uuid, name, nif, address, phone) VALUES (?, ?, ?, ?, ?)',
      [data.uuid, data.name, data.nif, data.address, data.phone ?? null],
    );
    return result.insertId;
  }

  async findByUuid(uuid: string, q?: QueryRunner): Promise<{ id: number } | null> {
    const rows = await this.run<RowDataPacket[]>(q, 'SELECT id FROM companies WHERE uuid = ?', [uuid]);
    return (rows[0] as { id: number }) ?? null;
  }

  async createWorkCenter(data: CreateWorkCenterData, q?: QueryRunner): Promise<number> {
    const result = await this.run<ResultSetHeader>(
      q,
      'INSERT INTO workcenters (uuid, name, company_id, address, email) VALUES (?, ?, ?, ?, ?)',
      [data.uuid, data.name, data.companyId, data.address ?? null, data.email ?? null],
    );
    return result.insertId;
  }

  async findFullByUuid(uuid: string, q?: QueryRunner): Promise<{ id: number; uuid: string; name: string; nif: string; address: string; phone: string | null; active: number } | null> {
    const rows = await this.run<RowDataPacket[]>(q, 'SELECT id, uuid, name, nif, address, phone, active FROM companies WHERE uuid = ?', [uuid]);
    return (rows[0] as any) ?? null;
  }

  async existsByNifExcluding(nif: string, companyId: number, q?: QueryRunner): Promise<boolean> {
    const rows = await this.run<RowDataPacket[]>(q, 'SELECT id FROM companies WHERE nif = ? AND id != ?', [nif, companyId]);
    return rows.length > 0;
  }

  async update(id: number, data: Partial<Pick<CreateCompanyData, 'name' | 'nif' | 'address' | 'phone'>>, q?: QueryRunner): Promise<void> {
    const fields = Object.entries(data)
      .filter(([, v]) => v !== undefined)
      .map(([k]) => `${k} = ?`);
    const values = Object.entries(data)
      .filter(([, v]) => v !== undefined)
      .map(([, v]) => v);
    await this.run(q, `UPDATE companies SET ${fields.join(', ')} WHERE id = ?`, [...values, id]);
  }

  async setActive(id: number, active: boolean, q?: QueryRunner): Promise<void> {
    await this.run(q, 'UPDATE companies SET active = ? WHERE id = ?', [active ? 1 : 0, id]);
  }

  async setUsersActive(companyId: number, active: boolean, q?: QueryRunner): Promise<void> {
    await this.run(q, 'UPDATE users SET active = ? WHERE company_id = ?', [active ? 1 : 0, companyId]);
  }

  async setWorkcentersActive(companyId: number, active: boolean, q?: QueryRunner): Promise<void> {
    await this.run(q, 'UPDATE workcenters SET active = ? WHERE company_id = ?', [active ? 1 : 0, companyId]);
  }

  async revokeTokensByCompanyId(companyId: number, q?: QueryRunner): Promise<void> {
    await this.run(q, 'UPDATE refresh_tokens rt JOIN users u ON u.id = rt.user_id SET rt.revoked = 1 WHERE u.company_id = ?', [companyId]);
  }

  async getUserIdsByCompanyId(companyId: number, q?: QueryRunner): Promise<number[]> {
    const rows = await this.run<RowDataPacket[]>(q, 'SELECT id FROM users WHERE company_id = ?', [companyId]);
    return rows.map((r) => r['id'] as number);
  }

  async deleteUserWorkcenters(userIds: number[], q?: QueryRunner): Promise<void> {
    await this.run(q, `DELETE FROM user_workcenters WHERE user_id IN (${userIds.map(() => '?').join(',')})`, userIds);
  }

  async deleteProfiles(userIds: number[], q?: QueryRunner): Promise<void> {
    await this.run(q, `DELETE FROM profiles WHERE user_id IN (${userIds.map(() => '?').join(',')})`, userIds);
  }

  async deleteRefreshTokens(userIds: number[], q?: QueryRunner): Promise<void> {
    await this.run(q, `DELETE FROM refresh_tokens WHERE user_id IN (${userIds.map(() => '?').join(',')})`, userIds);
  }

  async deleteMobileTokens(userIds: number[], q?: QueryRunner): Promise<void> {
    await this.run(q, `DELETE FROM mobile_tokens WHERE user_id IN (${userIds.map(() => '?').join(',')})`, userIds);
  }

  async deleteNotifications(userIds: number[], q?: QueryRunner): Promise<void> {
    await this.run(q, `DELETE FROM notifications WHERE user_id IN (${userIds.map(() => '?').join(',')})`, userIds);
  }

  async deletePdfs(userIds: number[], q?: QueryRunner): Promise<void> {
    await this.run(q, `DELETE FROM pdfs WHERE user_id IN (${userIds.map(() => '?').join(',')})`, userIds);
  }

  async deleteRefunds(userIds: number[], q?: QueryRunner): Promise<void> {
    await this.run(q, `DELETE FROM refunds WHERE user_id IN (${userIds.map(() => '?').join(',')})`, userIds);
  }

  async deleteTruckDeliveries(userIds: number[], q?: QueryRunner): Promise<void> {
    await this.run(q, `DELETE FROM truck_deliveries WHERE user_id IN (${userIds.map(() => '?').join(',')})`, userIds);
  }

  async deleteCashRegisterClosures(userIds: number[], q?: QueryRunner): Promise<void> {
    await this.run(q, `DELETE FROM cash_register_closures WHERE user_id IN (${userIds.map(() => '?').join(',')})`, userIds);
  }

  async deleteLeaveRequests(userIds: number[], q?: QueryRunner): Promise<void> {
    await this.run(q, `DELETE FROM leave_requests WHERE user_id IN (${userIds.map(() => '?').join(',')})`, userIds);
  }

  async deleteOvertimes(userIds: number[], q?: QueryRunner): Promise<void> {
    await this.run(q, `DELETE FROM overtimes WHERE user_id IN (${userIds.map(() => '?').join(',')})`, userIds);
  }

  async deleteBakery(userIds: number[], q?: QueryRunner): Promise<void> {
    await this.run(q, `DELETE FROM bakery WHERE user_id IN (${userIds.map(() => '?').join(',')})`, userIds);
  }

  async nullifyAuditActor(userIds: number[], q?: QueryRunner): Promise<void> {
    await this.run(q, `UPDATE audit_log SET actor_id = NULL WHERE actor_id IN (${userIds.map(() => '?').join(',')})`, userIds);
  }

  async deleteUsers(companyId: number, q?: QueryRunner): Promise<void> {
    await this.run(q, 'DELETE FROM users WHERE company_id = ?', [companyId]);
  }

  async deleteWorkcenters(companyId: number, q?: QueryRunner): Promise<void> {
    await this.run(q, 'DELETE FROM workcenters WHERE company_id = ?', [companyId]);
  }

  async deleteCompany(id: number, q?: QueryRunner): Promise<void> {
    await this.run(q, 'DELETE FROM companies WHERE id = ?', [id]);
  }
}
