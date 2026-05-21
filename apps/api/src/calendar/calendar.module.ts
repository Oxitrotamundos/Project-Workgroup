import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { CalendarResolverService } from './calendar-resolver.service';
import { SchedulingService } from './scheduling.service';
import { TaskReschedulerService } from './task-rescheduler.service';

@Module({
  imports: [AuthModule],
  controllers: [CalendarController],
  providers: [
    CalendarService,
    CalendarResolverService,
    SchedulingService,
    TaskReschedulerService,
  ],
  exports: [
    CalendarResolverService,
    SchedulingService,
    CalendarService,
    TaskReschedulerService,
  ],
})
export class CalendarModule {}
