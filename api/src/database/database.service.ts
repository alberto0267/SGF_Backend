import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as mysql from 'mysql2/promise';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private pool: mysql.Pool;

  constructor() {
    this.pool = mysql.createPool({
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER ?? 'diapp',
      password: process.env.DB_PASSWORD ?? 'diapp',
      database: process.env.DB_NAME ?? 'diapp',
      waitForConnections: true,
      connectionLimit: 10,
    });
  }

  query<T = any>(sql: string, params?: any[]): Promise<T> {
    return this.pool.query(sql, params).then(([rows]) => rows as T);
  }

  async transaction<T>(
    fn: (query: <R = any>(sql: string, params?: any[]) => Promise<R>) => Promise<T>,
  ): Promise<T> {
    const conn = await this.pool.getConnection();
    await conn.query('START TRANSACTION');
    try {
      const q = <R = any>(sql: string, params?: any[]): Promise<R> =>
        conn.query(sql, params).then(([rows]: any) => rows as R);
      const result = await fn(q);
      await conn.query('COMMIT');
      return result;
    } catch (err) {
      await conn.query('ROLLBACK');
      throw err;
    } finally {
      conn.release();
    }
  }

  onModuleDestroy() {
    return this.pool.end();
  }
}
