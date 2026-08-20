import { randomUUID } from 'node:crypto';
import { Resend } from 'resend';
import { EmailConfiguration, resolveEmailConfiguration } from './email-config';
import { renderEmail } from './email-templates';

export type EmailKind = 'verify-email' | 'reset-password' | 'password-changed';
export type EmailFailureCategory =
  | 'configuration'
  | 'authentication'
  | 'rate_limited'
  | 'temporary_provider_failure'
  | 'permanent_recipient_failure';
export interface EmailMessage {
  to: string;
  kind: EmailKind;
  subject: string;
  actionUrl?: string;
  expiresAt?: string;
  occurredAt?: string;
  idempotencyKey?: string;
}
export interface EmailDeliveryResult {
  provider: 'capture' | 'resend';
  messageId: string;
}
export interface EmailProvider {
  send(message: EmailMessage, signal?: AbortSignal): Promise<EmailDeliveryResult>;
}

export class EmailDeliveryError extends Error {
  constructor(
    readonly category: EmailFailureCategory,
    readonly retryable: boolean
  ) {
    super('Transactional email delivery failed.');
    this.name = 'EmailDeliveryError';
  }
}

export class CaptureEmailProvider implements EmailProvider {
  private readonly captured: Array<EmailMessage & { id: string; createdAt: string }> = [];
  get messages(): readonly (EmailMessage & { id: string; createdAt: string })[] {
    return this.captured;
  }
  async send(message: EmailMessage, signal?: AbortSignal): Promise<EmailDeliveryResult> {
    if (signal?.aborted) throw new EmailDeliveryError('temporary_provider_failure', true);
    const id = randomUUID();
    this.captured.push({ ...structuredClone(message), id, createdAt: new Date().toISOString() });
    return { provider: 'capture', messageId: id };
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

interface ProviderError {
  name?: string;
  message?: string;
  statusCode?: number | null;
}
export interface ResendClient {
  send(
    payload: Record<string, unknown>,
    options?: { headers?: Record<string, string> }
  ): Promise<{ data: { id: string } | null; error: ProviderError | null }>;
}

export class ResendEmailProvider implements EmailProvider {
  constructor(
    private readonly emailConfig: EmailConfiguration,
    private readonly client: ResendClient = {
      send: (payload, options) =>
        new Resend(emailConfig.resendApiKey).emails.send(payload as never, options as never),
    }
  ) {}
  async send(message: EmailMessage, signal?: AbortSignal): Promise<EmailDeliveryResult> {
    const rendered = renderEmail(message);
    const payload: Record<string, unknown> = {
      from: `${this.emailConfig.fromName} <${this.emailConfig.fromAddress}>`,
      to: [message.to],
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    };
    if (this.emailConfig.replyTo) payload.replyTo = this.emailConfig.replyTo;
    let timer: NodeJS.Timeout | undefined;
    try {
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new EmailDeliveryError('temporary_provider_failure', true)),
          this.emailConfig.timeoutMs
        );
      });
      const abort = new Promise<never>((_, reject) => {
        signal?.addEventListener(
          'abort',
          () => reject(new EmailDeliveryError('temporary_provider_failure', true)),
          { once: true }
        );
      });
      const response = await Promise.race([
        this.client.send(payload, {
          headers: { 'Idempotency-Key': message.idempotencyKey ?? randomUUID() },
        }),
        timeout,
        abort,
      ]);
      if (response.error) throw classifyProviderError(response.error);
      if (!response.data?.id) throw new EmailDeliveryError('temporary_provider_failure', true);
      return { provider: 'resend', messageId: response.data.id };
    } catch (error) {
      if (error instanceof EmailDeliveryError) throw error;
      throw new EmailDeliveryError('temporary_provider_failure', true);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

export class DisabledEmailProvider implements EmailProvider {
  async send(): Promise<EmailDeliveryResult> {
    throw new EmailDeliveryError('configuration', false);
  }
}
function classifyProviderError(error: ProviderError): EmailDeliveryError {
  const status = error.statusCode;
  const name = error.name?.toLowerCase() ?? '';
  if (status === 401 || status === 403 || name.includes('auth'))
    return new EmailDeliveryError('authentication', false);
  if (status === 429 || name.includes('rate')) return new EmailDeliveryError('rate_limited', true);
  if (status != null && status >= 400 && status < 500)
    return new EmailDeliveryError('permanent_recipient_failure', false);
  return new EmailDeliveryError('temporary_provider_failure', true);
}

export const captureEmailProvider = new CaptureEmailProvider();
export function getEmailProvider(
  emailConfig: EmailConfiguration = resolveEmailConfiguration(),
  client?: ResendClient
): EmailProvider {
  if (emailConfig.provider === 'capture') return captureEmailProvider;
  if (emailConfig.provider === 'resend') return new ResendEmailProvider(emailConfig, client);
  return new DisabledEmailProvider();
}
export function isDevelopmentMailboxEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false;
  const emailConfig = resolveEmailConfiguration();
  return emailConfig.provider === 'capture';
}
