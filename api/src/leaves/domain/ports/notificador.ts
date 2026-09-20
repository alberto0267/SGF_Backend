export interface Notificador {
  notificar(usuarioId: number, titulo: string, mensaje: string): Promise<void>;
}
