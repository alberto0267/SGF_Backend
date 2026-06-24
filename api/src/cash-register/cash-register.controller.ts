import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CashRegisterService } from './cash-register.service';
import { CreateCierreDto } from './dto/create-cierre.dto';
import { EditCierreDto } from './dto/edit-cierre.dto';
import { QueryMesDto } from './dto/query-mes.dto';
import { UpdateRetiradaValorDto } from './dto/update-retirada-valor.dto';

@Controller('cash-register')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CashRegisterController {
  constructor(private readonly service: CashRegisterService) {}

  @Post('closures')
  @HttpCode(HttpStatus.CREATED)
  @Roles('Employee')
  crear(@Body() dto: CreateCierreDto, @CurrentUser() user: JwtPayload) {
    return this.service.crear(user.id, dto);
  }

  @Patch('closures/:uuid')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('Employee', 'Owner')
  editar(@Param('uuid') uuid: string, @Body() dto: EditCierreDto, @CurrentUser() user: JwtPayload) {
    return this.service.editar(user.id, user.role, uuid, dto);
  }

  @Get('closures')
  @Roles('Owner')
  listar(@Query() query: QueryMesDto, @CurrentUser() user: JwtPayload) {
    return this.service.listar(user.id, query);
  }

  @Get('resumen')
  @Roles('Owner')
  resumen(@Query() query: QueryMesDto, @CurrentUser() user: JwtPayload) {
    return this.service.resumen(user.id, query);
  }

  @Patch('retirada-valor')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('Owner')
  cambiarValor(@Body() dto: UpdateRetiradaValorDto, @CurrentUser() user: JwtPayload) {
    return this.service.cambiarRetiradaValor(user.id, dto.valor);
  }
}
