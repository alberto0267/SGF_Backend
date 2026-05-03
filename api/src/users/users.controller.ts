import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import * as crypto from 'crypto';
import type { Request } from 'express';
import { extractIp, extractSource } from '../common/request.helpers';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CreateMemberDto } from './dto/create-member.dto';
import { UpdateMemberDto, UpdateMemberActiveDto, UpdateMemberRoleDto } from './dto/update-member.dto';
import { UsersService } from './users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SuperAdmin', 'Owner')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles('SuperAdmin')
  findAll() {
    return this.usersService.findAll();
  }

  @Post('create-manager')
  @HttpCode(HttpStatus.CREATED)
  createManager(@Body() dto: CreateMemberDto, @CurrentUser() user: JwtPayload, @Req() req: Request) {
    const uuid = crypto.randomUUID();
    return this.usersService.create('Manager', dto, uuid, user, extractIp(req), extractSource(req));
  }

  @Post('create-employee')
  @HttpCode(HttpStatus.CREATED)
  createEmployee(@Body() dto: CreateMemberDto, @CurrentUser() user: JwtPayload, @Req() req: Request) {
    const uuid = crypto.randomUUID();
    return this.usersService.create('Employee', dto, uuid, user, extractIp(req), extractSource(req));
  }

  @Patch(':uuid')
  update(@Param('uuid') uuid: string, @Body() dto: UpdateMemberDto, @CurrentUser() user: JwtPayload, @Req() req: Request) {
    return this.usersService.update(uuid, dto, user, extractIp(req), extractSource(req));
  }

  @Patch(':uuid/role')
  @Roles('SuperAdmin')
  updateRole(@Param('uuid') uuid: string, @Body() dto: UpdateMemberRoleDto, @Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.usersService.updateRole(uuid, dto, user.id, extractIp(req), extractSource(req));
  }

  @Patch(':uuid/active')
  setActive(@Param('uuid') uuid: string, @Body() dto: UpdateMemberActiveDto, @CurrentUser() user: JwtPayload, @Req() req: Request) {
    return this.usersService.setActive(uuid, dto, user, extractIp(req), extractSource(req));
  }

  @Delete(':uuid')
  @HttpCode(HttpStatus.NO_CONTENT)
  hardDelete(@Param('uuid') uuid: string, @CurrentUser() user: JwtPayload, @Req() req: Request) {
    return this.usersService.hardDelete(uuid, user, extractIp(req), extractSource(req));
  }
}
