import { randomUUID } from 'crypto';

interface ValoresCierre {
  efectivo: number;
  nRet: number;
  datafono: number;
  cTarjeta: number;
  difArqueoEf: number;
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

export class CierreCaja {
  private constructor(
    readonly uuid: string,
    readonly workcenterId: number,
    readonly employeeId: number,
    readonly date: string,
    private _efectivo: number,
    private _nRet: number,
    private _datafono: number,
    private _cTarjeta: number,
    private _difArqueoEf: number,
    readonly retiradaValor: number,
  ) {}

  static crear(
    data: { workcenterId: number; employeeId: number; date: string } & ValoresCierre,
    retiradaValor: number,
  ): CierreCaja {
    return new CierreCaja(
      randomUUID(),
      data.workcenterId,
      data.employeeId,
      data.date,
      data.efectivo,
      data.nRet,
      data.datafono,
      data.cTarjeta,
      data.difArqueoEf,
      retiradaValor,
    );
  }

  static fromPersistence(
    uuid: string,
    workcenterId: number,
    employeeId: number,
    date: string,
    valores: ValoresCierre,
    retiradaValor: number,
  ): CierreCaja {
    return new CierreCaja(
      uuid,
      workcenterId,
      employeeId,
      date,
      valores.efectivo,
      valores.nRet,
      valores.datafono,
      valores.cTarjeta,
      valores.difArqueoEf,
      retiradaValor,
    );
  }

  editarValores(valores: ValoresCierre): void {
    this._efectivo = valores.efectivo;
    this._nRet = valores.nRet;
    this._datafono = valores.datafono;
    this._cTarjeta = valores.cTarjeta;
    this._difArqueoEf = valores.difArqueoEf;
  }

  get efectivo(): number {
    return this._efectivo;
  }

  get nRet(): number {
    return this._nRet;
  }

  get datafono(): number {
    return this._datafono;
  }

  get cTarjeta(): number {
    return this._cTarjeta;
  }

  get difArqueoEf(): number {
    return this._difArqueoEf;
  }

  get difDatafono(): number {
    return redondear(this._datafono - this._cTarjeta);
  }

  get difTotal(): number {
    return redondear(this.difDatafono + this._difArqueoEf);
  }

  get retiradas(): number {
    return redondear(this._nRet * this.retiradaValor);
  }

  get tVentas(): number {
    return redondear(this.retiradas + this._cTarjeta + this._efectivo);
  }

  get tEfectivo(): number {
    return redondear(this.retiradas + this._efectivo);
  }
}
