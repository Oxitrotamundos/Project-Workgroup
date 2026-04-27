import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateTaskLinkDto, UpdateTaskLinkDto } from '@project-workgroup/shared';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ProjectMembershipGuard } from '../auth/project-membership.guard';
import { RequireProject } from '../auth/require-project.decorator';
import { TaskLinksService } from './task-links.service';

@ApiTags('task-links')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ version: '1' })
export class TaskLinksController {
  constructor(private readonly taskLinks: TaskLinksService) {}

  private id(value: string, name = 'id'): bigint {
    try {
      return BigInt(value);
    } catch {
      throw new BadRequestException(`${name} must be a valid id`);
    }
  }

  @Post('projects/:projectId/task-links')
  @UseGuards(ProjectMembershipGuard)
  @RequireProject('projectId')
  async create(@Param('projectId') projectId: string, @Body() dto: CreateTaskLinkDto) {
    return this.taskLinks.create(this.id(projectId, 'projectId'), dto);
  }

  @Get('projects/:projectId/task-links')
  @UseGuards(ProjectMembershipGuard)
  @RequireProject('projectId')
  async list(@Param('projectId') projectId: string) {
    return this.taskLinks.list(this.id(projectId, 'projectId'));
  }

  @Get('tasks/:taskId/source-links')
  async listSource(@Param('taskId') taskId: string, @CurrentUser() user: AuthUser) {
    return this.taskLinks.listSource(this.id(taskId, 'taskId'), user);
  }

  @Get('tasks/:taskId/target-links')
  async listTarget(@Param('taskId') taskId: string, @CurrentUser() user: AuthUser) {
    return this.taskLinks.listTarget(this.id(taskId, 'taskId'), user);
  }

  @Get('task-links/:id')
  async getById(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.taskLinks.getById(this.id(id), user);
  }

  @Patch('task-links/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateTaskLinkDto, @CurrentUser() user: AuthUser) {
    return this.taskLinks.update(this.id(id), dto, user);
  }

  @Delete('task-links/:id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.taskLinks.remove(this.id(id), user);
  }
}
