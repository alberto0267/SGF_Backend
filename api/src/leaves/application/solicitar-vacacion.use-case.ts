import { Inject, Injectable } from '@nestjs/common';
import { DirectorioUsuarios } from '../domain/ports/directorio-usuarios';
import { Notificador } from '../domain/ports/notificador';
import { VacacionRepository } from '../domain/ports/vacacion.repository';
import { Vacacion } from '../domain/vacacion';
import { Rango } from '../domain/value-objects/rango';
import { FechasSolapadas, SaldoVacacionesExcedido } from './errors';
import { DIRECTORIO_USUARIOS, NOTIFICADOR, VACACION_REPOSITORY } from './tokens';

interface Input {
  empleadoId: number;
  asunto: string;
  inicio: Date;
  fin: Date;
  comentario?: string;
}

@Injectable()
export class SolicitarVacacion {
  constructor(
    @Inject(VACACION_REPOSITORY) private readonly repo: VacacionRepository,
    @Inject(DIRECTORIO_USUARIOS) private readonly directorio: DirectorioUsuarios,
    @Inject(NOTIFICADOR) private readonly notificador: Notificador,
  ) {}

  async execute(input: Input): Promise<{ id: string }> {
    const rango = Rango.crear(input.inicio, input.fin);

    const usados = await this.repo.diasUsadosEnAnio(input.empleadoId, input.inicio.getFullYear());
    if (usados + rango.dias() > 30) {
      throw new SaldoVacacionesExcedido(usados, rango.dias());
    }

    if (await this.repo.haySolapamiento(input.empleadoId, rango)) {
      throw new FechasSolapadas();
    }

    const vacacion = Vacacion.solicitar(input.empleadoId, input.asunto, rango, input.comentario);
    await this.repo.guardar(vacacion);

    const empresa = await this.directorio.empresaDe(input.empleadoId);
    if (empresa !== null) {
      const owners = await this.directorio.ownersDeEmpresa(empresa);
      await Promise.all(
        owners.map((id) =>
          this.notificador.notificar(id, 'Nueva solicitud de vacaciones', `Se ha solicitado: "${input.asunto}".`),
        ),
      );
    }

    return { id: vacacion.id };
  }
}
