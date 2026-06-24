import { Inject, Injectable } from '@nestjs/common';
import { AusenciaRepository } from '../domain/ports/ausencia.repository';
import { ModalidadAusencia } from '../domain/value-objects/modalidad-ausencia';
import { AccesoDenegado, AusenciaNoEncontrada } from './errors';
import { AUSENCIA_REPOSITORY } from './tokens';

interface Input {
  ausenciaId: string;
  empleadoId: number;
  fecha: Date;
  modalidad: 'dias' | 'horas';
  dias?: number;
  tramoInicio?: string;
  tramoFin?: string;
  motivo: string;
}

@Injectable()
export class EditarAusencia {
  constructor(
    @Inject(AUSENCIA_REPOSITORY) private readonly repo: AusenciaRepository,
  ) {}

  async execute(input: Input): Promise<void> {
    const ausencia = await this.repo.buscarPorId(input.ausenciaId);
    if (!ausencia) throw new AusenciaNoEncontrada();
    if (ausencia.empleadoId !== input.empleadoId) throw new AccesoDenegado();

    const modalidad =
      input.modalidad === 'dias'
        ? ModalidadAusencia.porDias(input.dias as number)
        : ModalidadAusencia.porHoras(input.tramoInicio as string, input.tramoFin as string);

    ausencia.editar(input.fecha, modalidad, input.motivo);
    await this.repo.guardar(ausencia);
  }
}
