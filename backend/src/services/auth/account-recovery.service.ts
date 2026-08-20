import { config } from '../../config/config';
import { UnauthorizedError, ValidationError } from '../../http/errors';
import { getRepositories } from '../../repositories';
import { getEmailProvider } from '../email/email-provider';
import { generateActionToken, hashActionToken } from '../security/action-tokens';
import { hashPassword, verifyPassword } from '../security/password';
import { validateEmail, validatePassword } from '../security/validate';

const invalid = () => new UnauthorizedError('This link is invalid or has expired.');
export class AccountRecoveryService {
  async sendVerification(userId: string, email: string) {
    const { raw, hash: tokenHash, id } = generateActionToken();
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + config.auth.verificationTtlHours * 3600000
    ).toISOString();
    await getRepositories().actionTokens.createReplacing({
      id,
      tokenHash,
      userId,
      purpose: 'verify_email',
      createdAt: now.toISOString(),
      expiresAt,
    });
    await getEmailProvider().send({
      to: email,
      kind: 'verify-email',
      subject: 'Verify your ResumeIQ email',
      actionUrl: `${config.auth.appOrigin}/verify-email?token=${encodeURIComponent(raw)}`,
      expiresAt,
    });
    await getRepositories().audit.record({
      actorUserId: userId,
      action: 'auth.verification-requested',
      details: 'Verification email requested.',
    });
  }
  async resend(email: string) {
    if (validateEmail(email)) return;
    const user = await getRepositories().users.findByEmail(email);
    if (user && user.status === 'active' && user.emailVerifiedAt === null)
      await this.sendVerification(user.id, user.email);
  }
  async verify(raw: string) {
    if (typeof raw !== 'string' || raw.length < 32) throw invalid();
    const repos = getRepositories();
    const token = await repos.actionTokens.consume(
      hashActionToken(raw),
      'verify_email',
      new Date().toISOString()
    );
    if (!token) {
      await repos.audit.record({
        actorUserId: null,
        action: 'auth.verification-failed',
        details: 'Invalid or expired verification token.',
      });
      throw invalid();
    }
    await repos.users.markEmailVerified(token.userId, new Date().toISOString());
    await repos.actionTokens.revokeAllForUser(token.userId, 'verify_email');
    await repos.audit.record({
      actorUserId: token.userId,
      action: 'auth.email-verified',
      details: 'Email verified.',
    });
  }
  async forgot(email: string) {
    if (validateEmail(email)) return;
    const user = await getRepositories().users.findByEmail(email);
    if (!user || user.status !== 'active') return;
    const { raw, hash: tokenHash, id } = generateActionToken();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.auth.resetTtlMinutes * 60000).toISOString();
    await getRepositories().actionTokens.createReplacing({
      id,
      tokenHash,
      userId: user.id,
      purpose: 'reset_password',
      createdAt: now.toISOString(),
      expiresAt,
    });
    await getEmailProvider().send({
      to: user.email,
      kind: 'reset-password',
      subject: 'Reset your ResumeIQ password',
      actionUrl: `${config.auth.appOrigin}/reset-password?token=${encodeURIComponent(raw)}`,
      expiresAt,
    });
    await getRepositories().audit.record({
      actorUserId: user.id,
      action: 'auth.password-reset-requested',
      details: 'Password reset requested.',
    });
  }
  async reset(raw: string, newPassword: string) {
    const issue = validatePassword(newPassword);
    if (issue) throw new ValidationError([issue.message]);
    const repos = getRepositories();
    const token = await repos.actionTokens.consume(
      hashActionToken(raw),
      'reset_password',
      new Date().toISOString()
    );
    if (!token) {
      await repos.audit.record({
        actorUserId: null,
        action: 'auth.password-reset-failed',
        details: 'Invalid or expired reset token.',
      });
      throw invalid();
    }
    const user = await repos.users.findById(token.userId);
    if (!user || user.status !== 'active') throw invalid();
    if (await verifyPassword(newPassword, user.passwordHash))
      throw new ValidationError(['New password must differ from the current password.']);
    await repos.users.updatePasswordHash(user.id, await hashPassword(newPassword));
    await repos.refreshTokens.revokeAllForUser(user.id);
    await repos.actionTokens.revokeAllForUser(user.id);
    await repos.audit.record({
      actorUserId: user.id,
      action: 'auth.password-reset-completed',
      details: 'Password reset completed; sessions revoked.',
    });
    await getEmailProvider().send({
      to: user.email,
      kind: 'password-changed',
      subject: 'Your ResumeIQ password was changed',
    });
  }
}
