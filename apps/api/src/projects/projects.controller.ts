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
import { CreateProjectDto, UpdateProjectDto } from '@project-workgroup/shared';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { ProjectMembershipGuard } from '../auth/project-membership.guard';
import { RequireProject } from '../auth/require-project.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { ProjectsService } from './projects.service';

@ApiTags('projects')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: 'projects', version: '1' })
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Post()
  async create(@Body() dto: CreateProjectDto, @CurrentUser() user: AuthUser) {
    return this.projects.create(dto, user.id);
  }

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return this.projects.listForUser(user.id);
  }

  @Get(':id')
  @UseGuards(ProjectMembershipGuard)
  @RequireProject('id')
  async getById(@Param('id') id: string) {
    return this.projects.getById(BigInt(id));
  }

  @Patch(':id')
  @UseGuards(ProjectMembershipGuard)
  @RequireProject('id')
  async update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projects.update(BigInt(id), dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(ProjectMembershipGuard)
  @RequireProject('id')
  async remove(@Param('id') id: string) {
    await this.projects.remove(BigInt(id));
  }
}
