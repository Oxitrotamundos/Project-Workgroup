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

  async createUser(input: {
    email: string;
    password: string;
    displayName: string;
  }): Promise<string> {
    if (!this.app) throw new Error('Firebase not initialized');
    const rec = await this.app.auth().createUser({
      email: input.email,
      password: input.password,
      displayName: input.displayName,
    });
    return rec.uid;
  }

  // Compensación: borra el usuario de Firebase si la transacción DB falla tras crearlo.
  async deleteUser(uid: string): Promise<void> {
    if (!this.app) return;
    await this.app
      .auth()
      .deleteUser(uid)
      .catch(() => undefined);
  }
}
