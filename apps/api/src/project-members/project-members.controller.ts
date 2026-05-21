import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AddProjectMemberDto } from '@project-workgroup/shared';
import { AuthGuard } from '../auth/auth.guard';
import { ProjectMembershipGuard } from '../auth/project-membership.guard';
import { RequireProject } from '../auth/require-project.decorator';
import { ProjectMembersService } from './project-members.service';

@ApiTags('project-members')
@ApiBearerAuth()
@UseGuards(AuthGuard, ProjectMembershipGuard)
@RequireProject('projectId')
@Controller({ path: 'projects/:projectId/members', version: '1' })
export class ProjectMembersController {
  constructor(private readonly members: ProjectMembersService) {}

  @Post()
  @RequireProject('projectId', { minRole: 'manager' })
  async add(
    @Param('projectId') projectId: string,
    @Body() dto: AddProjectMemberDto,
  ) {
    return this.members.add(BigInt(projectId), dto);
  }

  @Get()
  async list(@Param('projectId') projectId: string) {
    return this.members.list(BigInt(projectId));
  }

  @Delete(':userId')
  @HttpCode(204)
  @RequireProject('projectId', { minRole: 'manager' })
  async remove(
    @Param('projectId') projectId: string,
    @Param('userId') userId: string,
  ) {
    await this.members.remove(BigInt(projectId), BigInt(userId));
  }
}
