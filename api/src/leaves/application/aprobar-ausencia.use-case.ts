import { Inject, Injectable } from '@nestjs/common';
import { AusenciaRepository } from '../domain/ports/ausencia.repository';
import { DirectorioUsuarios } from '../domain/ports/directorio-usuarios';
import { Notificador } from '../domain/ports/notificador';
import { AccesoDenegado, AusenciaNoEncontrada } from './errors';
import { AUSENCIA_REPOSITORY, DIRECTORIO_USUARIOS, NOTIFICADOR } from './tokens';

interface Input {
  ausenciaId: string;
  ownerId: number;
  comentario?: string;
}

@Injectable()
export class AprobarAusencia {
  constructor(
    @Inject(AUSENCIA_REPOSITORY) private readonly repo: AusenciaRepository,
    @Inject(DIRECTORIO_USUARIOS) private readonly directorio: DirectorioUsuarios,
    @Inject(NOTIFICADOR) private readonly notificador: Notificador,
  ) {}

  async execute(input: Input): Promise<void> {
    const ausencia = await this.repo.buscarPorId(input.ausenciaId);
    if (!ausencia) throw new AusenciaNoEncontrada();

    const empresaOwner = await this.directorio.empresaDe(input.ownerId);
    const empresaEmpleado = await this.directorio.empresaDe(ausencia.empleadoId);
    if (empresaOwner === null || empresaOwner !== empresaEmpleado) {
      throw new AccesoDenegado();
    }

    ausencia.aprobar(input.ownerId, input.comentario);
    await this.repo.guardar(ausencia);

    await this.notificador.notificar(ausencia.empleadoId, 'Ausencia aprobada', 'Tu ausencia ha sido aprobada.');
  }
}
