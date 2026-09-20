import { ValorInvalido } from '../errors';

export class Comentario {
  private constructor(
    readonly autorId: number,
    readonly texto: string,
    readonly fecha: Date,
  ) {}

  static crear(autorId: number, texto: string): Comentario {
    const limpio = texto.trim();
    if (limpio.length === 0) {
      throw new ValorInvalido('El comentario no puede estar vacío');
    }
    return new Comentario(autorId, limpio, new Date());
  }

  static fromPersistence(autorId: number, texto: string, fecha: Date): Comentario {
    return new Comentario(autorId, texto, fecha);
  }
}
