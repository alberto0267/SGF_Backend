import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * JwtStrategy intercepta cada request que use JwtAuthGuard.
 * Passport extrae automáticamente el token del header:
 *   Authorization: Bearer <token>
 *
 * Si la firma es válida y no está expirado, llama a validate()
 * y pone el resultado en req.user.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'CHANGE_ME_IN_ENV',
    });
  }

  validate(payload: JwtPayload): JwtPayload {
    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException('Token inválido');
    }

    // Lo que retornamos aquí es lo que queda en req.user
    return { sub: payload.sub, id: payload.id, email: payload.email, role: payload.role };
  }
}
