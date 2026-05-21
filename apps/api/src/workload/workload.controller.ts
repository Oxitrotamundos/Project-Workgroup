import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateWorkloadDto, WorkloadQueryDto } from '@project-workgroup/shared';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ProjectMembershipGuard } from '../auth/project-membership.guard';
import { RequireProject } from '../auth/require-project.decorator';
import { WorkloadService } from './workload.service';

@ApiTags('workload')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ version: '1' })
export class WorkloadController {
  constructor(private readonly workload: WorkloadService) {}

  @Post('projects/:projectId/workload')
  @UseGuards(ProjectMembershipGuard)
  @RequireProject('projectId')
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateWorkloadDto,
  ) {
    return this.workload.create(BigInt(projectId), dto);
  }

  @Get('projects/:projectId/workload')
  @UseGuards(ProjectMembershipGuard)
  @RequireProject('projectId')
  async query(
    @Param('projectId') projectId: string,
    @Query() q: WorkloadQueryDto,
  ) {
    return this.workload.query(BigInt(projectId), q);
  }

  @Delete('workload/:id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.workload.remove(BigInt(id), user);
  }
}
