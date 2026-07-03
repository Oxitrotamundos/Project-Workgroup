import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  CreateUserAdminDto,
  SearchUsersQueryDto,
  UpdateUserAdminDto,
} from '@project-workgroup/shared';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller({ path: 'users', version: '1' })
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  @Get('me')
  async me(@CurrentUser() user: AuthUser) {
    const full = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    return {
      id: full.id.toString(),
      email: full.email,
      displayName: full.displayName,
      role: full.role,
      status: full.status,
      avatarUrl: full.avatarUrl,
    };
  }

  @Get()
  async search(@Query() q: SearchUsersQueryDto) {
    return this.users.search(q);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  async adminCreate(@Body() dto: CreateUserAdminDto) {
    return this.users.adminCreate(dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async adminUpdate(@Param('id') id: string, @Body() dto: UpdateUserAdminDto) {
    return this.users.adminUpdate(BigInt(id), dto);
  }
}
