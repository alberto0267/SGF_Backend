import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuditService } from '../audit/audit.service';
import { UserRepository } from '../auth/repositories/user.repository';
import { CompanyRepository } from '../companies/repositories/company.repository';
import { DatabaseService } from '../database/database.service';
import { WorkcenterRepository } from '../workcenters/repositories/workcenter.repository';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto, UpdateMemberActiveDto } from './dto/update-member.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly companyRepo: CompanyRepository,
    private readonly workcenterRepo: WorkcenterRepository,
    private readonly db: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

  async findAll() {
    return this.userRepo.findAll();
  }

  async create(
    role: 'Manager' | 'Employee',
    dto: CreateMemberDto,
    uuid: string,
    currentUser: JwtPayload,
    ip: string,
    source: 'web' | 'app',
  ) {
    let ownerCompanyId: number | null = null;
    if (currentUser.role === 'Owner') {
      ownerCompanyId = await this.userRepo.findCompanyIdByUserId(currentUser.id);
    }

    const hashed = await bcrypt.hash(dto.password, 10);

    const result = await this.db.transaction(async (q) => {
      if (await this.userRepo.existsByEmail(dto.email, q)) {
        throw new ConflictException('El email ya está en uso');
      }

      if (dto.dni && (await this.userRepo.existsByDni(dto.dni, q))) {
        throw new ConflictException('El DNI ya está en uso');
      }

      const company = await this.companyRepo.findByUuid(dto.companyUuid, q);
      if (!company) throw new NotFoundException('Empresa no encontrada');

      if (currentUser.role === 'Owner' && company.id !== ownerCompanyId) {
        throw new ForbiddenException('No puedes crear usuarios en una empresa que no es la tuya');
      }

      const workcenter = await this.workcenterRepo.findByUuid(dto.workcenterUuid, q);
      if (!workcenter) throw new NotFoundException('Centro de trabajo no encontrado');

      if (workcenter.company_id !== company.id) {
        throw new BadRequestException('El centro de trabajo no pertenece a la empresa indicada');
      }

      const roleId = await this.userRepo.findRoleIdByName(role, q);

      const userId = await this.userRepo.create(
        { uuid, email: dto.email, password: hashed, roleId: roleId!, companyId: company.id },
        q,
      );

      await this.userRepo.createProfile(
        {
          userId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          dni: dto.dni,
          phone: dto.phone,
          address: dto.address,
        },
        q,
      );

      await this.userRepo.assignWorkcenter(userId, workcenter.id, q);

      return { uuid, email: dto.email, role, companyUuid: dto.companyUuid, workcenterUuid: dto.workcenterUuid };
    });

    await this.auditService.log({
      actorId: currentUser.id,
      entityType: 'user',
      action: `create_${role.toLowerCase()}`,
      source,
      ip,
      after: result,
      status: 'success',
    });

    return result;
  }

  async update(uuid: string, dto: UpdateMemberDto, currentUser: JwtPayload, ip: string, source: 'web' | 'app') {
    const target = await this.userRepo.findFullByUuid(uuid);
    if (!target) throw new NotFoundException('Usuario no encontrado');

    await this.checkPermission(currentUser, target);

    if (dto.email && await this.userRepo.existsByEmail(dto.email)) {
      throw new ConflictException('El email ya está en uso');
    }

    if (dto.dni && await this.userRepo.existsByDni(dto.dni)) {
      throw new ConflictException('El DNI ya está en uso');
    }

    await this.db.transaction(async (q) => {
      if (dto.email) await this.userRepo.updateEmail(target.id, dto.email, q);
      const { email: _e, ...profileFields } = dto;
      await this.userRepo.updateProfile(target.id, profileFields, q);
    });

    await this.auditService.log({
      actorId: currentUser.id,
      entityType: 'user',
      entityId: target.id,
      action: 'update',
      source,
      ip,
      before: target,
      after: { ...target, ...dto },
      status: 'success',
    });

    return { ...target, ...dto };
  }

  async setActive(uuid: string, dto: UpdateMemberActiveDto, currentUser: JwtPayload, ip: string, source: 'web' | 'app') {
    const target = await this.userRepo.findFullByUuid(uuid);
    if (!target) throw new NotFoundException('Usuario no encontrado');

    await this.checkPermission(currentUser, target);

    await this.db.transaction(async (q) => {
      await this.userRepo.setActive(target.id, dto.active, q);
      if (!dto.active) await this.userRepo.revokeTokensByUserId(target.id, q);
    });

    await this.auditService.log({
      actorId: currentUser.id,
      entityType: 'user',
      entityId: target.id,
      action: dto.active ? 'activate' : 'deactivate',
      source,
      ip,
      before: target,
      status: 'success',
    });

    return { uuid, active: dto.active };
  }

  async hardDelete(uuid: string, currentUser: JwtPayload, ip: string, source: 'web' | 'app') {
    const target = await this.userRepo.findFullByUuid(uuid);
    if (!target) throw new NotFoundException('Usuario no encontrado');

    await this.checkPermission(currentUser, target);

    await this.db.transaction(async (q) => {
      await this.companyRepo.deleteUserWorkcenters([target.id], q);
      await this.companyRepo.deleteProfiles([target.id], q);
      await this.companyRepo.deleteRefreshTokens([target.id], q);
      await this.companyRepo.deleteMobileTokens([target.id], q);
      await this.companyRepo.deleteNotifications([target.id], q);
      await this.companyRepo.deletePdfs([target.id], q);
      await this.companyRepo.deleteRefunds([target.id], q);
      await this.companyRepo.deleteTruckDeliveries([target.id], q);
      await this.companyRepo.deleteCashRegisterClosures([target.id], q);
      await this.companyRepo.deleteLeaveRequests([target.id], q);
      await this.companyRepo.deleteOvertimes([target.id], q);
      await this.companyRepo.deleteBakery([target.id], q);
      await this.companyRepo.nullifyAuditActor([target.id], q);
      await this.userRepo.deleteUser(target.id, q);
    });

    await this.auditService.log({
      actorId: currentUser.id,
      entityType: 'user',
      entityId: target.id,
      action: 'delete',
      source,
      ip,
      before: target,
      status: 'success',
    });
  }

  private async checkPermission(currentUser: JwtPayload, target: { role_name: string; company_id: number }) {
    if (currentUser.role === 'SuperAdmin') return;

    if (target.role_name === 'SuperAdmin' || target.role_name === 'Owner') {
      throw new ForbiddenException('No tienes permisos para gestionar este usuario');
    }

    const ownerCompanyId = await this.userRepo.findCompanyIdByUserId(currentUser.id);
    if (target.company_id !== ownerCompanyId) {
      throw new ForbiddenException('No puedes gestionar usuarios de otra empresa');
    }
  }
}
