import { Inject, Injectable } from '@nestjs/common';
import { DirectorioUsuarios } from '../domain/ports/directorio-usuarios';
import { Notificador } from '../domain/ports/notificador';
import { VacacionRepository } from '../domain/ports/vacacion.repository';
import { AccesoDenegado, VacacionNoEncontrada } from './errors';
import { DIRECTORIO_USUARIOS, NOTIFICADOR, VACACION_REPOSITORY } from './tokens';

interface Input {
  vacacionId: string;
  ownerId: number;
  comentario?: string;
}

@Injectable()
export class AprobarVacacion {
  constructor(
    @Inject(VACACION_REPOSITORY) private readonly repo: VacacionRepository,
    @Inject(DIRECTORIO_USUARIOS) private readonly directorio: DirectorioUsuarios,
    @Inject(NOTIFICADOR) private readonly notificador: Notificador,
  ) {}

  async execute(input: Input): Promise<void> {
    const vacacion = await this.repo.buscarPorId(input.vacacionId);
    if (!vacacion) throw new VacacionNoEncontrada();

    const empresaOwner = await this.directorio.empresaDe(input.ownerId);
    const empresaEmpleado = await this.directorio.empresaDe(vacacion.empleadoId);
    if (empresaOwner === null || empresaOwner !== empresaEmpleado) {
      throw new AccesoDenegado();
    }

    vacacion.aprobar(input.ownerId, input.comentario);
    await this.repo.guardar(vacacion);

    await this.notificador.notificar(
      vacacion.empleadoId,
      'Vacaciones aprobadas',
      `Tu solicitud "${vacacion.asunto}" ha sido aprobada.`,
    );
  }
}
