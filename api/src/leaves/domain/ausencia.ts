import { randomUUID } from 'crypto';
import { OperacionNoPermitida } from './errors';
import { Comentario } from './value-objects/comentario';
import { EstadoSolicitud } from './value-objects/estado';
import { ModalidadAusencia } from './value-objects/modalidad-ausencia';

export class Ausencia {
  private constructor(
    readonly id: string,
    readonly empleadoId: number,
    private _fecha: Date,
    private _modalidad: ModalidadAusencia,
    private _motivo: string,
    private _estado: EstadoSolicitud,
    private _comentarios: Comentario[],
  ) {}

  static solicitar(
    empleadoId: number,
    fecha: Date,
    modalidad: ModalidadAusencia,
    motivo: string,
    comentarioInicial?: string,
  ): Ausencia {
    const comentarios = comentarioInicial ? [Comentario.crear(empleadoId, comentarioInicial)] : [];
    return new Ausencia(randomUUID(), empleadoId, fecha, modalidad, motivo, 'pending', comentarios);
  }

  static fromPersistence(
    id: string,
    empleadoId: number,
    fecha: Date,
    modalidad: ModalidadAusencia,
    motivo: string,
    estado: EstadoSolicitud,
    comentarios: Comentario[],
  ): Ausencia {
    return new Ausencia(id, empleadoId, fecha, modalidad, motivo, estado, comentarios);
  }

  editar(fecha: Date, modalidad: ModalidadAusencia, motivo: string): void {
    if (this._estado !== 'pending') {
      throw new OperacionNoPermitida('Solo se puede editar una solicitud pendiente');
    }
    this._fecha = fecha;
    this._modalidad = modalidad;
    this._motivo = motivo;
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

  get fecha(): Date {
    return this._fecha;
  }

  get modalidad(): ModalidadAusencia {
    return this._modalidad;
  }

  get motivo(): string {
    return this._motivo;
  }

  get estado(): EstadoSolicitud {
    return this._estado;
  }

  get comentarios(): readonly Comentario[] {
    return this._comentarios;
  }
}
