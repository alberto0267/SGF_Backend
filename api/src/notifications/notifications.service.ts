import { Injectable, NotFoundException } from '@nestjs/common';
import { NotificationRepository } from './repositories/notification.repository';

@Injectable()
export class NotificationsService {
  constructor(private readonly notificationRepo: NotificationRepository) {}

  async notify(userId: number, title: string, message: string): Promise<void> {
    await this.notificationRepo.create(userId, title, message);
  }

  async findMine(userId: number) {
    return this.notificationRepo.findByUser(userId);
  }

  async markAsRead(id: number, userId: number): Promise<void> {
    const updated = await this.notificationRepo.markAsRead(id, userId);
    if (!updated) throw new NotFoundException('Notificación no encontrada');
  }

  async markAllAsRead(userId: number): Promise<void> {
    await this.notificationRepo.markAllAsRead(userId);
  }
}
