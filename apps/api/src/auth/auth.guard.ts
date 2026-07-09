import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createLocalJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import * as argon2 from 'argon2';
import { FirebaseService } from '../firebase/firebase.service';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthUser {
  id: bigint;
  firebaseUid: string | null;
  role: 'admin' | 'pm' | 'member';
  via: 'firebase' | 'api_key' | 'oauth';
  scope?: string;
}

@Injectable()
export class AuthGuard implements CanActivate {
  // JWKS público del AS en memoria (mismo proceso): sin fetch HTTP a nuestro propio /jwks.
  private readonly oauthJwks: JWTVerifyGetKey | null;
  private readonly oauthIssuer?: string;
  private readonly oauthAudience?: string;
  private readonly resourceMetadataUrl?: string;

  constructor(
    private readonly firebase: FirebaseService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const jwksRaw = config.get<string>('MCP_OAUTH_JWKS');
    this.oauthIssuer = config.get<string>('MCP_OAUTH_ISSUER');
    this.oauthAudience = config.get<string>('MCP_OAUTH_AUDIENCE');
    this.oauthJwks =
      jwksRaw && this.oauthIssuer && this.oauthAudience
        ? createLocalJWKSet(JSON.parse(jwksRaw))
        : null;
    this.resourceMetadataUrl = this.oauthAudience
      ? `${this.oauthAudience.replace(/\/+$/, '')}/.well-known/oauth-protected-resource`
      : undefined;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      method: string;
      user?: AuthUser;
    }>();
    const header = req.headers['authorization'];
    if (!header?.startsWith('Bearer '))
      this.unauthorized(context, 'missing bearer token');
    const token = header.slice('Bearer '.length).trim();
    if (!token) this.unauthorized(context, 'empty token');

    const firebaseUser = await this.tryFirebase(token);
    if (firebaseUser) {
      req.user = firebaseUser;
      return true;
    }

    const oauthUser = await this.tryOAuthJwt(token);
    if (oauthUser) {
      // Postura A: un token MCP (via oauth) NO puede borrar por el API directo.
      // La API key local (via api_key) conserva el rol completo del dueño (asimetría aceptada).
      if (req.method === 'DELETE') {
        throw new ForbiddenException(
          'mcp tokens may not perform destructive operations',
        );
      }
      req.user = oauthUser;
      return true;
    }

    const apiKeyUser = await this.tryApiKey(token);
    if (apiKeyUser) {
      req.user = apiKeyUser;
      return true;
    }

    this.unauthorized(context, 'invalid token');
  }

  // 401 con puntero a la metadata del Resource Server (RFC 9728).
  private unauthorized(context: ExecutionContext, message: string): never {
    if (this.resourceMetadataUrl) {
      context
        .switchToHttp()
        .getResponse()
        .setHeader(
          'WWW-Authenticate',
          `Bearer resource_metadata="${this.resourceMetadataUrl}"`,
        );
    }
    throw new UnauthorizedException(message);
  }

  private async tryFirebase(token: string): Promise<AuthUser | null> {
    try {
      const decoded = await this.firebase.verifyIdToken(token);
      const user = await this.prisma.user.findUnique({
        where: { firebaseUid: decoded.uid },
      });
      if (!user) return null;
      if (user.status === 'disabled') return null;
      return {
        id: user.id,
        firebaseUid: user.firebaseUid,
        role: user.role as AuthUser['role'],
        via: 'firebase',
      };
    } catch {
      return null;
    }
  }

  private async tryOAuthJwt(token: string): Promise<AuthUser | null> {
    if (!this.oauthJwks) return null;
    try {
      const { payload } = await jwtVerify(token, this.oauthJwks, {
        issuer: this.oauthIssuer,
        audience: this.oauthAudience,
        algorithms: ['RS256'],
        // jose solo valida exp si está presente: forzamos su presencia para que no exista token sin caducidad.
        requiredClaims: ['exp'],
      });
      if (!payload.sub) return null;
      const user = await this.prisma.user.findUnique({
        where: { id: BigInt(payload.sub) },
      });
      if (!user) return null;
      if (user.status === 'disabled') return null;
      const scope =
        typeof payload.scope === 'string' ? payload.scope : undefined;
      return {
        id: user.id,
        firebaseUid: user.firebaseUid,
        role: user.role as AuthUser['role'],
        via: 'oauth',
        scope,
      };
    } catch {
      return null;
    }
  }

  private async tryApiKey(token: string): Promise<AuthUser | null> {
    const prefix = token.slice(0, Math.min(8, token.length));
    const candidates = await this.prisma.apiKey.findMany({
      where: {
        prefix,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      include: { user: true },
    });
    for (const cand of candidates) {
      if (await argon2.verify(cand.keyHash, token)) {
        if (cand.user.status === 'disabled') return null;
        await this.prisma.apiKey.update({
          where: { id: cand.id },
          data: { lastUsedAt: new Date() },
        });
        return {
          id: cand.user.id,
          firebaseUid: cand.user.firebaseUid,
          role: cand.user.role as AuthUser['role'],
          via: 'api_key',
        };
      }
    }
    return null;
  }
}
