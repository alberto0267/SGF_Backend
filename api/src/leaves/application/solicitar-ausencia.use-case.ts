import { Inject, Injectable } from '@nestjs/common';
import { Ausencia } from '../domain/ausencia';
import { AusenciaRepository } from '../domain/ports/ausencia.repository';
import { DirectorioUsuarios } from '../domain/ports/directorio-usuarios';
import { Notificador } from '../domain/ports/notificador';
import { ModalidadAusencia } from '../domain/value-objects/modalidad-ausencia';
import { AUSENCIA_REPOSITORY, DIRECTORIO_USUARIOS, NOTIFICADOR } from './tokens';

interface Input {
  empleadoId: number;
  fecha: Date;
  modalidad: 'dias' | 'horas';
  dias?: number;
  tramoInicio?: string;
  tramoFin?: string;
  motivo: string;
  comentario?: string;
}

@Injectable()
export class SolicitarAusencia {
  constructor(
    @Inject(AUSENCIA_REPOSITORY) private readonly repo: AusenciaRepository,
    @Inject(DIRECTORIO_USUARIOS) private readonly directorio: DirectorioUsuarios,
    @Inject(NOTIFICADOR) private readonly notificador: Notificador,
  ) {}

  async execute(input: Input): Promise<{ id: string }> {
    const modalidad =
      input.modalidad === 'dias'
        ? ModalidadAusencia.porDias(input.dias as number)
        : ModalidadAusencia.porHoras(input.tramoInicio as string, input.tramoFin as string);

    const ausencia = Ausencia.solicitar(input.empleadoId, input.fecha, modalidad, input.motivo, input.comentario);
    await this.repo.guardar(ausencia);

    const empresa = await this.directorio.empresaDe(input.empleadoId);
    if (empresa !== null) {
      const owners = await this.directorio.ownersDeEmpresa(empresa);
      await Promise.all(
        owners.map((id) => this.notificador.notificar(id, 'Nueva ausencia solicitada', `Motivo: ${input.motivo}`)),
      );
    }

    return { id: ausencia.id };
  }
}
