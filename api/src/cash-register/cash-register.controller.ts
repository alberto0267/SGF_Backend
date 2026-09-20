import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CashRegisterService } from './cash-register.service';
import { CreateCierreDto } from './dto/create-cierre.dto';
import { EditCierreDto } from './dto/edit-cierre.dto';
import { QueryClosuresDto } from './dto/query-closures.dto';
import { QueryDaySummaryDto } from './dto/query-day-summary.dto';
import { QueryMesDto } from './dto/query-mes.dto';
import { QueryMisCierresDto } from './dto/query-mis-cierres.dto';
import { UpdateResumenHoraDto } from './dto/update-resumen-hora.dto';
import { UpdateRetiradaValorDto } from './dto/update-retirada-valor.dto';

@Controller('cash-register')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CashRegisterController {
  constructor(private readonly service: CashRegisterService) {}

  @Post('closures')
  @HttpCode(HttpStatus.CREATED)
  @Roles('Employee', 'Manager')
  crear(@Body() dto: CreateCierreDto, @CurrentUser() user: JwtPayload) {
    return this.service.crear(user.id, dto);
  }

  @Patch('closures/:uuid')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('Employee', 'Manager', 'Owner')
  editar(@Param('uuid') uuid: string, @Body() dto: EditCierreDto, @CurrentUser() user: JwtPayload) {
    return this.service.editar(user.id, user.role, uuid, dto);
  }

  @Get('closures')
  @Roles('Owner', 'Manager')
  listar(@Query() query: QueryClosuresDto, @CurrentUser() user: JwtPayload) {
    return this.service.listar(user.id, user.role, query);
  }

  @Get('closures/mine')
  @Roles('Employee')
  misCierres(@Query() query: QueryMisCierresDto, @CurrentUser() user: JwtPayload) {
    return this.service.misCierres(user.id, query);
  }

  @Get('resumen')
  @Roles('Owner')
  resumen(@Query() query: QueryMesDto, @CurrentUser() user: JwtPayload) {
    return this.service.resumen(user.id, query);
  }

  @Get('day-summary')
  @Roles('Owner')
  daySummary(@Query() query: QueryDaySummaryDto, @CurrentUser() user: JwtPayload) {
    return this.service.daySummary(user.id, query);
  }

  @Patch('resumen-hora')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('Owner')
  cambiarResumenHora(@Body() dto: UpdateResumenHoraDto, @CurrentUser() user: JwtPayload) {
    return this.service.cambiarResumenHora(user.id, dto.workcenterUuid, dto.hora);
  }

  @Patch('retirada-valor')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('Owner')
  cambiarValor(@Body() dto: UpdateRetiradaValorDto, @CurrentUser() user: JwtPayload) {
    return this.service.cambiarRetiradaValor(user.id, dto.valor);
  }
}
