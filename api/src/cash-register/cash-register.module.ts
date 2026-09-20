import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WorkcentersModule } from '../workcenters/workcenters.module';
import { CashRegisterController } from './cash-register.controller';
import { CashRegisterService } from './cash-register.service';
import { CashRegisterResumenScheduler } from './cash-register-resumen.scheduler';
import { CierreCajaRepository } from './repositories/cierre-caja.repository';

@Module({
  imports: [AuthModule, NotificationsModule, WorkcentersModule],
  controllers: [CashRegisterController],
  providers: [CashRegisterService, CierreCajaRepository, CashRegisterResumenScheduler],
})
export class CashRegisterModule {}
