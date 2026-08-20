import { describe, expect, it, vi } from 'vitest';
import { resolveEmailConfiguration } from '../src/services/email/email-config';
import {
  CaptureEmailProvider,
  DisabledEmailProvider,
  EmailDeliveryError,
  getEmailProvider,
  ResendClient,
  ResendEmailProvider,
} from '../src/services/email/email-provider';
import { renderEmail } from '../src/services/email/email-templates';

const validEnv = {
  NODE_ENV: 'staging',
  EMAIL_PROVIDER: 'resend',
  RESEND_API_KEY: 're_test_not_real',
  EMAIL_FROM_NAME: 'ResumeIQ',
  EMAIL_FROM_ADDRESS: 'security@example.test',
  PUBLIC_APP_URL: 'https://resume.example.test',
};
const resendConfig = () => resolveEmailConfiguration(validEnv);
const verification = {
  to: 'person@example.test',
  kind: 'verify-email' as const,
  subject: 'ignored',
  actionUrl: 'https://resume.example.test/verify-email?token=secret-token',
  expiresAt: '2026-08-21T00:00:00.000Z',
};

describe('email configuration and provider selection', () => {
  it('selects capture, resend, and disabled explicitly', () => {
    expect(
      getEmailProvider(resolveEmailConfiguration({ EMAIL_PROVIDER: 'capture' }))
    ).toBeInstanceOf(CaptureEmailProvider);
    expect(getEmailProvider(resendConfig(), { send: vi.fn() })).toBeInstanceOf(ResendEmailProvider);
    expect(
      getEmailProvider(resolveEmailConfiguration({ EMAIL_PROVIDER: 'disabled' }))
    ).toBeInstanceOf(DisabledEmailProvider);
  });
  it('rejects capture and non-HTTPS app URLs in production', () => {
    expect(() =>
      resolveEmailConfiguration({
        NODE_ENV: 'production',
        EMAIL_PROVIDER: 'capture',
        PUBLIC_APP_URL: 'https://app.example.test',
      })
    ).toThrow(/cannot be used/);
    expect(() =>
      resolveEmailConfiguration({
        ...validEnv,
        NODE_ENV: 'production',
        PUBLIC_APP_URL: 'http://app.example.test',
      })
    ).toThrow(/HTTPS/);
  });
  it('requires safe complete Resend configuration', () => {
    expect(() => resolveEmailConfiguration({ EMAIL_PROVIDER: 'resend' })).toThrow(/RESEND_API_KEY/);
    expect(() => resolveEmailConfiguration({ ...validEnv, EMAIL_FROM_ADDRESS: 'bad' })).toThrow(
      /EMAIL_FROM_ADDRESS/
    );
    expect(() =>
      resolveEmailConfiguration({ ...validEnv, EMAIL_FROM_NAME: 'ResumeIQ\nBcc:x@example.test' })
    ).toThrow(/control/);
  });
});

describe('transactional templates', () => {
  it.each([
    ['verify-email', 'Verify your ResumeIQ email'],
    ['reset-password', 'Reset your ResumeIQ password'],
    ['password-changed', 'Your ResumeIQ password was changed'],
  ] as const)('renders HTML and text for %s', (kind, subject) => {
    const output = renderEmail({
      ...verification,
      kind,
      occurredAt: '2026-08-20T10:00:00.000Z',
      actionUrl: kind === 'password-changed' ? undefined : verification.actionUrl,
    });
    expect(output.subject).toBe(subject);
    expect(output.html).toContain('<main');
    expect(output.text).toContain(subject);
  });
  it('escapes action links and contains no remote image or executable content', () => {
    const output = renderEmail({
      ...verification,
      actionUrl: 'https://resume.example.test/verify-email?token="><script>x</script>',
    });
    expect(output.html).not.toContain('<script');
    expect(output.html).not.toContain('<img');
    expect(output.html).toContain('&lt;script');
  });
});

describe('Resend delivery', () => {
  it('sends one HTML/text request and captures the provider message id', async () => {
    const send = vi.fn().mockResolvedValue({ data: { id: 'msg_123' }, error: null });
    const result = await new ResendEmailProvider(resendConfig(), { send }).send(verification);
    expect(result).toEqual({ provider: 'resend', messageId: 'msg_123' });
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][0]).toMatchObject({
      to: ['person@example.test'],
      subject: 'Verify your ResumeIQ email',
    });
  });
  it.each([
    [401, 'authentication', false],
    [429, 'rate_limited', true],
    [503, 'temporary_provider_failure', true],
    [422, 'permanent_recipient_failure', false],
  ] as const)('classifies provider status %s', async (statusCode, category, retryable) => {
    const client: ResendClient = {
      send: vi.fn().mockResolvedValue({ data: null, error: { statusCode } }),
    };
    await expect(
      new ResendEmailProvider(resendConfig(), client).send(verification)
    ).rejects.toMatchObject({ category, retryable });
  });
  it('times out without exposing payloads or API keys', async () => {
    const config = { ...resendConfig(), timeoutMs: 10 };
    const client: ResendClient = {
      send: vi.fn(() => new Promise<{ data: { id: string } | null; error: null }>(() => undefined)),
    };
    let error: EmailDeliveryError | undefined;
    try {
      await new ResendEmailProvider(config, client).send(verification);
    } catch (value) {
      error = value as EmailDeliveryError;
    }
    expect(error).toBeDefined();
    expect(error).toMatchObject({ category: 'temporary_provider_failure', retryable: true });
    expect(error!.message).not.toContain('secret-token');
    expect(error!.message).not.toContain(validEnv.RESEND_API_KEY);
  });
  it('supports caller cancellation', async () => {
    const controller = new AbortController();
    const client: ResendClient = {
      send: vi.fn(() => new Promise<{ data: { id: string } | null; error: null }>(() => undefined)),
    };
    const pending = new ResendEmailProvider(resendConfig(), client).send(
      verification,
      controller.signal
    );
    controller.abort();
    await expect(pending).rejects.toMatchObject({
      category: 'temporary_provider_failure',
      retryable: true,
    });
  });
});
