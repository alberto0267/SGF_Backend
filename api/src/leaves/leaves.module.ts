import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AprobarAusencia } from './application/aprobar-ausencia.use-case';
import { AprobarVacacion } from './application/aprobar-vacacion.use-case';
import { ComentarAusencia } from './application/comentar-ausencia.use-case';
import { ComentarVacacion } from './application/comentar-vacacion.use-case';
import { EditarAusencia } from './application/editar-ausencia.use-case';
import { EditarVacacion } from './application/editar-vacacion.use-case';
import { ListarAusencias } from './application/listar-ausencias.use-case';
import { ListarVacaciones } from './application/listar-vacaciones.use-case';
import { RechazarAusencia } from './application/rechazar-ausencia.use-case';
import { RechazarVacacion } from './application/rechazar-vacacion.use-case';
import { SolicitarAusencia } from './application/solicitar-ausencia.use-case';
import { SolicitarVacacion } from './application/solicitar-vacacion.use-case';
import {
  AUSENCIA_QUERIES,
  AUSENCIA_REPOSITORY,
  DIRECTORIO_USUARIOS,
  NOTIFICADOR,
  VACACION_QUERIES,
  VACACION_REPOSITORY,
} from './application/tokens';
import { AusenciasController } from './infrastructure/http/ausencias.controller';
import { LeavesController } from './infrastructure/http/leaves.controller';
import { AusenciaQueriesSql } from './infrastructure/persistence/ausencia.queries.sql';
import { AusenciaSqlRepository } from './infrastructure/persistence/ausencia.sql.repository';
import { DirectorioUsuariosSql } from './infrastructure/persistence/directorio-usuarios.sql';
import { NotificadorAdapter } from './infrastructure/persistence/notificador.adapter';
import { VacacionQueriesSql } from './infrastructure/persistence/vacacion.queries.sql';
import { VacacionSqlRepository } from './infrastructure/persistence/vacacion.sql.repository';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [LeavesController, AusenciasController],
  providers: [
    SolicitarVacacion,
    ListarVacaciones,
    EditarVacacion,
    ComentarVacacion,
    AprobarVacacion,
    RechazarVacacion,
    SolicitarAusencia,
    ListarAusencias,
    EditarAusencia,
    ComentarAusencia,
    AprobarAusencia,
    RechazarAusencia,
    { provide: VACACION_REPOSITORY, useClass: VacacionSqlRepository },
    { provide: VACACION_QUERIES, useClass: VacacionQueriesSql },
    { provide: AUSENCIA_REPOSITORY, useClass: AusenciaSqlRepository },
    { provide: AUSENCIA_QUERIES, useClass: AusenciaQueriesSql },
    { provide: DIRECTORIO_USUARIOS, useClass: DirectorioUsuariosSql },
    { provide: NOTIFICADOR, useClass: NotificadorAdapter },
  ],
})
export class LeavesModule {}
