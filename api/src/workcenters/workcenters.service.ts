import { Injectable, NotFoundException } from '@nestjs/common';
import * as crypto from 'crypto';
import { AuditService } from '../audit/audit.service';
import { CompanyRepository } from '../companies/repositories/company.repository';
import { CreateWorkcenterDto } from './dto/create-workcenter.dto';
import { WorkcenterRepository } from './repositories/workcenter.repository';

@Injectable()
export class WorkcentersService {
  constructor(
    private readonly companyRepo: CompanyRepository,
    private readonly workcenterRepo: WorkcenterRepository,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateWorkcenterDto, actorId: number, ip: string, source: 'web' | 'app') {
    const company = await this.companyRepo.findByUuid(dto.companyUuid);
    if (!company) {
      throw new NotFoundException('Empresa no encontrada');
    }

    const uuid = crypto.randomUUID();
    const id = await this.workcenterRepo.create({
      uuid,
      name: dto.name,
      address: dto.address,
      email: dto.email,
      companyId: company.id,
    });

    const result = {
      id,
      uuid,
      name: dto.name,
      address: dto.address,
      email: dto.email,
      companyId: company.id,
      active: true,
    };

    await this.auditService.log({
      actorId,
      entityType: 'workcenter',
      entityId: id,
      action: 'create',
      source,
      ip,
      after: result,
      status: 'success',
    });

    return result;
  }
}
