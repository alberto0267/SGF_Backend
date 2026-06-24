import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { VacacionConsultas, VacacionReadModel } from '../../domain/ports/vacacion.queries';

@Injectable()
export class VacacionQueriesSql implements VacacionConsultas {
  constructor(private readonly db: DatabaseService) {}

  private listar(where: string, params: unknown[]): Promise<VacacionReadModel[]> {
    return this.db.query<VacacionReadModel[]>(
      `SELECT v.uuid,
              v.subject AS asunto,
              v.start_date AS inicio,
              v.end_date AS fin,
              (v.end_date - v.start_date + 1) AS dias,
              v.status AS estado,
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
       FROM vacation_requests v
       JOIN users eu ON eu.id = v.employee_id
       LEFT JOIN profiles ep ON ep.user_id = eu.id
       LEFT JOIN vacation_comments c ON c.vacation_id = v.id
       LEFT JOIN profiles cap ON cap.user_id = c.author_id
       ${where}
       GROUP BY v.id, eu.uuid, ep.first_name, ep.last_name
       ORDER BY v.start_date DESC`,
      params,
    );
  }

  listarPorEmpleado(empleadoId: number): Promise<VacacionReadModel[]> {
    return this.listar('WHERE v.employee_id = ?', [empleadoId]);
  }

  listarPorEmpresa(empresaId: number): Promise<VacacionReadModel[]> {
    return this.listar('WHERE eu.company_id = ?', [empresaId]);
  }

  listarPorCentros(workcenterIds: number[]): Promise<VacacionReadModel[]> {
    if (workcenterIds.length === 0) return Promise.resolve([]);
    const ph = workcenterIds.map(() => '?').join(', ');
    return this.listar(
      `WHERE v.employee_id IN (SELECT user_id FROM user_workcenters WHERE workcenter_id IN (${ph}))`,
      workcenterIds,
    );
  }
}
