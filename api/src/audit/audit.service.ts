import { Injectable } from '@nestjs/common';
import { AuditEntry, AuditRepository } from './repositories/audit.repository';

@Injectable()
export class AuditService {
  constructor(private readonly auditRepo: AuditRepository) {}

  async log(entry: AuditEntry): Promise<void> {
    await this.auditRepo.insert(entry);
  }
}
