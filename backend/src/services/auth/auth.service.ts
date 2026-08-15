import { randomUUID } from 'node:crypto';
import { config } from '../../config/config';
import { UnauthorizedError, ValidationError } from '../../http/errors';
import { getRepositories } from '../../repositories';
import { User } from '../../types/domain';
import { hashPassword, verifyPassword } from '../security/password';
import { generateRefreshToken, hashRefreshToken, signAccessToken } from '../security/tokens';
import { validateEmail, validateName, validatePassword } from '../security/validate';

/** Public session payload returned to the client. */
export interface SessionResult {
  accessToken: string;
  /** Non-secret reference (token id); the secret itself only lives in a cookie. */
  refreshToken: string;
  expiresAt: string;
  user: User;
}

/** Internal session that also carries the cookie secret. */
export interface SessionWithSecret extends SessionResult {
  rawRefreshToken: string;
}

export interface LoginContext {
  ip?: string;
}

export class AuthService {
  async register(input: {
    name: string;
    email: string;
    password: string;
  }): Promise<SessionWithSecret> {
    const issues = [
      validateName(input.name),
      validateEmail(input.email),
      validatePassword(input.password),
    ].filter((issue): issue is NonNullable<typeof issue> => issue !== null);
    if (issues.length > 0) {
      throw new ValidationError(issues.map((i) => i.message));
    }

    const { users, audit } = getRepositories();
    const passwordHash = await hashPassword(input.password);
    const created = await users.create({
      id: randomUUID(),
      name: input.name,
      email: input.email,
      passwordHash,
      role: 'user',
    });
    await audit.record({
      actorUserId: created.id,
      action: 'auth.register',
      details: `Registered ${created.email}`,
    });
    return this.createSession(created);
  }

  async login(
    input: { email: string; password: string },
    ctx: LoginContext
  ): Promise<SessionWithSecret> {
    const { users, audit } = getRepositories();
    const record = await users.findByEmail(input.email);
    const ok = record !== null && (await verifyPassword(input.password, record.passwordHash));

    if (!record || !ok) {
      await audit.record({
        actorUserId: record?.id ?? null,
        action: 'auth.login-failed',
        details: `Failed login for ${input.email.trim().toLowerCase()}`,
        ipAddress: ctx.ip ?? null,
      });
      throw new UnauthorizedError('Invalid email or password.');
    }
    await audit.record({
      actorUserId: record.id,
      action: 'auth.login',
      details: `Logged in ${record.email}`,
      ipAddress: ctx.ip ?? null,
    });
    return this.createSession(record);
  }

  async refresh(rawToken: string | undefined, ctx: LoginContext): Promise<SessionWithSecret> {
    if (!rawToken) {
      throw new UnauthorizedError('Invalid or expired session.');
    }
    const { refreshTokens, users, audit } = getRepositories();
    const record = await refreshTokens.findByHash(hashRefreshToken(rawToken));
    if (!record) {
      throw new UnauthorizedError('Invalid or expired session.');
    }

    if (record.revokedAt !== null) {
      // A previously rotated token is being replayed: revoke the whole family.
      await refreshTokens.revokeAllForUser(record.userId);
      await audit.record({
        actorUserId: record.userId,
        action: 'auth.refresh-reuse',
        details: 'Refresh token reuse detected; revoked all tokens for the user.',
        ipAddress: ctx.ip ?? null,
      });
      throw new UnauthorizedError('Invalid or expired session.');
    }

    if (new Date(record.expiresAt) < new Date()) {
      throw new UnauthorizedError('Invalid or expired session.');
    }

    const user = await users.findById(record.userId);
    if (!user) {
      throw new UnauthorizedError('Invalid or expired session.');
    }

    const next = generateRefreshToken();
    await refreshTokens.revoke(record.id, next.id);
    await refreshTokens.create({
      id: next.id,
      userId: user.id,
      tokenHash: next.hash,
      expiresAt: this.refreshExpiry(),
    });
    await audit.record({
      actorUserId: user.id,
      action: 'auth.refresh',
      details: 'Refresh token rotated.',
      ipAddress: ctx.ip ?? null,
    });

    return this.buildSession(user, next.id, next.raw);
  }

  async logout(rawToken: string | undefined, userId: string | null): Promise<void> {
    const { refreshTokens, audit } = getRepositories();
    if (rawToken) {
      const record = await refreshTokens.findByHash(hashRefreshToken(rawToken));
      if (record && record.revokedAt === null) {
        await refreshTokens.revoke(record.id);
      }
    } else if (userId) {
      await refreshTokens.revokeAllForUser(userId);
    }
    await audit.record({
      actorUserId: userId,
      action: 'auth.logout',
      details: 'User logged out.',
    });
  }

  async getMe(userId: string): Promise<User> {
    const { users } = getRepositories();
    const record = await users.findById(userId);
    if (!record) {
      throw new UnauthorizedError('Session user no longer exists.');
    }
    return toUser(record);
  }

  private async createSession(
    user: Pick<User, 'id' | 'name' | 'email' | 'role' | 'createdAt'>
  ): Promise<SessionWithSecret> {
    const { refreshTokens } = getRepositories();
    const token = generateRefreshToken();
    await refreshTokens.create({
      id: token.id,
      userId: user.id,
      tokenHash: token.hash,
      expiresAt: this.refreshExpiry(),
    });
    return this.buildSession(user, token.id, token.raw);
  }

  private buildSession(
    user: Pick<User, 'id' | 'name' | 'email' | 'role' | 'createdAt'>,
    refreshTokenId: string,
    rawRefreshToken: string
  ): SessionWithSecret {
    const signed = signAccessToken(user);
    return {
      accessToken: signed.token,
      refreshToken: refreshTokenId,
      expiresAt: signed.expiresAt,
      user: toUser(user),
      rawRefreshToken,
    };
  }

  private refreshExpiry(): string {
    return new Date(
      Date.now() + config.auth.refreshTokenTtlDays * 24 * 60 * 60 * 1000
    ).toISOString();
  }
}

function toUser(record: Pick<User, 'id' | 'name' | 'email' | 'role' | 'createdAt'>): User {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    role: record.role,
    createdAt: record.createdAt,
  };
}
