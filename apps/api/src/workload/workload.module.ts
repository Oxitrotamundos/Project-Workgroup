import { Module } from '@nestjs/common';
import { WorkloadController } from './workload.controller';
import { WorkloadService } from './workload.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [WorkloadController],
  providers: [WorkloadService],
  exports: [WorkloadService],
})
export class WorkloadModule {}
