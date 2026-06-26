import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { ProjectImportService } from './project-import.service';
import { AuthModule } from '../auth/auth.module';
import { TasksModule } from '../tasks/tasks.module';
import { CalendarModule } from '../calendar/calendar.module';

@Module({
  imports: [AuthModule, TasksModule, CalendarModule],
  controllers: [ProjectsController],
  providers: [ProjectsService, ProjectImportService],
  exports: [ProjectsService],
})
export class ProjectsModule {}
