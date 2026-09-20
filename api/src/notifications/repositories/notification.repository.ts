import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

type QueryRunner = <R = any>(sql: string, params?: any[]) => Promise<R>;

@Injectable()
export class NotificationRepository {
  constructor(private readonly db: DatabaseService) {}

  private run<R = any>(q: QueryRunner | undefined, sql: string, params?: any[]): Promise<R> {
    if (q) return q<R>(sql, params);
    return this.db.query<R>(sql, params);
  }

  async create(
    userId: number,
    title: string,
    message: string,
    overtimeRequestId?: number,
    q?: QueryRunner,
  ): Promise<number> {
    const rows = await this.run<{ id: number }[]>(
      q,
      'INSERT INTO notifications (user_id, title, message, overtime_request_id) VALUES (?, ?, ?, ?) RETURNING id',
      [userId, title, message, overtimeRequestId ?? null],
    );
    return rows[0].id;
  }

  async findByUser(userId: number): Promise<any[]> {
    return this.db.query<any[]>(
      `SELECT n.id, n.title, n.message, n.is_read, n.created_at, o.uuid AS overtime_request_uuid
       FROM notifications n
       LEFT JOIN overtime_requests o ON o.id = n.overtime_request_id
       WHERE n.user_id = ?
       ORDER BY n.created_at DESC`,
      [userId],
    );
  }

  async markAsRead(id: number, userId: number): Promise<boolean> {
    const rows = await this.db.query<{ id: number }[]>(
      'UPDATE notifications SET is_read = true WHERE id = ? AND user_id = ? RETURNING id',
      [id, userId],
    );
    return rows.length > 0;
  }

  async markAllAsRead(userId: number): Promise<void> {
    await this.db.query('UPDATE notifications SET is_read = true WHERE user_id = ? AND is_read = false', [userId]);
  }
}
