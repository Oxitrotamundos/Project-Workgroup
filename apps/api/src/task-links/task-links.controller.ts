import { Body, Controller, Delete, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateTaskLinkDto } from '@project-workgroup/shared';
import { AuthGuard } from '../auth/auth.guard';
import { ProjectMembershipGuard } from '../auth/project-membership.guard';
import { RequireProject } from '../auth/require-project.decorator';
import { TaskLinksService } from './task-links.service';

@ApiTags('task-links')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ version: '1' })
export class TaskLinksController {
  constructor(private readonly taskLinks: TaskLinksService) {}

  @Post('projects/:projectId/task-links')
  @UseGuards(ProjectMembershipGuard)
  @RequireProject('projectId')
  async create(@Param('projectId') projectId: string, @Body() dto: CreateTaskLinkDto) {
    return this.taskLinks.create(BigInt(projectId), dto);
  }

  @Get('projects/:projectId/task-links')
  @UseGuards(ProjectMembershipGuard)
  @RequireProject('projectId')
  async list(@Param('projectId') projectId: string) {
    return this.taskLinks.list(BigInt(projectId));
  }

  @Delete('task-links/:id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.taskLinks.remove(BigInt(id));
  }
}
