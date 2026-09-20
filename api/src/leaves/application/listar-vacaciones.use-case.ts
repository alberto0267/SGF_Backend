import { Inject, Injectable } from '@nestjs/common';
import { DirectorioUsuarios } from '../domain/ports/directorio-usuarios';
import { VacacionConsultas, VacacionReadModel } from '../domain/ports/vacacion.queries';
import { DIRECTORIO_USUARIOS, VACACION_QUERIES } from './tokens';

interface Input {
  userId: number;
  role: string;
}

@Injectable()
export class ListarVacaciones {
  constructor(
    @Inject(VACACION_QUERIES) private readonly queries: VacacionConsultas,
    @Inject(DIRECTORIO_USUARIOS) private readonly directorio: DirectorioUsuarios,
  ) {}

  async execute(input: Input): Promise<VacacionReadModel[]> {
    if (input.role === 'Owner') {
      const empresa = await this.directorio.empresaDe(input.userId);
      if (empresa === null) return [];
      return this.queries.listarPorEmpresa(empresa);
    }

    if (input.role === 'Manager') {
      const centros = await this.directorio.centrosDe(input.userId);
      if (centros.length === 0) return [];
      return this.queries.listarPorCentros(centros);
    }

    return this.queries.listarPorEmpleado(input.userId);
  }
}
