import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { CalendarResolverService } from './calendar-resolver.service';
import { SchedulingService } from './scheduling.service';
import { TaskReschedulerService } from './task-rescheduler.service';
import { TaskScheduleCalculator } from './task-schedule-calculator.service';

@Module({
  imports: [AuthModule],
  controllers: [CalendarController],
  providers: [
    CalendarService,
    CalendarResolverService,
    SchedulingService,
    TaskReschedulerService,
    TaskScheduleCalculator,
  ],
  exports: [
    CalendarResolverService,
    SchedulingService,
    CalendarService,
    TaskReschedulerService,
    TaskScheduleCalculator,
  ],
})
export class CalendarModule {}
