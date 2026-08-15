import { it, describe, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../src/services/security/password';
import {
  generateRefreshToken,
  hashRefreshToken,
  signAccessToken,
  verifyAccessToken,
} from '../src/services/security/tokens';
import { validateEmail, validateName, validatePassword } from '../src/services/security/validate';

describe('password hashing', () => {
  it('round-trips a password and rejects the wrong one', async () => {
    const stored = await hashPassword('Password123');
    expect(stored).toMatch(/^scrypt\$/);
    await expect(verifyPassword('Password123', stored)).resolves.toBe(true);
    await expect(verifyPassword('WrongPass123', stored)).resolves.toBe(false);
  });

  it('uses a unique salt per hash', async () => {
    const a = await hashPassword('SamePassword1');
    const b = await hashPassword('SamePassword1');
    expect(a).not.toBe(b);
  });

  it('rejects malformed stored hashes', async () => {
    await expect(verifyPassword('x', 'not-a-hash')).resolves.toBe(false);
    await expect(verifyPassword('x', 'scrypt$bad')).resolves.toBe(false);
  });
});

describe('access tokens', () => {
  it('signs and verifies a token carrying sub/email/role', () => {
    const { token, expiresAt } = signAccessToken({
      id: 'u-1',
      email: 'arun@example.com',
      role: 'admin',
    });
    expect(token).toBeTruthy();
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());

    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('u-1');
    expect(payload.role).toBe('admin');
    expect(payload.type).toBe('access');
  });

  it('rejects a tampered token', () => {
    const { token } = signAccessToken({ id: 'u-1', email: 'a@b.com', role: 'user' });
    const tampered = `${token.slice(0, -4)}xxxx`;
    expect(() => verifyAccessToken(tampered)).toThrow();
  });
});

describe('refresh tokens', () => {
  it('generates a unique raw token and a stable hash', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a.raw).not.toBe(b.raw);
    expect(a.id).toBeTruthy();
    expect(hashRefreshToken(a.raw)).toBe(a.hash);
    expect(hashRefreshToken(a.raw)).toHaveLength(64);
  });
});

describe('input validators', () => {
  it('accepts a valid email and rejects invalid ones', () => {
    expect(validateEmail('arun@example.com')).toBeNull();
    expect(validateEmail('not-an-email')).not.toBeNull();
    expect(validateEmail('')).not.toBeNull();
  });

  it('enforces the shared password rule (>=8, letter, number)', () => {
    expect(validatePassword('Password123')).toBeNull();
    expect(validatePassword('short')).not.toBeNull();
    expect(validatePassword('onlyletters')).not.toBeNull();
    expect(validatePassword('12345678')).not.toBeNull();
  });

  it('requires a name', () => {
    expect(validateName('Arun Kumar')).toBeNull();
    expect(validateName('  ')).not.toBeNull();
  });
});
