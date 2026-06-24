import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CreateOvertimeRequestDto } from './dto/create-overtime-request.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { QueryOvertimeDto } from './dto/query-overtime.dto';
import { QueryPaymentDto } from './dto/query-payment.dto';
import { OvertimesService } from './overtimes.service';

@Controller('overtimes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OvertimesController {
  constructor(private readonly overtimesService: OvertimesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('Manager')
  create(@Body() dto: CreateOvertimeRequestDto, @CurrentUser() user: JwtPayload) {
    return this.overtimesService.create(user.id, dto);
  }

  @Get()
  @Roles('Owner', 'Manager')
  findAll(@Query() query: QueryOvertimeDto, @CurrentUser() user: JwtPayload) {
    return this.overtimesService.findAll(user.id, user.role, query);
  }

  @Get('accumulation')
  @Roles('Owner', 'Manager')
  findAccumulation(@Query() query: QueryOvertimeDto, @CurrentUser() user: JwtPayload) {
    return this.overtimesService.findAccumulation(user.id, user.role, { month: query.month, year: query.year });
  }

  @Get('approved-detail')
  @Roles('Owner', 'Manager')
  findApprovedDetail(@Query() query: QueryOvertimeDto, @CurrentUser() user: JwtPayload) {
    return this.overtimesService.findApprovedDetail(user.id, user.role, { month: query.month, year: query.year });
  }

  @Post('payments')
  @HttpCode(HttpStatus.CREATED)
  @Roles('Owner')
  registerPayment(@Body() dto: CreatePaymentDto, @CurrentUser() user: JwtPayload) {
    return this.overtimesService.registerPayment(user.id, dto);
  }

  @Get('payments')
  @Roles('Owner')
  findPayments(@Query() query: QueryPaymentDto, @CurrentUser() user: JwtPayload) {
    return this.overtimesService.findPayments(user.id, query);
  }

  @Patch(':uuid/approve')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('Owner')
  approve(@Param('uuid') uuid: string, @CurrentUser() user: JwtPayload) {
    return this.overtimesService.approve(uuid, user.id);
  }

  @Patch(':uuid/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('Owner')
  reject(@Param('uuid') uuid: string, @CurrentUser() user: JwtPayload) {
    return this.overtimesService.reject(uuid, user.id);
  }
}
