import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CashRegisterService } from './cash-register.service';

@Injectable()
export class CashRegisterResumenScheduler {
  constructor(private readonly service: CashRegisterService) {}

  @Cron('0 * * * * *')
  async tick(): Promise<void> {
    const now = new Date();
    const horaActual = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    await this.service.enviarResumenesProgramados(horaActual);
  }
}
