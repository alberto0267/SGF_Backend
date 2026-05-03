import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/login.dto';
import { AuthResponse, MeResponse } from './interfaces/auth-response.interface';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { UserRepository, UserRow } from './repositories/user.repository';

const DUMMY_HASH = '$2b$10$abcdefghijklmnopqrstuvuXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 30;
const REFRESH_TOKEN_EXPIRES_DAYS = 7;

@Injectable()
export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly jwt: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async login(dto: LoginDto, ip: string, source: 'web' | 'app'): Promise<AuthResponse> {
    const user = await this.userRepo.findByEmail(dto.email);

    if (!user) {
      await bcrypt.compare(dto.password, DUMMY_HASH);
      await this.auditService.log({ entityType: 'auth', action: 'login', source, ip, status: 'failed', errorMessage: 'Email no encontrado' });
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Credenciales inválidas' });
    }

    if (!user.active) {
      await bcrypt.compare(dto.password, DUMMY_HASH);
      await this.auditService.log({ actorId: user.id, entityType: 'auth', action: 'login', source, ip, status: 'failed', errorMessage: 'Usuario inactivo' });
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Credenciales inválidas' });
    }

    if (user.locked_until && user.locked_until > new Date()) {
      await this.auditService.log({ actorId: user.id, entityType: 'auth', action: 'login', source, ip, status: 'failed', errorMessage: 'Cuenta bloqueada' });
      throw new UnauthorizedException({ code: 'ACCOUNT_LOCKED', message: 'Cuenta bloqueada temporalmente. Inténtalo más tarde.' });
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password);

    if (!passwordValid) {
      await this.handleFailedAttempt(user);
      await this.auditService.log({ actorId: user.id, entityType: 'auth', action: 'login', source, ip, status: 'failed', errorMessage: 'Contraseña incorrecta' });
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Credenciales inválidas' });
    }

    await this.userRepo.resetFailedAttempts(user.id);
    await this.auditService.log({ actorId: user.id, entityType: 'auth', action: 'login', source, ip, status: 'success' });

    return this.generateTokens(user);
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const tokenHash = this.hashToken(refreshToken);
    const user = await this.userRepo.findByRefreshToken(tokenHash);

    if (!user) {
      throw new UnauthorizedException({ code: 'INVALID_TOKEN', message: 'Refresh token inválido o expirado.' });
    }

    await this.userRepo.revokeRefreshToken(tokenHash);

    const newRefreshToken = crypto.randomBytes(32).toString('hex');
    await this.saveRefreshToken(user.id, newRefreshToken);

    const payload: JwtPayload = { sub: user.uuid, id: user.id, email: user.email, role: user.role_name };
    const accessToken = this.jwt.sign(payload);

    return { accessToken, refreshToken: newRefreshToken, expiresIn: Number(process.env.JWT_EXPIRES_IN) || 900 };
  }

  async logoutByUuid(uuid: string, actorId: number, ip: string, source: 'web' | 'app'): Promise<void> {
    await this.userRepo.revokeAllTokensByUuid(uuid);
    await this.auditService.log({ actorId, entityType: 'auth', action: 'logout', source, ip, status: 'success' });
  }

  async getMe(uuid: string): Promise<MeResponse> {
    const u = await this.userRepo.findMeByUuid(uuid);

    if (!u) throw new UnauthorizedException({ code: 'INVALID_TOKEN', message: 'Token de acceso inválido.' });

    const name = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email;

    return {
      uuid: u.uuid,
      email: u.email,
      role: u.role_name,
      name,
      companyName: u.company_name,
      active: u.active === 1,
    };
  }

  private async handleFailedAttempt(user: Pick<UserRow, 'id' | 'failed_login_attempts'>): Promise<void> {
    const newCount = user.failed_login_attempts + 1;
    const lockedUntil =
      newCount >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000)
        : null;
    await this.userRepo.incrementFailedAttempts(user.id, newCount, lockedUntil);
  }

  private async generateTokens(user: Pick<UserRow, 'id' | 'uuid' | 'email' | 'role_name'>): Promise<AuthResponse> {
    const payload: JwtPayload = { sub: user.uuid, id: user.id, email: user.email, role: user.role_name };
    const accessToken = this.jwt.sign(payload);
    const refreshToken = crypto.randomBytes(32).toString('hex');

    await this.saveRefreshToken(user.id, refreshToken);

    return {
      accessToken,
      refreshToken,
      expiresIn: Number(process.env.JWT_EXPIRES_IN) || 900,
    };
  }

  private async saveRefreshToken(userId: number, plainToken: string): Promise<void> {
    const tokenHash = this.hashToken(plainToken);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRES_DAYS);
    await this.userRepo.saveRefreshToken(userId, tokenHash, expiresAt);
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
