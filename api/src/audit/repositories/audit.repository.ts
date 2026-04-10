import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface AuditEntry {
  actorId?: number;
  userId?: number;
  entityType: string;
  entityId?: number;
  action: string;
  source: 'web' | 'app';
  ip: string;
  before?: object;
  after?: object;
  status: 'success' | 'failed';
  errorMessage?: string;
}

@Injectable()
export class AuditRepository {
  constructor(private readonly db: DatabaseService) {}

  async insert(entry: AuditEntry): Promise<void> {
    await this.db.query(
      `INSERT INTO audit_log
        (actor_id, user_id, entity_type, entity_id, action, source, ip, before_data, after_data, status, error_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.actorId,
        entry.userId ?? null,
        entry.entityType,
        entry.entityId ?? null,
        entry.action,
        entry.source,
        entry.ip,
        entry.before ? JSON.stringify(entry.before) : null,
        entry.after ? JSON.stringify(entry.after) : null,
        entry.status,
        entry.errorMessage ?? null,
      ],
    );
  }
}
