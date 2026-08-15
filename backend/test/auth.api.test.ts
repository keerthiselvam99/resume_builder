import { it, describe, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../src/db/connection', () => ({
  Db: {
    getConnection: vi.fn(),
    close: vi.fn(),
  },
}));

import { app } from '../src/server';
import { resetDataStore } from '../src/repositories';

describe('authentication API', () => {
  beforeEach(() => {
    resetDataStore();
  });

  afterEach(() => {
    resetDataStore();
  });

  function parseCookie(headers: Record<string, unknown>, name: string): string | undefined {
    const raw = Array.isArray(headers['set-cookie'])
      ? (headers['set-cookie'] as string[]).find((c) => c.startsWith(`${name}=`))
      : undefined;
    return raw?.split(';')[0].slice(`${name}=`.length);
  }

  it('registers a user, sets an httpOnly refresh cookie, and returns a session', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Arun Kumar',
      email: 'arun@example.com',
      password: 'Password123',
    });

    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.expiresAt).toBeTruthy();
    expect(res.body.user).toMatchObject({ email: 'arun@example.com', role: 'user' });

    const cookie = res.headers['set-cookie'] as unknown as string[];
    expect(cookie.some((c) => c.startsWith('refresh_token='))).toBe(true);
    expect(cookie.some((c) => /refresh_token=.*HttpOnly/i.test(c))).toBe(true);
  });

  it('rejects registration with a weak password', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Arun',
      email: 'arun@example.com',
      password: 'short',
    });
    expect(res.status).toBe(400);
    expect(res.body.details).toBeDefined();
  });

  it('rejects duplicate registration with a 409', async () => {
    const payload = { name: 'Arun', email: 'dup@example.com', password: 'Password123' };
    await request(app).post('/api/v1/auth/register').send(payload);
    const res = await request(app).post('/api/v1/auth/register').send(payload);
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('already exists');
  });

  it('logs in with valid credentials and returns a cookie', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Arun',
      email: 'arun@example.com',
      password: 'Password123',
    });
    const res = await request(app).post('/api/v1/auth/login').send({
      email: 'arun@example.com',
      password: 'Password123',
    });
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeTruthy();
    expect(parseCookie(res.headers, 'refresh_token')).toBeTruthy();
  });

  it('returns a generic error for bad credentials and unknown emails (no enumeration)', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Arun',
      email: 'arun@example.com',
      password: 'Password123',
    });
    const wrongPassword = await request(app).post('/api/v1/auth/login').send({
      email: 'arun@example.com',
      password: 'WrongPass123',
    });
    const unknownEmail = await request(app).post('/api/v1/auth/login').send({
      email: 'nobody@example.com',
      password: 'Whatever123',
    });
    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error).toBe(unknownEmail.body.error);
  });

  it('returns the current user from /auth/me with a valid token', async () => {
    const register = await request(app).post('/api/v1/auth/register').send({
      name: 'Arun',
      email: 'arun@example.com',
      password: 'Password123',
    });
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${register.body.accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: 'arun@example.com', role: 'user' });
  });

  it('rejects /auth/me without a token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('rotates the refresh token on refresh and rejects reuse of the old token', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Rotate',
      email: 'rotate@example.com',
      password: 'Password123',
    });
    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'rotate@example.com',
      password: 'Password123',
    });
    const firstCookie = parseCookie(login.headers, 'refresh_token');
    expect(firstCookie).toBeTruthy();

    const refreshed = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${firstCookie}`);
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.accessToken).toBeTruthy();
    const secondCookie = parseCookie(refreshed.headers, 'refresh_token');
    expect(secondCookie).toBeTruthy();
    expect(secondCookie).not.toBe(firstCookie);

    const replay = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${firstCookie}`);
    expect(replay.status).toBe(401);
  });

  it('accepts the rotated refresh token', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Rotate Two',
      email: 'rotate2@example.com',
      password: 'Password123',
    });
    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'rotate2@example.com',
      password: 'Password123',
    });
    const firstCookie = parseCookie(login.headers, 'refresh_token') as string;
    const refreshed = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${firstCookie}`);
    const secondCookie = parseCookie(refreshed.headers, 'refresh_token') as string;

    const again = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${secondCookie}`);
    expect(again.status).toBe(200);
  });

  it('rejects refresh without a cookie', async () => {
    const res = await request(app).post('/api/v1/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('logout clears the cookie and revokes the token', async () => {
    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'logout@example.com',
      password: 'Password123',
    });
    const cookie = parseCookie(login.headers, 'refresh_token') as string;

    const loggedOut = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', `refresh_token=${cookie}`);
    expect(loggedOut.status).toBe(204);
    expect(String(loggedOut.headers['set-cookie'] ?? '')).toMatch(/refresh_token=;/);

    const afterLogout = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `refresh_token=${cookie}`);
    expect(afterLogout.status).toBe(401);
  });
});
