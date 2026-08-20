import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
vi.mock('../src/db/connection', () => ({ Db: { getConnection: vi.fn(), close: vi.fn() } }));
import { app } from '../src/server';
import { getRepositories, resetDataStore } from '../src/repositories';
import {
  CaptureEmailProvider,
  captureEmailProvider,
  getEmailProvider,
} from '../src/services/email/email-provider';

const password = 'Password123!';
function raw(kind: 'verify-email' | 'reset-password', email: string) {
  const message = [...captureEmailProvider.messages]
    .reverse()
    .find((m) => m.kind === kind && m.to === email);
  expect(message?.actionUrl).toBeTruthy();
  return new URL(message!.actionUrl!).searchParams.get('token')!;
}
async function register(email: string) {
  return request(app)
    .post('/api/v1/auth/register')
    .send({ name: 'Recovery User', email, password });
}
async function verify(email: string) {
  return request(app)
    .post('/api/v1/auth/verify-email')
    .send({ token: raw('verify-email', email) });
}

describe('account recovery API', () => {
  beforeEach(() => {
    resetDataStore();
    captureEmailProvider.clear();
    process.env.NODE_ENV = 'test';
    process.env.EMAIL_PROVIDER = 'capture';
    process.env.PUBLIC_APP_URL = 'http://127.0.0.1:4201';
    delete process.env.ADMIN_BOOTSTRAP_EMAIL;
  });
  it('registers unverified without exposing or storing the raw token', async () => {
    const email = 'new@example.com';
    const r = await register(email);
    expect(r.status).toBe(201);
    expect(r.body).toEqual({ requiresVerification: true, email });
    const user = await getRepositories().users.findByEmail(email);
    expect(user?.emailVerifiedAt).toBeNull();
    const token = raw('verify-email', email);
    const memory = getRepositories() as unknown as { store: { snapshot(): unknown } };
    expect(JSON.stringify(memory.store.snapshot())).not.toContain(token);
  });
  it('preserves an unverified account and returns a safe error when initial delivery fails', async () => {
    process.env.EMAIL_PROVIDER = 'disabled';
    const email = 'delivery-failed@example.com';
    const response = await request(app)
      .post('/api/v1/auth/register')
      .set('x-account-recovery-test', 'true')
      .send({ name: 'Delivery Failure', email, password });
    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      error:
        'Your account was created, but we could not send the email. Please try resend shortly.',
      code: 'EMAIL_DELIVERY_UNAVAILABLE',
    });
    const user = await getRepositories().users.findByEmail(email);
    expect(user?.emailVerifiedAt).toBeNull();
    expect(JSON.stringify(response.body)).not.toContain(email);
  });
  it('verifies once, rejects reuse, and then permits login', async () => {
    const email = 'verify@example.com';
    await register(email);
    const token = raw('verify-email', email);
    expect(
      (await request(app).post('/api/v1/auth/login').send({ email, password })).body.code
    ).toBe('EMAIL_VERIFICATION_REQUIRED');
    expect((await request(app).post('/api/v1/auth/verify-email').send({ token })).status).toBe(200);
    expect((await request(app).post('/api/v1/auth/verify-email').send({ token })).status).toBe(401);
    expect((await request(app).post('/api/v1/auth/login').send({ email, password })).status).toBe(
      200
    );
  });
  it('replacement verification invalidates the previous token', async () => {
    const email = 'resend@example.com';
    await register(email);
    const old = raw('verify-email', email);
    await request(app).post('/api/v1/auth/resend-verification').send({ email });
    const latest = raw('verify-email', email);
    expect(latest).not.toBe(old);
    expect((await request(app).post('/api/v1/auth/verify-email').send({ token: old })).status).toBe(
      401
    );
    expect(
      (await request(app).post('/api/v1/auth/verify-email').send({ token: latest })).status
    ).toBe(200);
  });
  it('known and unknown recovery requests are indistinguishable', async () => {
    await register('known@example.com');
    for (const path of ['resend-verification', 'forgot-password']) {
      const known = await request(app)
        .post(`/api/v1/auth/${path}`)
        .send({ email: 'known@example.com' });
      const unknown = await request(app)
        .post(`/api/v1/auth/${path}`)
        .send({ email: 'missing@example.com' });
      expect(known.status).toBe(202);
      expect(unknown.status).toBe(202);
      expect(known.body).toEqual(unknown.body);
    }
  });
  it('resets password, revokes sessions, rejects reuse and sends notification', async () => {
    const email = 'reset@example.com';
    await register(email);
    await verify(email);
    const login = await request(app).post('/api/v1/auth/login').send({ email, password });
    const cookie = login.headers['set-cookie'];
    await request(app).post('/api/v1/auth/forgot-password').send({ email });
    const token = raw('reset-password', email);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/reset-password')
          .send({ token, newPassword: 'NewPassword123!' })
      ).status
    ).toBe(200);
    expect(
      (
        await request(app)
          .post('/api/v1/auth/reset-password')
          .send({ token, newPassword: 'Another123!' })
      ).status
    ).toBe(401);
    expect((await request(app).post('/api/v1/auth/login').send({ email, password })).status).toBe(
      401
    );
    expect(
      (await request(app).post('/api/v1/auth/login').send({ email, password: 'NewPassword123!' }))
        .status
    ).toBe(200);
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie)).status).toBe(
      401
    );
    expect(
      (
        await request(app)
          .get('/api/v1/resumes')
          .set('Authorization', `Bearer ${login.body.accessToken}`)
      ).status
    ).toBe(401);
    expect(
      captureEmailProvider.messages.some((m) => m.kind === 'password-changed' && !m.actionUrl)
    ).toBe(true);
  });
  it('purpose binds tokens and concurrent consumption succeeds once', async () => {
    const email = 'purpose@example.com';
    await register(email);
    const verification = raw('verify-email', email);
    const wrong = await request(app)
      .post('/api/v1/auth/reset-password')
      .send({ token: verification, newPassword: 'NewPassword123!' });
    expect(wrong.status).toBe(401);
    const results = await Promise.all(
      [1, 2].map(() => request(app).post('/api/v1/auth/verify-email').send({ token: verification }))
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
  });
  it('never enables capture in production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => getEmailProvider()).toThrow(/cannot be used in production/);
  });
  it('returns 404 when the mailbox is disabled or production', async () => {
    process.env.EMAIL_PROVIDER = 'disabled';
    expect((await request(app).get('/api/v1/dev/mailbox')).status).toBe(404);
    process.env.EMAIL_PROVIDER = 'capture';
    process.env.NODE_ENV = 'production';
    expect((await request(app).get('/api/v1/dev/mailbox')).status).toBe(404);
  });
  it('sanitizes mailbox lists while retaining a separate action', async () => {
    const email = 'mailbox@example.com';
    await register(email);
    const token = raw('verify-email', email);
    const response = await request(app).get('/api/v1/dev/mailbox');
    expect(response.status).toBe(200);
    expect(response.body.messages).toHaveLength(1);
    expect(JSON.stringify(response.body)).not.toContain(token);
    expect(JSON.stringify(response.body)).not.toContain('actionUrl');
    expect(response.body.messages[0]).toMatchObject({
      recipient: email,
      kind: 'verify-email',
      hasAction: true,
    });
    const action = await request(app).post(
      `/api/v1/dev/mailbox/${response.body.messages[0].id}/action`
    );
    expect(action.status).toBe(200);
    expect(action.body.actionPath).toMatch(/^\/verify-email\?token=/);
  });
  it('isolates captured messages per provider instance', async () => {
    const first = new CaptureEmailProvider();
    const second = new CaptureEmailProvider();
    await first.send({ to: 'first@example.com', kind: 'verify-email', subject: 'Verify' });
    expect(first.list()).toHaveLength(1);
    expect(second.list()).toHaveLength(0);
  });
});
