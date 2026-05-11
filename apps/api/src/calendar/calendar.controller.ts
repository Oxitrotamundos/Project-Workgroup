import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  UpsertCalendarDto,
  WorkingCalendarResponse,
} from '@project-workgroup/shared';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ProjectMembershipGuard } from '../auth/project-membership.guard';
import { RequireProject } from '../auth/require-project.decorator';
import { CalendarService } from './calendar.service';

@ApiTags('calendar')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ version: '1' })
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get('calendar/global')
  async getGlobal(): Promise<WorkingCalendarResponse> {
    return this.calendar.getGlobal();
  }

  @Patch('calendar/global')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async upsertGlobal(
    @Body() dto: UpsertCalendarDto,
  ): Promise<WorkingCalendarResponse> {
    return this.calendar.upsertGlobal(dto);
  }

  @Get('projects/:id/calendar')
  @UseGuards(ProjectMembershipGuard)
  @RequireProject('id')
  async getForProject(
    @Param('id') id: string,
  ): Promise<WorkingCalendarResponse> {
    return this.calendar.getForProject(BigInt(id));
  }

  @Patch('projects/:id/calendar')
  @UseGuards(ProjectMembershipGuard)
  @RequireProject('id')
  async upsertForProject(
    @Param('id') id: string,
    @Body() dto: UpsertCalendarDto,
  ): Promise<WorkingCalendarResponse> {
    return this.calendar.upsertForProject(BigInt(id), dto);
  }

  @Delete('projects/:id/calendar')
  @HttpCode(204)
  @UseGuards(ProjectMembershipGuard)
  @RequireProject('id')
  async deleteProjectOverride(@Param('id') id: string): Promise<void> {
    await this.calendar.deleteProjectOverride(BigInt(id));
  }
}
