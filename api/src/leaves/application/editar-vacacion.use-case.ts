import { Inject, Injectable } from '@nestjs/common';
import { VacacionRepository } from '../domain/ports/vacacion.repository';
import { Rango } from '../domain/value-objects/rango';
import { AccesoDenegado, FechasSolapadas, SaldoVacacionesExcedido, VacacionNoEncontrada } from './errors';
import { VACACION_REPOSITORY } from './tokens';

interface Input {
  vacacionId: string;
  empleadoId: number;
  asunto: string;
  inicio: Date;
  fin: Date;
}

@Injectable()
export class EditarVacacion {
  constructor(
    @Inject(VACACION_REPOSITORY) private readonly repo: VacacionRepository,
  ) {}

  async execute(input: Input): Promise<void> {
    const vacacion = await this.repo.buscarPorId(input.vacacionId);
    if (!vacacion) throw new VacacionNoEncontrada();
    if (vacacion.empleadoId !== input.empleadoId) throw new AccesoDenegado();

    const rango = Rango.crear(input.inicio, input.fin);

    const usados = await this.repo.diasUsadosEnAnio(input.empleadoId, input.inicio.getFullYear(), input.vacacionId);
    if (usados + rango.dias() > 30) {
      throw new SaldoVacacionesExcedido(usados, rango.dias());
    }

    if (await this.repo.haySolapamiento(input.empleadoId, rango, input.vacacionId)) {
      throw new FechasSolapadas();
    }

    vacacion.editar(input.asunto, rango);
    await this.repo.guardar(vacacion);
  }
}
