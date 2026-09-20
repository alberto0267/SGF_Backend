import { Inject, Injectable } from '@nestjs/common';
import { DirectorioUsuarios } from '../domain/ports/directorio-usuarios';
import { VacacionRepository } from '../domain/ports/vacacion.repository';
import { AccesoDenegado, VacacionNoEncontrada } from './errors';
import { DIRECTORIO_USUARIOS, VACACION_REPOSITORY } from './tokens';

interface Input {
  vacacionId: string;
  autorId: number;
  autorRole: string;
  texto: string;
}

@Injectable()
export class ComentarVacacion {
  constructor(
    @Inject(VACACION_REPOSITORY) private readonly repo: VacacionRepository,
    @Inject(DIRECTORIO_USUARIOS) private readonly directorio: DirectorioUsuarios,
  ) {}

  async execute(input: Input): Promise<void> {
    const vacacion = await this.repo.buscarPorId(input.vacacionId);
    if (!vacacion) throw new VacacionNoEncontrada();

    if (input.autorId !== vacacion.empleadoId) {
      const empresaAutor = await this.directorio.empresaDe(input.autorId);
      const empresaEmpleado = await this.directorio.empresaDe(vacacion.empleadoId);
      if (input.autorRole !== 'Owner' || empresaAutor === null || empresaAutor !== empresaEmpleado) {
        throw new AccesoDenegado();
      }
    }

    vacacion.comentar(input.autorId, input.texto);
    await this.repo.guardar(vacacion);
  }
}
