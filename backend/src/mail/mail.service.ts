import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  passwordChangedTemplate,
  passwordResetTemplate,
  verificationTemplate,
  welcomeTemplate,
} from './templates';

export interface SendEmailParams {
  to: string;
  subject: string;
  htmlBody: string;
}

interface MailUser {
  email: string;
  firstName?: string;
}

/**
 * All outbound email is routed through OneSignal's email channel. When the
 * OneSignal credentials are not configured, every method is a no-op that logs a
 * warning instead of throwing — so the API runs fine before creds are added.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {}

  private get appId(): string {
    return (
      this.configService.get<string>('configuration.oneSignal.appId') || ''
    );
  }

  private get apiKey(): string {
    return (
      this.configService.get<string>('configuration.oneSignal.apiKey') || ''
    );
  }

  private get baseUrl(): string {
    return (
      this.configService.get<string>('configuration.oneSignal.baseUrl') ||
      'https://api.onesignal.com'
    );
  }

  private get fromName(): string {
    return (
      this.configService.get<string>('configuration.oneSignal.fromName') ||
      'Bennie Connect'
    );
  }

  private get fromEmail(): string {
    return (
      this.configService.get<string>('configuration.oneSignal.fromEmail') || ''
    );
  }

  private get appUrl(): string {
    return (
      this.configService.get<string>('configuration.app.url') ||
      'http://localhost:3000'
    );
  }

  async sendEmail({
    to,
    subject,
    htmlBody,
  }: SendEmailParams): Promise<boolean> {
    if (!this.appId || !this.apiKey) {
      this.logger.warn(
        `OneSignal not configured — skipping email "${subject}" to ${to}`,
      );
      return false;
    }

    try {
      const payload: Record<string, any> = {
        app_id: this.appId,
        email_subject: subject,
        email_body: htmlBody,
        include_email_tokens: [to],
        target_channel: 'email',
        email_from_name: this.fromName,
      };
      if (this.fromEmail) {
        payload.email_from_address = this.fromEmail;
      }

      await axios.post(`${this.baseUrl}/notifications`, payload, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Key ${this.apiKey}`,
        },
      });
      this.logger.log(`Email "${subject}" sent to ${to}`);
      return true;
    } catch (error: any) {
      this.logger.error(
        `Failed to send email "${subject}" to ${to}: ${
          error?.response?.data
            ? JSON.stringify(error.response.data)
            : error?.message
        }`,
      );
      return false;
    }
  }

  async sendWelcomeEmail(user: MailUser): Promise<boolean> {
    return this.sendEmail({
      to: user.email,
      subject: 'Welcome to Bennie Connect',
      htmlBody: welcomeTemplate(this.appUrl, user.firstName),
    });
  }

  async sendVerificationEmail(user: MailUser, token: string): Promise<boolean> {
    return this.sendEmail({
      to: user.email,
      subject: 'Verify your Bennie Connect email',
      htmlBody: verificationTemplate(this.appUrl, token, user.firstName),
    });
  }

  async sendPasswordResetEmail(
    user: MailUser,
    resetLink: string,
  ): Promise<boolean> {
    return this.sendEmail({
      to: user.email,
      subject: 'Reset your Bennie Connect password',
      htmlBody: passwordResetTemplate(this.appUrl, resetLink, user.firstName),
    });
  }

  async sendPasswordChangedEmail(user: MailUser): Promise<boolean> {
    return this.sendEmail({
      to: user.email,
      subject: 'Your Bennie Connect password was changed',
      htmlBody: passwordChangedTemplate(this.appUrl, user.firstName),
    });
  }
}
