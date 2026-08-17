import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { Response as SuperTestResponse } from 'supertest';
import type { AuditEvent } from '../src/types/domain';
vi.mock('../src/db/connection', () => ({ Db: { getConnection: vi.fn(), close: vi.fn() } }));
import { app } from '../src/server';
import { getRepositories, resetDataStore } from '../src/repositories';

describe('Admin MVP API', () => {
  let admin: SuperTestResponse, user: SuperTestResponse, other: SuperTestResponse;
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  beforeEach(async () => {
    resetDataStore();
    process.env.ADMIN_BOOTSTRAP_EMAIL = 'admin@example.com';
    admin = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Admin One', email: 'admin@example.com', password: 'Password123' });
    user = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Casey User', email: 'CASEY@example.com', password: 'Password123' });
    other = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Riley User', email: 'riley@example.com', password: 'Password123' });
    delete process.env.ADMIN_BOOTSTRAP_EMAIL;
  });
  it('returns 401 without a session and 403 for USER on every endpoint', async () => {
    for (const path of ['/admin/summary', '/admin/users', '/admin/audit-events']) {
      expect((await request(app).get(`/api/v1${path}`)).status).toBe(401);
      expect(
        (await request(app).get(`/api/v1${path}`).set(auth(user.body.accessToken))).status
      ).toBe(403);
    }
    expect(
      (
        await request(app)
          .patch(`/api/v1/admin/users/${other.body.user.id}/role`)
          .set(auth(user.body.accessToken))
          .send({ role: 'admin' })
      ).status
    ).toBe(403);
  });
  it('returns safe summary counts', async () => {
    const r = await request(app).get('/api/v1/admin/summary').set(auth(admin.body.accessToken));
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      totalUsers: 3,
      activeUsers: 3,
      disabledUsers: 0,
      userCount: 2,
      adminCount: 1,
      totalResumes: 0,
    });
  });
  it('lists normalized search deterministically without secrets', async () => {
    const r = await request(app)
      .get('/api/v1/admin/users?q=casey&sort=email&direction=asc')
      .set(auth(admin.body.accessToken));
    expect(r.body.items).toHaveLength(1);
    expect(r.body.items[0].email).toBe('casey@example.com');
    expect(JSON.stringify(r.body)).not.toMatch(/passwordHash|tokenHash|accessToken|refreshToken/);
  });
  it('validates pagination and filters', async () => {
    expect(
      (await request(app).get('/api/v1/admin/users?page=0').set(auth(admin.body.accessToken)))
        .status
    ).toBe(400);
    expect(
      (await request(app).get('/api/v1/admin/users?pageSize=101').set(auth(admin.body.accessToken)))
        .status
    ).toBe(400);
    expect(
      (await request(app).get('/api/v1/admin/users?role=owner').set(auth(admin.body.accessToken)))
        .status
    ).toBe(400);
  });
  it('filters role/status and returns page metadata', async () => {
    const r = await request(app)
      .get('/api/v1/admin/users?role=user&status=active&pageSize=1')
      .set(auth(admin.body.accessToken));
    expect(r.body.items).toHaveLength(1);
    expect(r.body.total).toBe(2);
    expect(r.body.totalPages).toBe(2);
  });
  it('promotes and demotes another administrator and immediately revokes authority', async () => {
    let r = await request(app)
      .patch(`/api/v1/admin/users/${user.body.user.id}/role`)
      .set(auth(admin.body.accessToken))
      .send({ role: 'admin' });
    expect(r.body.role).toBe('admin');
    const promotedLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'casey@example.com', password: 'Password123' });
    expect(
      (await request(app).get('/api/v1/admin/summary').set(auth(promotedLogin.body.accessToken)))
        .status
    ).toBe(200);
    r = await request(app)
      .patch(`/api/v1/admin/users/${user.body.user.id}/role`)
      .set(auth(admin.body.accessToken))
      .send({ role: 'user' });
    expect(r.body.role).toBe('user');
    expect(
      (await request(app).get('/api/v1/admin/summary').set(auth(promotedLogin.body.accessToken)))
        .status
    ).toBe(403);
  });
  it('disables and enables a USER, invalidating access, refresh and login', async () => {
    const cookie = user.headers['set-cookie'];
    expect(
      (
        await request(app)
          .patch(`/api/v1/admin/users/${user.body.user.id}/status`)
          .set(auth(admin.body.accessToken))
          .send({ status: 'disabled' })
      ).status
    ).toBe(200);
    expect(
      (await request(app).get('/api/v1/resumes').set(auth(user.body.accessToken))).status
    ).toBe(401);
    expect((await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie)).status).toBe(
      401
    );
    expect(
      (
        await request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'casey@example.com', password: 'Password123' })
      ).status
    ).toBe(401);
    await request(app)
      .patch(`/api/v1/admin/users/${user.body.user.id}/status`)
      .set(auth(admin.body.accessToken))
      .send({ status: 'active' });
    expect(
      (
        await request(app)
          .post('/api/v1/auth/login')
          .send({ email: 'casey@example.com', password: 'Password123' })
      ).status
    ).toBe(200);
  });
  it('blocks self demotion and self disable', async () => {
    expect(
      (
        await request(app)
          .patch(`/api/v1/admin/users/${admin.body.user.id}/role`)
          .set(auth(admin.body.accessToken))
          .send({ role: 'user' })
      ).status
    ).toBe(403);
    expect(
      (
        await request(app)
          .patch(`/api/v1/admin/users/${admin.body.user.id}/status`)
          .set(auth(admin.body.accessToken))
          .send({ status: 'disabled' })
      ).status
    ).toBe(403);
  });
  it('blocks demotion and disable of the last active admin', async () => {
    await expect(
      getRepositories().users.updateRoleAtomic('different-admin', admin.body.user.id, 'user')
    ).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      getRepositories().users.updateStatusAtomic('different-admin', admin.body.user.id, 'disabled')
    ).rejects.toMatchObject({ statusCode: 403 });
  });
  it('serializes concurrent last-admin protection', async () => {
    const repos = getRepositories();
    await repos.users.updateRoleAtomic(admin.body.user.id, user.body.user.id, 'admin');
    const results = await Promise.allSettled([
      repos.users.updateRoleAtomic('actor', admin.body.user.id, 'user'),
      repos.users.updateRoleAtomic('actor', user.body.user.id, 'user'),
    ]);
    expect(results.filter((x) => x.status === 'rejected')).toHaveLength(1);
    expect(await repos.users.countActiveAdmins()).toBe(1);
  });
  it('records safe, filterable audit events and prohibited attempts', async () => {
    await request(app)
      .patch(`/api/v1/admin/users/${user.body.user.id}/role`)
      .set(auth(admin.body.accessToken))
      .send({ role: 'admin' });
    await request(app)
      .patch(`/api/v1/admin/users/${admin.body.user.id}/status`)
      .set(auth(admin.body.accessToken))
      .send({ status: 'disabled' });
    const r = await request(app)
      .get(`/api/v1/admin/audit-events?targetUser=${user.body.user.id}`)
      .set(auth(admin.body.accessToken));
    expect(r.body.items.some((event: AuditEvent) => event.action === 'admin.role-granted')).toBe(
      true
    );
    expect(JSON.stringify(r.body)).not.toMatch(
      /Password123|accessToken|refreshToken|tokenHash|passwordHash/
    );
    const all = await request(app)
      .get('/api/v1/admin/audit-events?action=admin.prohibited-attempt')
      .set(auth(admin.body.accessToken));
    expect(all.body.total).toBeGreaterThan(0);
  });
  it('returns 404 for missing users and 400 for invalid mutations', async () => {
    expect(
      (
        await request(app)
          .patch('/api/v1/admin/users/missing/role')
          .set(auth(admin.body.accessToken))
          .send({ role: 'admin' })
      ).status
    ).toBe(404);
    expect(
      (
        await request(app)
          .patch(`/api/v1/admin/users/${user.body.user.id}/role`)
          .set(auth(admin.body.accessToken))
          .send({ role: 'owner' })
      ).status
    ).toBe(400);
  });
});
