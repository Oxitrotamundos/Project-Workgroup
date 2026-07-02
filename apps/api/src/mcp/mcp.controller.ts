import {
  Controller,
  Post,
  Req,
  Res,
  UseGuards,
  VERSION_NEUTRAL,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import { handleMcpRequest } from '@project-workgroup/mcp';
import { AuthGuard } from '../auth/auth.guard';

// POST /mcp: entrada del transporte Streamable HTTP. AuthGuard valida el JWT (3ª vía) → 401+WWW-Auth
// sin token, que es justo lo que claude.ai necesita para el discovery.
// ThrottlerGuard acota el rate-limit a esta superficie pública (no es global → /v1 y el web intactos).
@Controller({ version: VERSION_NEUTRAL })
@UseGuards(AuthGuard, ThrottlerGuard)
export class McpController {
  constructor(private readonly config: ConfigService) {}

  @Post('mcp')
  async handle(@Req() req: any, @Res() res: any): Promise<void> {
    const header: string = req.headers['authorization'] ?? '';
    const token = header.startsWith('Bearer ')
      ? header.slice('Bearer '.length).trim()
      : '';
    const port = this.config.get<string>('PORT') ?? '3000';
    const baseUrl =
      this.config.get<string>('MCP_SELF_BASE_URL') ??
      `http://127.0.0.1:${port}`;
    await handleMcpRequest(req, res, req.body, { baseUrl, token });
  }
}
