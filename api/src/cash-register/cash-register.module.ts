import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CashRegisterController } from './cash-register.controller';
import { CashRegisterService } from './cash-register.service';
import { CierreCajaRepository } from './repositories/cierre-caja.repository';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [CashRegisterController],
  providers: [CashRegisterService, CierreCajaRepository],
})
export class CashRegisterModule {}
