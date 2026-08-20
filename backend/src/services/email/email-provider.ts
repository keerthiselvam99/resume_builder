import { randomUUID } from 'node:crypto';

export interface EmailMessage {
  to: string;
  kind: 'verify-email' | 'reset-password' | 'password-changed';
  subject: string;
  actionUrl?: string;
  expiresAt?: string;
}
export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

export class CaptureEmailProvider implements EmailProvider {
  private readonly captured: Array<EmailMessage & { id: string; createdAt: string }> = [];
  get messages(): readonly (EmailMessage & { id: string; createdAt: string })[] {
    return this.captured;
  }
  async send(message: EmailMessage) {
    this.captured.push({
      ...structuredClone(message),
      id: randomUUID(),
      createdAt: new Date().toISOString(),
    });
  }
  clear() {
    this.captured.length = 0;
  }
  list() {
    return this.captured.map(({ id, to, kind, subject, createdAt, expiresAt, actionUrl }) => ({
      id,
      recipient: to,
      kind,
      subject,
      createdAt,
      expiresAt: expiresAt ?? null,
      hasAction: Boolean(actionUrl),
    }));
  }
  actionPath(id: string): string | null {
    const actionUrl = this.captured.find((message) => message.id === id)?.actionUrl;
    if (!actionUrl) return null;
    const parsed = new URL(actionUrl);
    return `${parsed.pathname}${parsed.search}`;
  }
}

class UnconfiguredEmailProvider implements EmailProvider {
  async send() {
    throw new Error(
      'A production email provider must be configured before account recovery can send email.'
    );
  }
}

export const captureEmailProvider = new CaptureEmailProvider();
export function getEmailProvider(): EmailProvider {
  const capture = process.env.DEV_EMAIL_CAPTURE === 'true';
  if (capture && process.env.NODE_ENV === 'production')
    throw new Error('DEV_EMAIL_CAPTURE cannot be used in production.');
  if (capture) return captureEmailProvider;
  return new UnconfiguredEmailProvider();
}

export function isDevelopmentMailboxEnabled(): boolean {
  return process.env.DEV_EMAIL_CAPTURE === 'true' && process.env.NODE_ENV !== 'production';
}
