import { Injectable } from '@nestjs/common';
import { NotificationsService } from '../../../notifications/notifications.service';
import { Notificador } from '../../domain/ports/notificador';

@Injectable()
export class NotificadorAdapter implements Notificador {
  constructor(private readonly notifications: NotificationsService) {}

  notificar(usuarioId: number, titulo: string, mensaje: string): Promise<void> {
    return this.notifications.notify(usuarioId, titulo, mensaje);
  }
}
