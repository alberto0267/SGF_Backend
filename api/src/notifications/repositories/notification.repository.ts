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

  async create(userId: number, title: string, message: string, q?: QueryRunner): Promise<number> {
    const rows = await this.run<{ id: number }[]>(
      q,
      'INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?) RETURNING id',
      [userId, title, message],
    );
    return rows[0].id;
  }

  async findByUser(userId: number): Promise<any[]> {
    return this.db.query<any[]>(
      'SELECT id, title, message, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC',
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
