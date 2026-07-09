import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CreateResourceDto,
  LinkResourceUserDto,
  ListResourcesQueryDto,
  UpdateResourceDto,
} from '@project-workgroup/shared';
import { AuthGuard } from '../auth/auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ResourcesService } from './resources.service';

@ApiTags('resources')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: 'resources', version: '1' })
export class ResourcesController {
  constructor(private readonly resources: ResourcesService) {}

  // Lectura abierta a cualquier autenticado: el selector de responsable del Gantt
  // la necesita para miembros no-admin. Las mutaciones son admin-only.
  @Get()
  async list(@Query() q: ListResourcesQueryDto) {
    return this.resources.list(q);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.resources.getById(BigInt(id));
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  async create(@Body() dto: CreateResourceDto) {
    return this.resources.create(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async update(@Param('id') id: string, @Body() dto: UpdateResourceDto) {
    return this.resources.update(BigInt(id), dto);
  }

  @Patch(':id/link-user')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async linkUser(@Param('id') id: string, @Body() dto: LinkResourceUserDto) {
    return this.resources.linkToUser(BigInt(id), BigInt(dto.userId));
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(RolesGuard)
  @Roles('admin')
  async remove(@Param('id') id: string) {
    await this.resources.remove(BigInt(id));
  }
}
