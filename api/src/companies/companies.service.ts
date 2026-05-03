import { ConflictException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { DatabaseService } from '../database/database.service';
import { AuditService } from '../audit/audit.service';
import { UserRepository } from '../auth/repositories/user.repository';
import { CompanyRepository } from './repositories/company.repository';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto, UpdateCompanyActiveDto } from './dto/update-company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auditService: AuditService,
    private readonly userRepo: UserRepository,
    private readonly companyRepo: CompanyRepository,
  ) {}

  async findAllForSelect(filters: { name?: string; nif?: string }) {
    return this.companyRepo.findAllForSelect(filters);
  }

  async findAll(filters: { name?: string; nif?: string; page: number; limit: number }) {
    const { data, total } = await this.companyRepo.findAll(filters);
    return { data, total, page: filters.page, limit: filters.limit, totalPages: Math.ceil(total / filters.limit) };
  }

  async create(dto: CreateCompanyDto, actorId: number, ip: string, source: 'web' | 'app') {
    return this.db.transaction(async (query) => {
      // ─── Validaciones de unicidad ──────────────────────────────────────────
      if (await this.companyRepo.existsByNif(dto.nif, query)) {
        throw new ConflictException('Ya existe una empresa con ese NIF');
      }
      if (await this.userRepo.existsByEmail(dto.owner.email, query)) {
        throw new ConflictException('Ya existe un usuario con ese email');
      }
      if (await this.userRepo.existsByDni(dto.owner.dni, query)) {
        throw new ConflictException('Ya existe un usuario con ese DNI');
      }

      // ─── Obtener role_id de 'Owner' ────────────────────────────────────────
      const ownerRoleId = await this.userRepo.findRoleIdByName('Owner', query);
      if (!ownerRoleId) {
        throw new InternalServerErrorException("Rol 'Owner' no encontrado");
      }

      // ─── Crear empresa ─────────────────────────────────────────────────────
      const companyUuid = crypto.randomUUID();
      const companyId = await this.companyRepo.create(
        { uuid: companyUuid, name: dto.name, nif: dto.nif, address: dto.address, phone: dto.phone },
        query,
      );

      // ─── Crear owner ───────────────────────────────────────────────────────
      const uuid = crypto.randomUUID();
      const passwordHash = await bcrypt.hash(dto.owner.password, 10);

      const userId = await this.userRepo.create(
        { uuid, email: dto.owner.email, password: passwordHash, roleId: ownerRoleId, companyId },
        query,
      );

      await this.userRepo.createProfile(
        {
          userId,
          firstName: dto.owner.firstName,
          lastName: dto.owner.lastName,
          dni: dto.owner.dni,
          phone: dto.owner.phone,
        },
        query,
      );

      const workcenterUuid = crypto.randomUUID();
      const workcenterId = await this.companyRepo.createWorkCenter(
        { uuid: workcenterUuid, name: dto.name, companyId, address: dto.address },
        query,
      );

      const extraWorkcenters: Array<{ uuid: string; name: string; address: string | null; email: string | null }> = [];
      for (const wc of dto.workCenters ?? []) {
        const wcUuid = crypto.randomUUID();
        await this.companyRepo.createWorkCenter(
          { uuid: wcUuid, name: wc.name, companyId, address: wc.address, email: wc.email },
          query,
        );
        extraWorkcenters.push({ uuid: wcUuid, name: wc.name, address: wc.address ?? null, email: wc.email ?? null });
      }

      const result = {
        company: {
          id: companyId,
          uuid: companyUuid,
          name: dto.name,
          nif: dto.nif,
          address: dto.address,
          phone: dto.phone ?? null,
          active: true,
        },
        owner: {
          uuid,
          email: dto.owner.email,
          firstName: dto.owner.firstName,
          lastName: dto.owner.lastName,
        },
        workcenter: { uuid: workcenterUuid, name: dto.name, address: dto.address },
        extraWorkcenters,
      };

      await this.auditService.log({
        actorId,
        entityType: 'company',
        entityId: companyId,
        action: 'create',
        source,
        ip,
        after: result.company,
        status: 'success',
      });

      return result;
    });
  }

  async update(uuid: string, dto: UpdateCompanyDto, actorId: number, ip: string, source: 'web' | 'app') {
    const company = await this.companyRepo.findFullByUuid(uuid);
    if (!company) throw new NotFoundException('Empresa no encontrada');

    if (dto.nif && await this.companyRepo.existsByNifExcluding(dto.nif, company.id)) {
      throw new ConflictException('Ya existe una empresa con ese NIF');
    }

    await this.companyRepo.update(company.id, dto);

    await this.auditService.log({
      actorId,
      entityType: 'company',
      entityId: company.id,
      action: 'update',
      source,
      ip,
      before: company,
      after: { ...company, ...dto },
      status: 'success',
    });

    return { ...company, ...dto };
  }

  async setActive(uuid: string, dto: UpdateCompanyActiveDto, actorId: number, ip: string, source: 'web' | 'app') {
    const company = await this.companyRepo.findFullByUuid(uuid);
    if (!company) throw new NotFoundException('Empresa no encontrada');

    await this.db.transaction(async (q) => {
      await this.companyRepo.setActive(company.id, dto.active, q);
      await this.companyRepo.setUsersActive(company.id, dto.active, q);
      await this.companyRepo.setWorkcentersActive(company.id, dto.active, q);
      if (!dto.active) {
        await this.companyRepo.revokeTokensByCompanyId(company.id, q);
      }
    });

    await this.auditService.log({
      actorId,
      entityType: 'company',
      entityId: company.id,
      action: dto.active ? 'activate' : 'deactivate',
      source,
      ip,
      before: company,
      status: 'success',
    });

    return { uuid, active: dto.active };
  }

  async hardDelete(uuid: string, actorId: number, ip: string, source: 'web' | 'app') {
    const company = await this.companyRepo.findFullByUuid(uuid);
    if (!company) throw new NotFoundException('Empresa no encontrada');

    const userIds = await this.companyRepo.getUserIdsByCompanyId(company.id);

    await this.db.transaction(async (q) => {
      if (userIds.length > 0) {
        await this.companyRepo.deleteUserWorkcenters(userIds, q);
        await this.companyRepo.deleteProfiles(userIds, q);
        await this.companyRepo.deleteRefreshTokens(userIds, q);
        await this.companyRepo.deleteMobileTokens(userIds, q);
        await this.companyRepo.deleteNotifications(userIds, q);
        await this.companyRepo.deletePdfs(userIds, q);
        await this.companyRepo.deleteRefunds(userIds, q);
        await this.companyRepo.deleteTruckDeliveries(userIds, q);
        await this.companyRepo.deleteCashRegisterClosures(userIds, q);
        await this.companyRepo.deleteLeaveRequests(userIds, q);
        await this.companyRepo.deleteOvertimes(userIds, q);
        await this.companyRepo.deleteBakery(userIds, q);
        await this.companyRepo.nullifyAuditActor(userIds, q);
      }
      await this.companyRepo.deleteUsers(company.id, q);
      await this.companyRepo.deleteWorkcenters(company.id, q);
      await this.companyRepo.deleteCompany(company.id, q);
    });

    await this.auditService.log({
      actorId,
      entityType: 'company',
      entityId: company.id,
      action: 'delete',
      source,
      ip,
      before: company,
      status: 'success',
    });
  }
}
