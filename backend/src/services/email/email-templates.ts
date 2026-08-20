import type { EmailMessage } from './email-provider';

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}
const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!
  );
function layout(subject: string, body: string, text: string): RenderedEmail {
  return {
    subject,
    html: `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f8fafc;color:#172033;font-family:Arial,sans-serif"><main style="max-width:600px;margin:auto;padding:32px 20px"><h1 style="font-size:24px">${escapeHtml(subject)}</h1>${body}<p style="color:#475569;font-size:13px">ResumeIQ account security</p></main></body></html>`,
    text,
  };
}
export function renderEmail(message: EmailMessage): RenderedEmail {
  if (message.kind === 'verify-email') {
    const url = escapeHtml(message.actionUrl!);
    const expiry = escapeHtml(message.expiresAt!);
    return layout(
      'Verify your ResumeIQ email',
      `<p>Confirm your email address to finish creating your account.</p><p><a href="${url}" style="display:inline-block;background:#173b67;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none">Verify email</a></p><p>Or copy this URL:<br><a href="${url}">${url}</a></p><p>This link expires at ${expiry}.</p><p>Ignore this email if you did not create this account.</p>`,
      `Verify your ResumeIQ email\n\nConfirm your email address:\n${message.actionUrl}\n\nThis link expires at ${message.expiresAt}.\nIgnore this email if you did not create this account.`
    );
  }
  if (message.kind === 'reset-password') {
    const url = escapeHtml(message.actionUrl!);
    const expiry = escapeHtml(message.expiresAt!);
    return layout(
      'Reset your ResumeIQ password',
      `<p>A password reset was requested for this email address.</p><p><a href="${url}" style="display:inline-block;background:#173b67;color:#fff;padding:12px 18px;border-radius:6px;text-decoration:none">Reset password</a></p><p>Or copy this URL:<br><a href="${url}">${url}</a></p><p>This link expires at ${expiry}.</p><p>If you did not request this, ignore this email and keep your account secure.</p>`,
      `Reset your ResumeIQ password\n\nUse this link to reset your password:\n${message.actionUrl}\n\nThis link expires at ${message.expiresAt}.\nIf you did not request this, ignore this email and keep your account secure.`
    );
  }
  const changedAt = escapeHtml(message.occurredAt ?? new Date().toISOString());
  return layout(
    'Your ResumeIQ password was changed',
    `<p>Your ResumeIQ password was changed at ${changedAt}.</p><p>If this was unexpected, reset your password again and contact support.</p><p>No password or session information is included in this message.</p>`,
    `Your ResumeIQ password was changed\n\nChanged at: ${message.occurredAt ?? changedAt}\n\nIf this was unexpected, reset your password again and contact support.`
  );
}
