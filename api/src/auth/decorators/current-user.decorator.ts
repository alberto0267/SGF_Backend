import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Extrae el usuario autenticado del request (lo pone JwtStrategy).
 *
 * Uso en un controller:
 *   @UseGuards(JwtAuthGuard)
 *   @Get('me')
 *   getMe(@CurrentUser() user: JwtPayload) {
 *     return user.sub; // uuid del usuario
 *   }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as JwtPayload;
  },
);
