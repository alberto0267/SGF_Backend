import { ValorInvalido } from '../errors';

export class ModalidadAusencia {
  private constructor(
    readonly tipo: 'dias' | 'horas',
    readonly cantidadDias: number | null,
    readonly tramoInicio: string | null,
    readonly tramoFin: string | null,
    readonly horas: number | null,
  ) {}

  static porDias(cantidad: number): ModalidadAusencia {
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      throw new ValorInvalido('La cantidad de días debe ser un entero mayor que 0');
    }
    return new ModalidadAusencia('dias', cantidad, null, null, null);
  }

  static porHoras(tramoInicio: string, tramoFin: string): ModalidadAusencia {
    const horas = ModalidadAusencia.horasEntre(tramoInicio, tramoFin);
    if (horas <= 0) {
      throw new ValorInvalido('El tramo horario no es válido');
    }
    return new ModalidadAusencia('horas', null, tramoInicio, tramoFin, horas);
  }

  static fromPersistence(
    tipo: 'dias' | 'horas',
    cantidadDias: number | null,
    tramoInicio: string | null,
    tramoFin: string | null,
    horas: number | null,
  ): ModalidadAusencia {
    return new ModalidadAusencia(tipo, cantidadDias, tramoInicio, tramoFin, horas);
  }

  private static horasEntre(inicio: string, fin: string): number {
    const minutos = (hhmm: string): number => {
      const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
      if (!match) throw new ValorInvalido(`Hora inválida: ${hhmm} (formato HH:MM)`);
      return Number(match[1]) * 60 + Number(match[2]);
    };
    return (minutos(fin) - minutos(inicio)) / 60;
  }
}
