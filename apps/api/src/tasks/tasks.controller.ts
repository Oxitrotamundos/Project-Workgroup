import {
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
import { AuthGuard } from '../auth/auth.guard';
import { ProjectMembershipGuard } from '../auth/project-membership.guard';
import { RequireProject } from '../auth/require-project.decorator';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ version: '1' })
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get('projects/:projectId/tasks')
  @UseGuards(ProjectMembershipGuard)
  @RequireProject('projectId')
  async list(@Param('projectId') projectId: string) {
    return this.tasks.list(BigInt(projectId));
  }

  @Post('projects/:projectId/tasks')
  @UseGuards(ProjectMembershipGuard)
  @RequireProject('projectId')
  async create(@Param('projectId') projectId: string, @Body() dto: CreateTaskDto) {
    return this.tasks.create(BigInt(projectId), dto);
  }

  @Get('tasks/:id')
  async getById(@Param('id') id: string) {
    return this.tasks.getById(BigInt(id));
  }

  @Patch('tasks/:id')
  async update(@Param('id') id: string, @Body() dto: UpdateTaskDto) {
    return this.tasks.update(BigInt(id), dto);
  }

  @Patch('tasks/:id/progress')
  async updateProgress(@Param('id') id: string, @Body() dto: UpdateProgressDto) {
    return this.tasks.updateProgress(BigInt(id), dto);
  }

  @Patch('tasks/:id/order')
  async updateOrder(@Param('id') id: string, @Body() dto: UpdateOrderDto) {
    return this.tasks.updateOrder(BigInt(id), dto);
  }

  @Delete('tasks/:id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.tasks.remove(BigInt(id));
  }
}
