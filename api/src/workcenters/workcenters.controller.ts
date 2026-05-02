import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { extractIp, extractSource } from '../common/request.helpers';
import { CreateWorkcenterDto } from './dto/create-workcenter.dto';
import { QueryWorkcenterDto } from './dto/query-workcenter.dto';
import { WorkcentersService } from './workcenters.service';

@Controller('workcenters')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkcentersController {
  constructor(private readonly workcentersService: WorkcentersService) {}

  @Get()
  @Roles('SuperAdmin')
  findAll(@Query() query: QueryWorkcenterDto) {
    return this.workcentersService.findAll({ name: query.name, page: query.page ?? 1, limit: query.limit ?? 20 });
  }

  @Get('mine')
  @Roles('Owner')
  findMine(@Query() query: QueryWorkcenterDto, @CurrentUser() user: JwtPayload) {
    return this.workcentersService.findMine(user.id, { name: query.name, page: query.page ?? 1, limit: query.limit ?? 20 });
  }

  @Post('create-workcenters')
  @HttpCode(HttpStatus.CREATED)
  @Roles('SuperAdmin')
  create(@Body() dto: CreateWorkcenterDto, @Req() req: Request) {
    const user = req.user as JwtPayload;
    const ip = extractIp(req);
    const source = extractSource(req);
    return this.workcentersService.create(dto, user.id, ip, source);
  }
}
