import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { Ausencia } from '../../domain/ausencia';
import { AusenciaRepository } from '../../domain/ports/ausencia.repository';
import { Comentario } from '../../domain/value-objects/comentario';
import { EstadoSolicitud } from '../../domain/value-objects/estado';
import { ModalidadAusencia } from '../../domain/value-objects/modalidad-ausencia';

@Injectable()
export class AusenciaSqlRepository implements AusenciaRepository {
  constructor(private readonly db: DatabaseService) {}

  async guardar(ausencia: Ausencia): Promise<void> {
    const m = ausencia.modalidad;
    await this.db.transaction(async (q) => {
      const rows = await q<{ id: number }[]>(
        `INSERT INTO absence_requests (uuid, employee_id, date, modality, days, slot_start, slot_end, hours, reason, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (uuid) DO UPDATE
           SET date = EXCLUDED.date,
               modality = EXCLUDED.modality,
               days = EXCLUDED.days,
               slot_start = EXCLUDED.slot_start,
               slot_end = EXCLUDED.slot_end,
               hours = EXCLUDED.hours,
               reason = EXCLUDED.reason,
               status = EXCLUDED.status
         RETURNING id`,
        [ausencia.id, ausencia.empleadoId, ausencia.fecha, m.tipo, m.cantidadDias, m.tramoInicio, m.tramoFin, m.horas, ausencia.motivo, ausencia.estado],
      );
      const ausenciaId = rows[0].id;

      await q('DELETE FROM absence_comments WHERE absence_id = ?', [ausenciaId]);
      for (const c of ausencia.comentarios) {
        await q(
          'INSERT INTO absence_comments (absence_id, author_id, text, created_at) VALUES (?, ?, ?, ?)',
          [ausenciaId, c.autorId, c.texto, c.fecha],
        );
      }
    });
  }

  async buscarPorId(id: string): Promise<Ausencia | null> {
    const rows = await this.db.query<any[]>(
      `SELECT id, uuid, employee_id, date, modality, days, slot_start, slot_end, hours, reason, status
       FROM absence_requests WHERE uuid = ?`,
      [id],
    );
    if (rows.length === 0) return null;
    const r = rows[0];

    const comentRows = await this.db.query<any[]>(
      'SELECT author_id, text, created_at FROM absence_comments WHERE absence_id = ? ORDER BY created_at',
      [r.id],
    );
    const comentarios = comentRows.map((c) =>
      Comentario.fromPersistence(c.author_id, c.text, new Date(c.created_at)),
    );

    const modalidad = ModalidadAusencia.fromPersistence(
      r.modality,
      r.days,
      r.slot_start,
      r.slot_end,
      r.hours !== null ? Number(r.hours) : null,
    );

    return Ausencia.fromPersistence(
      r.uuid,
      r.employee_id,
      new Date(r.date),
      modalidad,
      r.reason,
      r.status as EstadoSolicitud,
      comentarios,
    );
  }
}
