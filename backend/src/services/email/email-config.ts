export type EmailProviderType = 'capture' | 'resend' | 'disabled';

export interface EmailConfiguration {
  provider: EmailProviderType;
  configured: boolean;
  resendApiKey?: string;
  fromName: string;
  fromAddress?: string;
  replyTo?: string;
  publicAppUrl: string;
  timeoutMs: number;
}

const emailPattern = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const hasControl = (value: string) =>
  [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || codePoint === 127;
  });

export function resolveEmailConfiguration(
  env: NodeJS.ProcessEnv = process.env
): EmailConfiguration {
  const provider = (env.EMAIL_PROVIDER ?? 'disabled') as EmailProviderType;
  if (!['capture', 'resend', 'disabled'].includes(provider))
    throw new Error('EMAIL_PROVIDER must be capture, resend, or disabled.');
  const production = env.NODE_ENV === 'production';
  if (production && provider === 'capture')
    throw new Error('EMAIL_PROVIDER=capture cannot be used in production.');
  const publicAppUrl = env.PUBLIC_APP_URL ?? env.APP_ORIGIN ?? 'http://127.0.0.1:4201';
  let parsed: URL;
  try {
    parsed = new URL(publicAppUrl);
  } catch {
    throw new Error('PUBLIC_APP_URL must be an absolute HTTP or HTTPS URL.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin === 'null')
    throw new Error('PUBLIC_APP_URL must be an absolute HTTP or HTTPS URL.');
  if (production && parsed.protocol !== 'https:')
    throw new Error('PUBLIC_APP_URL must use HTTPS in production.');
  const fromName = env.EMAIL_FROM_NAME ?? 'ResumeIQ';
  const fromAddress = env.EMAIL_FROM_ADDRESS?.trim();
  const replyTo = env.EMAIL_REPLY_TO?.trim();
  if (hasControl(fromName) || (fromAddress && hasControl(fromAddress)))
    throw new Error('Email sender fields must not contain control characters.');
  if (replyTo && (hasControl(replyTo) || !emailPattern.test(replyTo)))
    throw new Error('EMAIL_REPLY_TO must be a valid email address.');
  const resendApiKey = env.RESEND_API_KEY?.trim();
  if (provider === 'resend') {
    if (!resendApiKey) throw new Error('RESEND_API_KEY is required for EMAIL_PROVIDER=resend.');
    if (!fromAddress || !emailPattern.test(fromAddress))
      throw new Error('A valid EMAIL_FROM_ADDRESS is required for EMAIL_PROVIDER=resend.');
  }
  const timeoutMs = Number(env.EMAIL_REQUEST_TIMEOUT_MS ?? 8000);
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 30000)
    throw new Error('EMAIL_REQUEST_TIMEOUT_MS must be between 1000 and 30000.');
  return {
    provider,
    configured: provider === 'capture' || provider === 'resend',
    resendApiKey,
    fromName,
    fromAddress,
    replyTo,
    publicAppUrl: parsed.origin,
    timeoutMs,
  };
}
