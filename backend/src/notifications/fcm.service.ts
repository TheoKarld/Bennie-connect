import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { App } from 'firebase-admin/app';
import type { MulticastMessage } from 'firebase-admin/messaging';

export interface FcmPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  /** Deep-link opened when the notification is clicked. */
  link?: string;
}

export interface FcmSendResult {
  /** Whether any message was dispatched. */
  sent: boolean;
  /** Tokens that FCM reported as invalid/unregistered — safe to prune. */
  invalidTokens: string[];
}

/**
 * Wraps firebase-admin for FCM web push. Mirrors MailService: when the Firebase
 * credentials are not configured, every send logs a warning and returns a no-op
 * result instead of throwing — so the API runs fine before creds are added.
 */
@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  private app?: App;
  private initialized = false;
  private configured = false;

  constructor(private readonly configService: ConfigService) {}

  private ensureInit(): void {
    if (this.initialized) {
      return;
    }
    this.initialized = true;

    const projectId =
      this.configService.get<string>('configuration.firebase.projectId') || '';
    const clientEmail =
      this.configService.get<string>('configuration.firebase.clientEmail') ||
      '';
    const privateKey =
      this.configService.get<string>('configuration.firebase.privateKey') || '';

    if (!projectId || !clientEmail || !privateKey) {
      this.configured = false;
      this.logger.warn(
        'Firebase not configured — FCM web push disabled (no-op).',
      );
      return;
    }

    try {
      // Lazy require the modular SDK so the dependency is only touched when
      // configured.
      /* eslint-disable-next-line @typescript-eslint/no-var-requires */
      const firebaseApp = require('firebase-admin/app');
      const { initializeApp, getApps, getApp, cert } = firebaseApp;
      const APP_NAME = 'bennie-fcm';
      const existing = (getApps() as App[]).find((a) => a?.name === APP_NAME);
      this.app = existing
        ? (getApp(APP_NAME) as App)
        : (initializeApp(
            {
              credential: cert({ projectId, clientEmail, privateKey }),
            },
            APP_NAME,
          ) as App);
      this.configured = true;
      this.logger.log('Firebase Admin initialized — FCM web push enabled.');
    } catch (error: any) {
      this.configured = false;
      this.logger.error(
        `Failed to initialize Firebase Admin: ${error?.message}`,
      );
    }
  }

  get isConfigured(): boolean {
    this.ensureInit();
    return this.configured;
  }

  /**
   * Multicast a web-push payload to a set of device tokens. Best-effort:
   * returns which tokens FCM flagged as invalid so the caller can delete them.
   * Never throws.
   */
  async sendToTokens(
    tokens: string[],
    payload: FcmPayload,
  ): Promise<FcmSendResult> {
    this.ensureInit();

    const unique = Array.from(new Set(tokens.filter(Boolean)));
    if (!this.configured || !this.app || unique.length === 0) {
      if (!this.configured && unique.length > 0) {
        this.logger.warn(
          `Firebase not configured — skipping FCM push "${payload.title}" to ${unique.length} token(s)`,
        );
      }
      return { sent: false, invalidTokens: [] };
    }

    const data: Record<string, string> = { ...(payload.data || {}) };

    const message: MulticastMessage = {
      tokens: unique,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data,
      webpush: {
        notification: {
          title: payload.title,
          body: payload.body,
        },
        fcmOptions: payload.link ? { link: payload.link } : undefined,
      },
    };

    try {
      /* eslint-disable-next-line @typescript-eslint/no-var-requires */
      const firebaseMessaging = require('firebase-admin/messaging');
      const response = await firebaseMessaging
        .getMessaging(this.app)
        .sendEachForMulticast(message);
      const invalidTokens: string[] = [];
      response.responses.forEach(
        (res: { success: boolean; error?: { code?: string } }, idx: number) => {
          if (!res.success) {
            const code = res.error?.code || '';
            if (
              code === 'messaging/invalid-registration-token' ||
              code === 'messaging/registration-token-not-registered'
            ) {
              invalidTokens.push(unique[idx]);
            }
          }
        },
      );
      this.logger.log(
        `FCM push "${payload.title}": ${response.successCount} sent, ${response.failureCount} failed, ${invalidTokens.length} invalid`,
      );
      return { sent: response.successCount > 0, invalidTokens };
    } catch (error: any) {
      this.logger.error(
        `FCM push "${payload.title}" failed: ${error?.message}`,
      );
      return { sent: false, invalidTokens: [] };
    }
  }
}
