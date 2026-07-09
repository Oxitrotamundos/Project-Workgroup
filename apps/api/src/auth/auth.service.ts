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
    const displayName = decoded.name ?? decoded.email ?? 'User';
    const avatarUrl = decoded.picture ?? undefined;

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { firebaseUid: decoded.uid },
        update: {
          email: decoded.email ?? undefined,
          displayName,
          avatarUrl,
        },
        create: {
          firebaseUid: decoded.uid,
          email: decoded.email ?? `${decoded.uid}@unknown.local`,
          displayName,
          avatarUrl,
          role: 'member',
        },
      });

      // Invariante: cada user real tiene un resource enlazado (kind='user'). Se crea
      // al alta y se mantiene sincronizado con el perfil de Firebase en cada login.
      await tx.resource.upsert({
        where: { userId: user.id },
        update: {
          name: user.displayName,
          email: user.email,
          avatarUrl: user.avatarUrl,
        },
        create: {
          name: user.displayName,
          email: user.email,
          avatarUrl: user.avatarUrl,
          kind: 'user',
          userId: user.id,
        },
      });

      return user;
    });
  }
}
