import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';
import { CalendarResolverService } from './calendar-resolver.service';
import { SchedulingService } from './scheduling.service';

@Module({
  imports: [AuthModule],
  controllers: [CalendarController],
  providers: [CalendarService, CalendarResolverService, SchedulingService],
  exports: [CalendarResolverService, SchedulingService, CalendarService],
})
export class CalendarModule {}
