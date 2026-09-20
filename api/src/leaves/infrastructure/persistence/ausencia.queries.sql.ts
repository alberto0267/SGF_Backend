import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { AusenciaConsultas, AusenciaReadModel } from '../../domain/ports/ausencia.queries';

@Injectable()
export class AusenciaQueriesSql implements AusenciaConsultas {
  constructor(private readonly db: DatabaseService) {}

  private listar(where: string, params: unknown[]): Promise<AusenciaReadModel[]> {
    return this.db.query<AusenciaReadModel[]>(
      `SELECT a.uuid,
              a.date AS fecha,
              a.modality AS modalidad,
              a.days AS dias,
              a.slot_start AS "tramoInicio",
              a.slot_end AS "tramoFin",
              a.hours AS horas,
              a.reason AS motivo,
              a.status AS estado,
              eu.uuid AS "empleadoUuid",
              TRIM(COALESCE(ep.first_name, '') || ' ' || COALESCE(ep.last_name, '')) AS "empleadoNombre",
              COALESCE(
                json_agg(
                  json_build_object(
                    'autor', TRIM(COALESCE(cap.first_name, '') || ' ' || COALESCE(cap.last_name, '')),
                    'texto', c.text,
                    'fecha', c.created_at
                  ) ORDER BY c.created_at
                ) FILTER (WHERE c.id IS NOT NULL),
                '[]'
              ) AS comentarios
       FROM absence_requests a
       JOIN users eu ON eu.id = a.employee_id
       LEFT JOIN profiles ep ON ep.user_id = eu.id
       LEFT JOIN absence_comments c ON c.absence_id = a.id
       LEFT JOIN profiles cap ON cap.user_id = c.author_id
       ${where}
       GROUP BY a.id, eu.uuid, ep.first_name, ep.last_name
       ORDER BY a.date DESC`,
      params,
    );
  }

  listarPorEmpleado(empleadoId: number): Promise<AusenciaReadModel[]> {
    return this.listar('WHERE a.employee_id = ?', [empleadoId]);
  }

  listarPorEmpresa(empresaId: number): Promise<AusenciaReadModel[]> {
    return this.listar('WHERE eu.company_id = ?', [empresaId]);
  }

  listarPorCentros(workcenterIds: number[]): Promise<AusenciaReadModel[]> {
    if (workcenterIds.length === 0) return Promise.resolve([]);
    const ph = workcenterIds.map(() => '?').join(', ');
    return this.listar(
      `WHERE a.employee_id IN (SELECT user_id FROM user_workcenters WHERE workcenter_id IN (${ph}))`,
      workcenterIds,
    );
  }
}
