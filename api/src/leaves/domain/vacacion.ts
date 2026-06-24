import { randomUUID } from 'crypto';
import { OperacionNoPermitida } from './errors';
import { Comentario } from './value-objects/comentario';
import { EstadoSolicitud } from './value-objects/estado';
import { Rango } from './value-objects/rango';

export class Vacacion {
  private constructor(
    readonly id: string,
    readonly empleadoId: number,
    private _asunto: string,
    private _rango: Rango,
    private _estado: EstadoSolicitud,
    private _comentarios: Comentario[],
  ) {}

  static solicitar(empleadoId: number, asunto: string, rango: Rango, comentarioInicial?: string): Vacacion {
    const comentarios = comentarioInicial ? [Comentario.crear(empleadoId, comentarioInicial)] : [];
    return new Vacacion(randomUUID(), empleadoId, asunto, rango, 'pending', comentarios);
  }

  static fromPersistence(
    id: string,
    empleadoId: number,
    asunto: string,
    rango: Rango,
    estado: EstadoSolicitud,
    comentarios: Comentario[],
  ): Vacacion {
    return new Vacacion(id, empleadoId, asunto, rango, estado, comentarios);
  }

  editar(asunto: string, rango: Rango): void {
    if (this._estado !== 'pending') {
      throw new OperacionNoPermitida('Solo se puede editar una solicitud pendiente');
    }
    this._asunto = asunto;
    this._rango = rango;
  }

  aprobar(ownerId: number, comentario?: string): void {
    this.resolver('approved', ownerId, comentario);
  }

  rechazar(ownerId: number, comentario?: string): void {
    this.resolver('rejected', ownerId, comentario);
  }

  comentar(autorId: number, texto: string): void {
    this._comentarios.push(Comentario.crear(autorId, texto));
  }

  private resolver(estado: EstadoSolicitud, ownerId: number, comentario?: string): void {
    if (this._estado !== 'pending') {
      throw new OperacionNoPermitida('La solicitud ya fue resuelta');
    }
    this._estado = estado;
    if (comentario) {
      this._comentarios.push(Comentario.crear(ownerId, comentario));
    }
  }

  get asunto(): string {
    return this._asunto;
  }

  get rango(): Rango {
    return this._rango;
  }

  get estado(): EstadoSolicitud {
    return this._estado;
  }

  get dias(): number {
    return this._rango.dias();
  }

  get comentarios(): readonly Comentario[] {
    return this._comentarios;
  }
}
