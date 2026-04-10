import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuditModule } from '../audit/audit.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { UserRepository } from './repositories/user.repository';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    AuditModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),

    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'CHANGE_ME_IN_ENV',
      signOptions: {
        expiresIn: Number(process.env.JWT_EXPIRES_IN) || 900,
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, RolesGuard, UserRepository],
  exports: [JwtAuthGuard, RolesGuard, UserRepository],
})
export class AuthModule {}
