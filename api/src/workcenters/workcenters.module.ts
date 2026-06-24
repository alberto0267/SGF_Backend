import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AuthModule } from '../auth/auth.module';
import { CompaniesModule } from '../companies/companies.module';
import { WorkcentersController } from './workcenters.controller';
import { WorkcentersService } from './workcenters.service';
import { WorkcenterRepository } from './repositories/workcenter.repository';

@Module({
  imports: [CompaniesModule, AuthModule, AuditModule],
  controllers: [WorkcentersController],
  providers: [WorkcentersService, WorkcenterRepository],
  exports: [WorkcenterRepository],
})
export class WorkcentersModule {}
