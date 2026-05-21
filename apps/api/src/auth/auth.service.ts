import { Injectable, UnauthorizedException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly prisma: PrismaService,
  ) {}

  async syncFromToken(token: string) {
    const decoded = await this.firebase.verifyIdToken(token).catch(() => {
      throw new UnauthorizedException('invalid id token');
    });
    const user = await this.prisma.user.upsert({
      where: { firebaseUid: decoded.uid },
      update: {
        email: decoded.email ?? undefined,
        displayName: decoded.name ?? decoded.email ?? 'User',
        avatarUrl: decoded.picture ?? undefined,
      },
      create: {
        firebaseUid: decoded.uid,
        email: decoded.email ?? `${decoded.uid}@unknown.local`,
        displayName: decoded.name ?? decoded.email ?? 'User',
        avatarUrl: decoded.picture ?? undefined,
        role: 'member',
      },
    });
    return user;
  }
}
