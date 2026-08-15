import { createHash, randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../../config/config';
import { UserRole } from '../../types/domain';

export interface AccessTokenPayload {
  /** User id */
  sub: string;
  email: string;
  role: UserRole;
  type: 'access';
  iat: number;
  exp: number;
}

export interface SignedAccessToken {
  token: string;
  expiresAt: string;
}

export interface GeneratedRefreshToken {
  /** Opaque id used only as a non-secret reference (returned to the client). */
  id: string;
  /** The secret value placed in the HttpOnly cookie. */
  raw: string;
  /** SHA-256 of `raw`, the only form stored by the repository. */
  hash: string;
}

export function signAccessToken(user: {
  id: string;
  email: string;
  role: UserRole;
}): SignedAccessToken {
  const ttl = config.auth.accessTokenTtlSeconds;
  const now = Date.now();
  const expiresAt = new Date(now + ttl * 1000);
  const token = jwt.sign(
    { sub: user.id, email: user.email, role: user.role, type: 'access' },
    config.auth.jwtSecret,
    { expiresIn: ttl }
  );
  return { token, expiresAt: expiresAt.toISOString() };
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const decoded = jwt.verify(token, config.auth.jwtSecret);
  if (typeof decoded === 'string' || decoded.type !== 'access') {
    throw new Error('Invalid access token.');
  }
  return decoded as AccessTokenPayload;
}

export function generateRefreshToken(): GeneratedRefreshToken {
  const raw = randomBytes(32).toString('base64url');
  return {
    id: randomUUID(),
    raw,
    hash: hashRefreshToken(raw),
  };
}

export function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
