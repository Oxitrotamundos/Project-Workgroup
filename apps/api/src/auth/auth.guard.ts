import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { FirebaseService } from '../firebase/firebase.service';
import { PrismaService } from '../prisma/prisma.service';

export interface AuthUser {
  id: bigint;
  firebaseUid: string | null;
  role: 'admin' | 'pm' | 'member';
  via: 'firebase' | 'api_key';
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: AuthUser }>();
    const header = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('missing bearer token');
    const token = header.slice('Bearer '.length).trim();
    if (!token) throw new UnauthorizedException('empty token');

    const firebaseUser = await this.tryFirebase(token);
    if (firebaseUser) {
      req.user = firebaseUser;
      return true;
    }
    const apiKeyUser = await this.tryApiKey(token);
    if (apiKeyUser) {
      req.user = apiKeyUser;
      return true;
    }
    throw new UnauthorizedException('invalid token');
  }

  private async tryFirebase(token: string): Promise<AuthUser | null> {
    try {
      const decoded = await this.firebase.verifyIdToken(token);
      const user = await this.prisma.user.findUnique({ where: { firebaseUid: decoded.uid } });
      if (!user) return null;
      return { id: user.id, firebaseUid: user.firebaseUid, role: user.role as AuthUser['role'], via: 'firebase' };
    } catch {
      return null;
    }
  }

  private async tryApiKey(token: string): Promise<AuthUser | null> {
    const prefix = token.slice(0, Math.min(8, token.length));
    const candidates = await this.prisma.apiKey.findMany({
      where: { prefix, revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
      include: { user: true },
    });
    for (const cand of candidates) {
      if (await argon2.verify(cand.keyHash, token)) {
        await this.prisma.apiKey.update({ where: { id: cand.id }, data: { lastUsedAt: new Date() } });
        return { id: cand.user.id, firebaseUid: cand.user.firebaseUid, role: cand.user.role as AuthUser['role'], via: 'api_key' };
      }
    }
    return null;
  }
}
