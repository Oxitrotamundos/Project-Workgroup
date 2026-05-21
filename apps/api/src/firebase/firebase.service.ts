import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: admin.app.App | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const raw = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (!raw) {
      this.logger.warn(
        'FIREBASE_SERVICE_ACCOUNT_JSON not set; Firebase auth disabled',
      );
      return;
    }
    const creds = JSON.parse(raw) as admin.ServiceAccount;
    this.app = admin.initializeApp({
      credential: admin.credential.cert(creds),
    });
  }

  async verifyIdToken(token: string): Promise<admin.auth.DecodedIdToken> {
    if (!this.app) throw new Error('Firebase not initialized');
    return this.app.auth().verifyIdToken(token);
  }
}
