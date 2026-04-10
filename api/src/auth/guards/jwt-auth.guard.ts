import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Decora rutas que requieren autenticación:
 *
 *   @UseGuards(JwtAuthGuard)
 *   @Get('me')
 *   getMe(@CurrentUser() user: JwtPayload) { ... }
 *
 * Si el token es inválido, expirado o no existe → 401 automático.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
