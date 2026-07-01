import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// RFC 9728 Protected Resource Metadata — público, sin AuthGuard. Fuera del prefijo /v1.
@Controller({ version: VERSION_NEUTRAL })
export class OAuthMetadataController {
  constructor(private readonly config: ConfigService) {}

  @Get('.well-known/oauth-protected-resource')
  protectedResource() {
    const issuer = this.config.get<string>('MCP_OAUTH_ISSUER');
    return {
      resource: this.config.get<string>('MCP_OAUTH_AUDIENCE'),
      authorization_servers: issuer ? [issuer] : [],
    };
  }
}
