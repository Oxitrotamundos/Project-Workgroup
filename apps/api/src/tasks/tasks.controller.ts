import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CreateTaskDto, UpdateTaskDto, UpdateProgressDto, UpdateOrderDto } from '@project-workgroup/shared';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { ProjectMembershipGuard } from '../auth/project-membership.guard';
import { RequireProject } from '../auth/require-project.decorator';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ version: '1' })
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  private id(value: string, name = 'id'): bigint {
    try {
      return BigInt(value);
    } catch {
      throw new BadRequestException(`${name} must be a valid id`);
    }
  }

  @Get('projects/:projectId/tasks')
  @UseGuards(ProjectMembershipGuard)
  @RequireProject('projectId')
  async list(@Param('projectId') projectId: string) {
    return this.tasks.list(this.id(projectId, 'projectId'));
  }

  @Post('projects/:projectId/tasks')
  @UseGuards(ProjectMembershipGuard)
  @RequireProject('projectId')
  async create(@Param('projectId') projectId: string, @Body() dto: CreateTaskDto) {
    return this.tasks.create(this.id(projectId, 'projectId'), dto);
  }

  @Get('tasks/:id')
  async getById(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.tasks.getById(this.id(id), user);
  }

  @Patch('tasks/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateTaskDto, @CurrentUser() user: AuthUser) {
    return this.tasks.update(this.id(id), dto, user);
  }

  @Patch('tasks/:id/progress')
  async updateProgress(@Param('id') id: string, @Body() dto: UpdateProgressDto, @CurrentUser() user: AuthUser) {
    return this.tasks.updateProgress(this.id(id), dto, user);
  }

  @Patch('tasks/:id/order')
  async updateOrder(@Param('id') id: string, @Body() dto: UpdateOrderDto, @CurrentUser() user: AuthUser) {
    return this.tasks.updateOrder(this.id(id), dto, user);
  }

  @Delete('tasks/:id')
  @HttpCode(204)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.tasks.remove(this.id(id), user);
  }
}
