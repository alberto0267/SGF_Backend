import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { DirectorioUsuarios } from '../../domain/ports/directorio-usuarios';

@Injectable()
export class DirectorioUsuariosSql implements DirectorioUsuarios {
  constructor(private readonly db: DatabaseService) {}

  async empresaDe(usuarioId: number): Promise<number | null> {
    const rows = await this.db.query<{ company_id: number }[]>(
      'SELECT company_id FROM users WHERE id = ?',
      [usuarioId],
    );
    return rows[0]?.company_id ?? null;
  }

  async centrosDe(usuarioId: number): Promise<number[]> {
    const rows = await this.db.query<{ workcenter_id: number }[]>(
      'SELECT workcenter_id FROM user_workcenters WHERE user_id = ?',
      [usuarioId],
    );
    return rows.map((r) => r.workcenter_id);
  }

  async ownersDeEmpresa(empresaId: number): Promise<number[]> {
    const rows = await this.db.query<{ id: number }[]>(
      `SELECT u.id FROM users u
       JOIN roles r ON r.id = u.role_id
       WHERE u.company_id = ? AND r.name = 'Owner' AND u.active = true`,
      [empresaId],
    );
    return rows.map((r) => r.id);
  }
}
