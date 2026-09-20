import { ValorInvalido } from '../errors';

export class Rango {
  private constructor(
    readonly inicio: Date,
    readonly fin: Date,
  ) {}

  static crear(inicio: Date, fin: Date): Rango {
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
      throw new ValorInvalido('Las fechas del rango no son válidas');
    }
    if (fin < inicio) {
      throw new ValorInvalido('La fecha de fin no puede ser anterior a la de inicio');
    }
    return new Rango(inicio, fin);
  }

  dias(): number {
    const msPorDia = 1000 * 60 * 60 * 24;
    const diff = this.fin.getTime() - this.inicio.getTime();
    return Math.floor(diff / msPorDia) + 1;
  }

  solapaCon(otro: Rango): boolean {
    return this.inicio <= otro.fin && otro.inicio <= this.fin;
  }
}
