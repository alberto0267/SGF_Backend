import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, UseFilters, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { JwtPayload } from '../../../auth/interfaces/jwt-payload.interface';
import { AprobarAusencia } from '../../application/aprobar-ausencia.use-case';
import { ComentarAusencia } from '../../application/comentar-ausencia.use-case';
import { EditarAusencia } from '../../application/editar-ausencia.use-case';
import { ListarAusencias } from '../../application/listar-ausencias.use-case';
import { RechazarAusencia } from '../../application/rechazar-ausencia.use-case';
import { SolicitarAusencia } from '../../application/solicitar-ausencia.use-case';
import { DomainErrorFilter } from './domain-error.filter';
import { ComentarAusenciaDto } from './dto/comentar-ausencia.dto';
import { EditarAusenciaDto } from './dto/editar-ausencia.dto';
import { ResolverVacacionDto } from './dto/resolver-vacacion.dto';
import { SolicitarAusenciaDto } from './dto/solicitar-ausencia.dto';

@Controller('leaves/ausencias')
@UseGuards(JwtAuthGuard, RolesGuard)
@UseFilters(DomainErrorFilter)
export class AusenciasController {
  constructor(
    private readonly solicitarAusenciaUC: SolicitarAusencia,
    private readonly listarAusenciasUC: ListarAusencias,
    private readonly editarAusenciaUC: EditarAusencia,
    private readonly comentarAusenciaUC: ComentarAusencia,
    private readonly aprobarAusenciaUC: AprobarAusencia,
    private readonly rechazarAusenciaUC: RechazarAusencia,
  ) {}

  @Get()
  @Roles('Employee', 'Manager', 'Owner')
  listar(@CurrentUser() user: JwtPayload) {
    return this.listarAusenciasUC.execute({ userId: user.id, role: user.role });
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('Employee')
  solicitar(@Body() dto: SolicitarAusenciaDto, @CurrentUser() user: JwtPayload) {
    return this.solicitarAusenciaUC.execute({
      empleadoId: user.id,
      fecha: new Date(dto.fecha),
      modalidad: dto.modalidad,
      dias: dto.dias,
      tramoInicio: dto.tramoInicio,
      tramoFin: dto.tramoFin,
      motivo: dto.motivo,
      comentario: dto.comentario,
    });
  }

  @Patch(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('Employee')
  editar(@Param('id') id: string, @Body() dto: EditarAusenciaDto, @CurrentUser() user: JwtPayload) {
    return this.editarAusenciaUC.execute({
      ausenciaId: id,
      empleadoId: user.id,
      fecha: new Date(dto.fecha),
      modalidad: dto.modalidad,
      dias: dto.dias,
      tramoInicio: dto.tramoInicio,
      tramoFin: dto.tramoFin,
      motivo: dto.motivo,
    });
  }

  @Post(':id/comentarios')
  @HttpCode(HttpStatus.CREATED)
  @Roles('Employee', 'Owner')
  comentar(@Param('id') id: string, @Body() dto: ComentarAusenciaDto, @CurrentUser() user: JwtPayload) {
    return this.comentarAusenciaUC.execute({ ausenciaId: id, autorId: user.id, autorRole: user.role, texto: dto.texto });
  }

  @Patch(':id/approve')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('Owner')
  aprobar(@Param('id') id: string, @Body() dto: ResolverVacacionDto, @CurrentUser() user: JwtPayload) {
    return this.aprobarAusenciaUC.execute({ ausenciaId: id, ownerId: user.id, comentario: dto.comentario });
  }

  @Patch(':id/reject')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Roles('Owner')
  rechazar(@Param('id') id: string, @Body() dto: ResolverVacacionDto, @CurrentUser() user: JwtPayload) {
    return this.rechazarAusenciaUC.execute({ ausenciaId: id, ownerId: user.id, comentario: dto.comentario });
  }
}
