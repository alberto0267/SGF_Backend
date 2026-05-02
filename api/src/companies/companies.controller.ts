import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { extractIp, extractSource } from '../common/request.helpers';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { QueryCompanyDto } from './dto/query-company.dto';
import { UpdateCompanyDto, UpdateCompanyActiveDto } from './dto/update-company.dto';

@Controller('companies')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SuperAdmin')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get('select')
  findAllForSelect(@Query() query: QueryCompanyDto) {
    return this.companiesService.findAllForSelect({ name: query.name, nif: query.nif });
  }

  @Get()
  findAll(@Query() query: QueryCompanyDto) {
    return this.companiesService.findAll({ name: query.name, nif: query.nif, page: query.page ?? 1, limit: query.limit ?? 20 });
  }

  @Post('create-company')
  @HttpCode(HttpStatus.CREATED)
  createCompany(@Body() dto: CreateCompanyDto, @Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.companiesService.create(dto, user.id, extractIp(req), extractSource(req));
  }

  @Patch(':uuid')
  update(@Param('uuid') uuid: string, @Body() dto: UpdateCompanyDto, @Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.companiesService.update(uuid, dto, user.id, extractIp(req), extractSource(req));
  }

  @Patch(':uuid/active')
  setActive(@Param('uuid') uuid: string, @Body() dto: UpdateCompanyActiveDto, @Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.companiesService.setActive(uuid, dto, user.id, extractIp(req), extractSource(req));
  }

  @Delete(':uuid')
  @HttpCode(HttpStatus.NO_CONTENT)
  hardDelete(@Param('uuid') uuid: string, @Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.companiesService.hardDelete(uuid, user.id, extractIp(req), extractSource(req));
  }
}
