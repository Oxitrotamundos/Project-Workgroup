import { Module } from '@nestjs/common';
import { TaskLinksController } from './task-links.controller';
import { TaskLinksService } from './task-links.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TaskLinksController],
  providers: [TaskLinksService],
  exports: [TaskLinksService],
})
export class TaskLinksModule {}
