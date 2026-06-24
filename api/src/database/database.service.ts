import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT) || 5432,
      user: process.env.DB_USER ?? 'sgf',
      password: process.env.DB_PASSWORD ?? 'sgf',
      database: process.env.DB_NAME ?? 'sgf',
      max: 10,
    });
  }

  private toPositional(sql: string): string {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
  }

  query<T = any>(sql: string, params?: any[]): Promise<T> {
    return this.pool.query(this.toPositional(sql), params).then(r => r.rows as T);
  }

  async transaction<T>(
    fn: (query: <R = any>(sql: string, params?: any[]) => Promise<R>) => Promise<T>,
  ): Promise<T> {
    const conn: PoolClient = await this.pool.connect();
    await conn.query('BEGIN');
    try {
      const q = <R = any>(sql: string, params?: any[]): Promise<R> =>
        conn.query(this.toPositional(sql), params).then(r => r.rows as R);
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
