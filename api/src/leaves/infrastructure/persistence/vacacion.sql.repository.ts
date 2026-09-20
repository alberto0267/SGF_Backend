import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { VacacionRepository } from '../../domain/ports/vacacion.repository';
import { Vacacion } from '../../domain/vacacion';
import { Comentario } from '../../domain/value-objects/comentario';
import { EstadoSolicitud } from '../../domain/value-objects/estado';
import { Rango } from '../../domain/value-objects/rango';

@Injectable()
export class VacacionSqlRepository implements VacacionRepository {
  constructor(private readonly db: DatabaseService) {}

  async guardar(vacacion: Vacacion): Promise<void> {
    await this.db.transaction(async (q) => {
      const rows = await q<{ id: number }[]>(
        `INSERT INTO vacation_requests (uuid, employee_id, subject, start_date, end_date, status)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (uuid) DO UPDATE
           SET subject = EXCLUDED.subject,
               start_date = EXCLUDED.start_date,
               end_date = EXCLUDED.end_date,
               status = EXCLUDED.status
         RETURNING id`,
        [vacacion.id, vacacion.empleadoId, vacacion.asunto, vacacion.rango.inicio, vacacion.rango.fin, vacacion.estado],
      );
      const vacacionId = rows[0].id;

      await q('DELETE FROM vacation_comments WHERE vacation_id = ?', [vacacionId]);
      for (const c of vacacion.comentarios) {
        await q(
          'INSERT INTO vacation_comments (vacation_id, author_id, text, created_at) VALUES (?, ?, ?, ?)',
          [vacacionId, c.autorId, c.texto, c.fecha],
        );
      }
    });
  }

  async buscarPorId(id: string): Promise<Vacacion | null> {
    const rows = await this.db.query<any[]>(
      `SELECT id, uuid, employee_id, subject, start_date, end_date, status
       FROM vacation_requests WHERE uuid = ?`,
      [id],
    );
    if (rows.length === 0) return null;
    const r = rows[0];

    const comentRows = await this.db.query<any[]>(
      'SELECT author_id, text, created_at FROM vacation_comments WHERE vacation_id = ? ORDER BY created_at',
      [r.id],
    );
    const comentarios = comentRows.map((c) =>
      Comentario.fromPersistence(c.author_id, c.text, new Date(c.created_at)),
    );

    const rango = Rango.crear(new Date(r.start_date), new Date(r.end_date));
    return Vacacion.fromPersistence(r.uuid, r.employee_id, r.subject, rango, r.status as EstadoSolicitud, comentarios);
  }

  async diasUsadosEnAnio(empleadoId: number, anio: number, excluyendoId?: string): Promise<number> {
    const params: unknown[] = [empleadoId, anio];
    let extra = '';
    if (excluyendoId) {
      extra = ' AND uuid <> ?';
      params.push(excluyendoId);
    }
    const rows = await this.db.query<{ total: string }[]>(
      `SELECT COALESCE(SUM(end_date - start_date + 1), 0) AS total
       FROM vacation_requests
       WHERE employee_id = ? AND status <> 'rejected' AND EXTRACT(YEAR FROM start_date) = ?${extra}`,
      params,
    );
    return Number(rows[0].total);
  }

  async haySolapamiento(empleadoId: number, rango: Rango, excluyendoId?: string): Promise<boolean> {
    const params: unknown[] = [empleadoId, rango.fin, rango.inicio];
    let extra = '';
    if (excluyendoId) {
      extra = ' AND uuid <> ?';
      params.push(excluyendoId);
    }
    const rows = await this.db.query<any[]>(
      `SELECT 1 FROM vacation_requests
       WHERE employee_id = ? AND status <> 'rejected'
         AND start_date <= ? AND end_date >= ?${extra}
       LIMIT 1`,
      params,
    );
    return rows.length > 0;
  }
}
