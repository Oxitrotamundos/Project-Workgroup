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
import { CreateApiKeyDto } from '@project-workgroup/shared';
import { AuthGuard, AuthUser } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { OAuthCapabilityGuard } from '../auth/oauth-capability.guard';
import { DenyOAuth } from '../auth/deny-oauth.decorator';
import { ApiKeysService } from './api-keys.service';

// Un token MCP (via:'oauth') no gestiona API keys: cerraría la garantía de "no borrar" acuñando
// una credencial via:'api_key' con el rol completo del dueño y sin el bloqueo de DELETE.
@ApiTags('api-keys')
@ApiBearerAuth()
@UseGuards(AuthGuard, OAuthCapabilityGuard)
@DenyOAuth()
@Controller({ path: 'me/api-keys', version: '1' })
export class ApiKeysController {
  constructor(private readonly svc: ApiKeysService) {}

  @Get() list(@CurrentUser() user: AuthUser) {
    return this.svc.list(user.id);
  }

  @Post() create(@CurrentUser() user: AuthUser, @Body() dto: CreateApiKeyDto) {
    return this.svc.create(user.id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.svc.revoke(user.id, BigInt(id));
  }
}
