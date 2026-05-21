import {
  Controller,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('sync')
  async sync(@Headers('authorization') authHeader?: string) {
    if (!authHeader?.startsWith('Bearer '))
      throw new UnauthorizedException('missing bearer token');
    const token = authHeader.slice('Bearer '.length).trim();
    const user = await this.auth.syncFromToken(token);
    return {
      id: user.id.toString(),
      firebaseUid: user.firebaseUid,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      avatarUrl: user.avatarUrl,
    };
  }
}
