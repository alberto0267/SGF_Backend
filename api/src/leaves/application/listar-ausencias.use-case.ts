import { Inject, Injectable } from '@nestjs/common';
import { AusenciaConsultas, AusenciaReadModel } from '../domain/ports/ausencia.queries';
import { DirectorioUsuarios } from '../domain/ports/directorio-usuarios';
import { AUSENCIA_QUERIES, DIRECTORIO_USUARIOS } from './tokens';

interface Input {
  userId: number;
  role: string;
}

@Injectable()
export class ListarAusencias {
  constructor(
    @Inject(AUSENCIA_QUERIES) private readonly queries: AusenciaConsultas,
    @Inject(DIRECTORIO_USUARIOS) private readonly directorio: DirectorioUsuarios,
  ) {}

  async execute(input: Input): Promise<AusenciaReadModel[]> {
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
