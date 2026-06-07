import { Injectable } from '@nestjs/common';
import { ResultSetHeader, RowDataPacket } from 'mysql2';
import { DatabaseService } from '../../database/database.service';

type QueryRunner = <R = any>(sql: string, params?: any[]) => Promise<R>;

@Injectable()
export class NotificationRepository {
  constructor(private readonly db: DatabaseService) {}

  private run<R = any>(q: QueryRunner | undefined, sql: string, params?: any[]): Promise<R> {
    if (q) return q<R>(sql, params);
    return this.db.query<R>(sql, params);
  }

  async create(userId: number, title: string, message: string, q?: QueryRunner): Promise<number> {
    const result = await this.run<ResultSetHeader>(
      q,
      'INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)',
      [userId, title, message],
    );
    return result.insertId;
  }

  async findByUser(userId: number): Promise<RowDataPacket[]> {
    return this.db.query<RowDataPacket[]>(
      'SELECT id, title, message, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
      [userId],
    );
  }

  async markAsRead(id: number, userId: number): Promise<boolean> {
    const result = await this.db.query<ResultSetHeader>(
      'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
      [id, userId],
    );
    return result.affectedRows > 0;
  }

  async markAllAsRead(userId: number): Promise<void> {
    await this.db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [userId]);
  }
}
