import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from '../auth/auth.module';
import { AuditModule } from '../audit/audit.module';
import { CompaniesModule } from '../companies/companies.module';
import { DatabaseModule } from '../database/database.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OvertimesModule } from '../overtimes/overtimes.module';
import { WorkcentersModule } from '../workcenters/workcenters.module';
import { UsersModule } from '../users/users.module';
import { LeavesModule } from '../leaves/leaves.module';
import { CashRegisterModule } from '../cash-register/cash-register.module';

@Module({
  imports: [DatabaseModule, AuditModule, AuthModule, CompaniesModule, WorkcentersModule, UsersModule, NotificationsModule, OvertimesModule, LeavesModule, CashRegisterModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
