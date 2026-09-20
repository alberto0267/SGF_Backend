import { Inject, Injectable } from '@nestjs/common';
import { AusenciaRepository } from '../domain/ports/ausencia.repository';
import { DirectorioUsuarios } from '../domain/ports/directorio-usuarios';
import { AccesoDenegado, AusenciaNoEncontrada } from './errors';
import { AUSENCIA_REPOSITORY, DIRECTORIO_USUARIOS } from './tokens';

interface Input {
  ausenciaId: string;
  autorId: number;
  autorRole: string;
  texto: string;
}

@Injectable()
export class ComentarAusencia {
  constructor(
    @Inject(AUSENCIA_REPOSITORY) private readonly repo: AusenciaRepository,
    @Inject(DIRECTORIO_USUARIOS) private readonly directorio: DirectorioUsuarios,
  ) {}

  async execute(input: Input): Promise<void> {
    const ausencia = await this.repo.buscarPorId(input.ausenciaId);
    if (!ausencia) throw new AusenciaNoEncontrada();

    if (input.autorId !== ausencia.empleadoId) {
      const empresaAutor = await this.directorio.empresaDe(input.autorId);
      const empresaEmpleado = await this.directorio.empresaDe(ausencia.empleadoId);
      if (input.autorRole !== 'Owner' || empresaAutor === null || empresaAutor !== empresaEmpleado) {
        throw new AccesoDenegado();
      }
    }

    ausencia.comentar(input.autorId, input.texto);
    await this.repo.guardar(ausencia);
  }
}
