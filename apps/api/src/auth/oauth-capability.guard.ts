import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DENY_OAUTH_KEY } from './deny-oauth.decorator';
import type { AuthUser } from './auth.guard';

// Complementa el bloqueo de DELETE del AuthGuard: cierra rutas de escalada (p. ej. acuñar
// API keys) para cualquier método HTTP, no solo DELETE. Se activa vía @DenyOAuth().
@Injectable()
export class OAuthCapabilityGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const denied = this.reflector.getAllAndOverride<boolean | undefined>(
      DENY_OAUTH_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!denied) return true;
    const req = context.switchToHttp().getRequest<{ user?: AuthUser }>();
    if (req.user?.via === 'oauth') {
      throw new ForbiddenException('mcp tokens may not access this route');
    }
    return true;
  }
}
