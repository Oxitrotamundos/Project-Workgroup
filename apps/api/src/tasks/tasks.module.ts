import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { SummaryRecalculationService } from './summary-recalculation.service';
import { AuthModule } from '../auth/auth.module';
import { ObservabilityModule } from '../observability/observability.module';
import { CalendarModule } from '../calendar/calendar.module';

@Module({
  imports: [AuthModule, ObservabilityModule, CalendarModule],
  controllers: [TasksController],
  providers: [TasksService, SummaryRecalculationService],
  exports: [TasksService, SummaryRecalculationService],
})
export class TasksModule {}
