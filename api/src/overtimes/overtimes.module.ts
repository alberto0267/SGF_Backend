import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { OvertimesController } from './overtimes.controller';
import { OvertimesService } from './overtimes.service';
import { OvertimeRepository } from './repositories/overtime.repository';

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [OvertimesController],
  providers: [OvertimesService, OvertimeRepository],
})
export class OvertimesModule {}
