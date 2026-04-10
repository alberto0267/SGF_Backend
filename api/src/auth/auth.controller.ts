import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { extractIp, extractSource } from '../common/request.helpers';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { resetRateLimit, ThrottleLoginGuard } from './guards/throttle-login.guard';
import type { JwtPayload } from './interfaces/jwt-payload.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottleLoginGuard)
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = extractIp(req);
    const source = extractSource(req);
    const result = await this.authService.login(dto, ip, source);
    resetRateLimit(ip, dto.email);
    return result;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: JwtPayload, @Req() req: Request) {
    const ip = extractIp(req);
    const source = extractSource(req);
    await this.authService.logoutByUuid(user.sub, user.id, ip, source);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: JwtPayload) {
    return this.authService.getMe(user.sub);
  }
}
