import { Injectable } from '@nestjs/common';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { DatabaseService } from '../../database/database.service';

type QueryRunner = <R = any>(sql: string, params?: any[]) => Promise<R>;

export interface UserRow extends RowDataPacket {
  id: number;
  uuid: string;
  email: string;
  password: string;
  active: number;
  failed_login_attempts: number;
  locked_until: Date | null;
  role_name: string;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
}

export interface CreateUserData {
  uuid: string;
  email: string;
  password: string;
  roleId: number;
  companyId: number;
}

export interface CreateProfileData {
  userId: number;
  firstName: string;
  lastName: string;
  dni?: string;
  phone?: string;
  address?: string;
}

@Injectable()
export class UserRepository {
  constructor(private readonly db: DatabaseService) {}

  private run<R = any>(q: QueryRunner | undefined, sql: string, params?: any[]): Promise<R> {
    if (q) return q<R>(sql, params);
    return this.db.query<R>(sql, params);
  }

  // ─── Queries de autenticación ─────────────────────────────────────────────

  async findByEmail(email: string): Promise<UserRow | null> {
    const rows = await this.db.query<UserRow[]>(
      `SELECT u.id, u.uuid, u.email, u.password, u.active,
              u.failed_login_attempts, u.locked_until,
              r.name AS role_name, c.name AS company_name,
              p.first_name, p.last_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN companies c ON c.id = u.company_id
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.email = ?`,
      [email],
    );
    return rows[0] ?? null;
  }

  async findMeByUuid(uuid: string): Promise<UserRow | null> {
    const rows = await this.db.query<UserRow[]>(
      `SELECT u.uuid, u.email, r.name AS role_name,
              p.first_name, p.last_name,
              c.name AS company_name
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN profiles p ON p.user_id = u.id
       LEFT JOIN companies c ON c.id = u.company_id
       WHERE u.uuid = ?`,
      [uuid],
    );
    return rows[0] ?? null;
  }

  async findByRefreshToken(tokenHash: string): Promise<UserRow | null> {
    const rows = await this.db.query<UserRow[]>(
      `SELECT u.id, u.uuid, u.email, u.active, r.name AS role_name
       FROM refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       JOIN roles r ON r.id = u.role_id
       WHERE rt.token_hash = ? AND rt.revoked = 0 AND rt.expires_at > NOW()`,
      [tokenHash],
    );
    return rows[0] ?? null;
  }

  async resetFailedAttempts(userId: number): Promise<void> {
    await this.db.query(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login_at = NOW() WHERE id = ?',
      [userId],
    );
  }

  async incrementFailedAttempts(userId: number, newCount: number, lockedUntil: Date | null): Promise<void> {
    await this.db.query(
      'UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?',
      [newCount, lockedUntil, userId],
    );
  }

  async saveRefreshToken(userId: number, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.db.query(
      'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
      [userId, tokenHash, expiresAt],
    );
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    await this.db.query(
      'UPDATE refresh_tokens SET revoked = 1 WHERE token_hash = ?',
      [tokenHash],
    );
  }

  async revokeAllTokensByUuid(uuid: string): Promise<void> {
    await this.db.query(
      `UPDATE refresh_tokens rt
       JOIN users u ON u.id = rt.user_id
       SET rt.revoked = 1
       WHERE u.uuid = ?`,
      [uuid],
    );
  }

  // ─── Queries usadas en transacciones (aceptan QueryRunner externo) ─────────

  async existsByEmail(email: string, q?: QueryRunner): Promise<boolean> {
    const rows = await this.run<RowDataPacket[]>(q, 'SELECT id FROM users WHERE email = ?', [email]);
    return rows.length > 0;
  }

  async existsByDni(dni: string, q?: QueryRunner): Promise<boolean> {
    const rows = await this.run<RowDataPacket[]>(q, 'SELECT id FROM profiles WHERE dni = ?', [dni]);
    return rows.length > 0;
  }

  async findRoleIdByName(name: string, q?: QueryRunner): Promise<number | null> {
    const rows = await this.run<RowDataPacket[]>(q, 'SELECT id FROM roles WHERE name = ?', [name]);
    return (rows[0]?.['id'] as number) ?? null;
  }

  async create(data: CreateUserData, q?: QueryRunner): Promise<number> {
    const result = await this.run<ResultSetHeader>(
      q,
      'INSERT INTO users (email, password, role_id, company_id, uuid) VALUES (?, ?, ?, ?, ?)',
      [data.email, data.password, data.roleId, data.companyId, data.uuid],
    );
    return result.insertId;
  }

  async countByRoleName(roleName: string, q?: QueryRunner): Promise<number> {
    const rows = await this.run<RowDataPacket[]>(
      q,
      `SELECT COUNT(*) AS cnt FROM users u JOIN roles r ON r.id = u.role_id WHERE r.name = ?`,
      [roleName],
    );
    return (rows[0]?.['cnt'] as number) ?? 0;
  }

  async createProfile(data: CreateProfileData, q?: QueryRunner): Promise<void> {
    await this.run<ResultSetHeader>(
      q,
      'INSERT INTO profiles (user_id, first_name, last_name, dni, phone, address) VALUES (?, ?, ?, ?, ?, ?)',
      [data.userId, data.firstName, data.lastName, data.dni ?? null, data.phone ?? null, data.address ?? null],
    );
  }

  async findCompanyIdByUserId(userId: number): Promise<number | null> {
    const rows = await this.db.query<RowDataPacket[]>('SELECT company_id FROM users WHERE id = ?', [userId]);
    return (rows[0]?.['company_id'] as number) ?? null;
  }

  async assignWorkcenter(userId: number, workcenterId: number, q?: QueryRunner): Promise<void> {
    await this.run<ResultSetHeader>(
      q,
      'INSERT INTO user_workcenters (user_id, workcenter_id) VALUES (?, ?)',
      [userId, workcenterId],
    );
  }

  async findFullByUuid(uuid: string, q?: QueryRunner): Promise<{ id: number; uuid: string; email: string; active: number; role_name: string; company_id: number; first_name: string | null; last_name: string | null; dni: string | null; phone: string | null; address: string | null } | null> {
    const rows = await this.run<RowDataPacket[]>(
      q,
      `SELECT u.id, u.uuid, u.email, u.active, u.company_id, r.name AS role_name,
              p.first_name, p.last_name, p.dni, p.phone, p.address
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.uuid = ?`,
      [uuid],
    );
    return (rows[0] as any) ?? null;
  }

  async updateEmail(userId: number, email: string, q?: QueryRunner): Promise<void> {
    await this.run(q, 'UPDATE users SET email = ? WHERE id = ?', [email, userId]);
  }

  async updateProfile(userId: number, data: Partial<{ firstName: string; lastName: string; dni: string; phone: string; address: string }>, q?: QueryRunner): Promise<void> {
    const map: Record<string, string> = { firstName: 'first_name', lastName: 'last_name', dni: 'dni', phone: 'phone', address: 'address' };
    const fields = Object.entries(data)
      .filter(([, v]) => v !== undefined)
      .map(([k]) => `${map[k]} = ?`);
    const values = Object.entries(data)
      .filter(([, v]) => v !== undefined)
      .map(([, v]) => v);
    if (fields.length === 0) return;
    await this.run(q, `UPDATE profiles SET ${fields.join(', ')} WHERE user_id = ?`, [...values, userId]);
  }

  async setActive(userId: number, active: boolean, q?: QueryRunner): Promise<void> {
    await this.run(q, 'UPDATE users SET active = ? WHERE id = ?', [active ? 1 : 0, userId]);
  }

  async revokeTokensByUserId(userId: number, q?: QueryRunner): Promise<void> {
    await this.run(q, 'UPDATE refresh_tokens SET revoked = 1 WHERE user_id = ?', [userId]);
  }

  async deleteUser(userId: number, q?: QueryRunner): Promise<void> {
    await this.run(q, 'DELETE FROM users WHERE id = ?', [userId]);
  }

  async findAll(): Promise<RowDataPacket[]> {
    return this.db.query<RowDataPacket[]>(
      `SELECT u.uuid, u.email, u.active, u.created_at,
              r.name AS role,
              c.name AS company,
              p.first_name, p.last_name, p.dni, p.phone
       FROM users u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN companies c ON c.id = u.company_id
       LEFT JOIN profiles p ON p.user_id = u.id
       ORDER BY u.created_at DESC`,
    );
  }
}
