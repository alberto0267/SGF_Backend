import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, UseFilters, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { JwtPayload } from '../../../auth/interfaces/jwt-payload.interface';
import { AprobarVacacion } from '../../application/aprobar-vacacion.use-case';
import { ComentarVacacion } from '../../application/comentar-vacacion.use-case';
import { EditarVacacion } from '../../application/editar-vacacion.use-case';
import { ListarVacaciones } from '../../application/listar-vacaciones.use-case';
import { RechazarVacacion } from '../../application/rechazar-vacacion.use-case';
import { SolicitarVacacion } from '../../application/solicitar-vacacion.use-case';
import { DomainErrorFilter } from './domain-error.filter';
import { ComentarVacacionDto } from './dto/comentar-vacacion.dto';
import { EditarVacacionDto } from './dto/editar-vacacion.dto';
import { ResolverVacacionDto } from './dto/resolver-vacacion.dto';
import { SolicitarVacacionDto } from './dto/solicitar-vacacion.dto';

@Controller('leaves')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseFilters(DomainErrorFilter)
export class LeavesController {
  constructor(
    private readonly solicitarVacacionUC: SolicitarVacacion,
    private readonly listarVacacionesUC: ListarVacaciones,
    private readonly editarVacacionUC: EditarVacacion,
    private readonly comentarVacacionUC: ComentarVacacion,
    private readonly aprobarVacacionUC: AprobarVacacion,
    private readonly rechazarVacacionUC: RechazarVacacion,
  ) {}

  @Get('vacaciones')
  @Roles('Employee', 'Manager', 'Owner')
  listarVacaciones(@CurrentUser() user: JwtPayload) {
    return this.listarVacacionesUC.execute({ userId: user.id, role: user.role });
  }

  @Post('vacaciones')
  @HttpCode(HttpStatus.CREATED)
  @Roles('Employee')
  solicitarVacacion(@Body() dto: SolicitarVacacionDto, @CurrentUser() user: JwtPayload) {
    return this.solicitarVacacionUC.execute({
      empleadoId: user.id,
      asunto: dto.asunto,
      inicio: new Date(dto.inicio),
      fin: new Date(dto.fin),
      comentario: dto.comentario,
    });
  }

  @Patch('vacaciones/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('Employee')
  editarVacacion(@Param('id') id: string, @Body() dto: EditarVacacionDto, @CurrentUser() user: JwtPayload) {
    return this.editarVacacionUC.execute({
      vacacionId: id,
      empleadoId: user.id,
      asunto: dto.asunto,
      inicio: new Date(dto.inicio),
      fin: new Date(dto.fin),
    });
  }

  @Post('vacaciones/:id/comentarios')
  @HttpCode(HttpStatus.CREATED)
  @Roles('Employee', 'Owner')
  comentarVacacion(@Param('id') id: string, @Body() dto: ComentarVacacionDto, @CurrentUser() user: JwtPayload) {
    return this.comentarVacacionUC.execute({ vacacionId: id, autorId: user.id, autorRole: user.role, texto: dto.texto });
  }

  @Patch('vacaciones/:id/approve')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('Owner')
  aprobarVacacion(@Param('id') id: string, @Body() dto: ResolverVacacionDto, @CurrentUser() user: JwtPayload) {
    return this.aprobarVacacionUC.execute({ vacacionId: id, ownerId: user.id, comentario: dto.comentario });
  }

  @Patch('vacaciones/:id/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('Owner')
  rechazarVacacion(@Param('id') id: string, @Body() dto: ResolverVacacionDto, @CurrentUser() user: JwtPayload) {
    return this.rechazarVacacionUC.execute({ vacacionId: id, ownerId: user.id, comentario: dto.comentario });
  }
}
