import { describe, expect, it, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/server';
import { Db } from '../src/db/connection';
import { emptyResumeContent } from '../src/types/domain';

/**
 * Real-Oracle HTTP persistence E2E. Opt-in via the Oracle vitest profile:
 *
 *   npx vitest run -c vitest.oracle.config.ts test/oracle-persistence.e2e.test.ts
 *
 * Requires database/.env credentials (ORACLE_USER/ORACLE_PASSWORD/
 * ORACLE_CONNECT_STRING) and the migrations applied. Unlike the mocked API
 * suites, this exercises the actual Oracle repository adapters through the
 * running Express app, including a connection-pool teardown that proves rows
 * survive a fresh pool. Process-restart survival is covered separately by
 * database/scripts/oracle-verify.ps1 step 5, which kills and relaunches the
 * backend process against the same Oracle.
 */

const oracleEnabled = process.env.ORACLE_IT === '1';
const RUN = new Date().getTime();

function auth(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function registerUser(name: string): Promise<{ accessToken: string; userId: string }> {
  const res = await request(app)
    .post('/api/v1/auth/register')
    .send({
      name,
      email: `${name.toLowerCase()}-${RUN}@example.com`,
      password: 'Password123',
    });
  expect(res.status).toBe(201);
  return res.body as { accessToken: string; userId: string };
}

async function createResume(token: string, name: string): Promise<{ id: string }> {
  const res = await request(app)
    .post('/api/v1/resumes')
    .set(auth(token))
    .send({ name, templateId: 't-classic-ats-navy' });
  expect(res.status).toBe(201);
  return res.body as { id: string };
}

async function listVersions(
  token: string,
  resumeId: string
): Promise<{ id: string; isMaster: boolean }[]> {
  const res = await request(app).get(`/api/v1/resumes/${resumeId}/versions`).set(auth(token));
  expect(res.status).toBe(200);
  return res.body as { id: string; isMaster: boolean }[];
}

describe('oracle persistence (HTTP E2E)', () => {
  if (!oracleEnabled) {
    it.skip('Oracle E2E only runs with ORACLE_IT=1 (vitest.oracle.config.ts)', () => {});
  } else {
    afterAll(async () => {
      await Db.close();
    });

    it('round-trips resume content through the real Oracle store over HTTP', async () => {
      const owner = await registerUser('OracleOwner');
      const resume = await createResume(owner.accessToken, 'Oracle Persistence');
      const versions = await listVersions(owner.accessToken, resume.id);
      expect(versions).toHaveLength(1);
      expect(versions[0].isMaster).toBe(true);
      const versionId = versions[0].id;

      const content = structuredClone(emptyResumeContent);
      content.contacts.fullName = 'Arun Kumar';
      content.summary = 'Persisted via Oracle.';
      content.skills = ['Oracle', 'PL/SQL', 'Node.js'];
      content.experiences = [
        {
          id: 'e-1',
          company: 'Acme',
          role: 'Developer',
          location: 'Bengaluru',
          startDate: '2021-01',
          endDate: '',
          current: true,
          bullets: ['Built Oracle-backed APIs.'],
        },
      ];

      const saved = await request(app)
        .patch(`/api/v1/versions/${versionId}/content`)
        .set(auth(owner.accessToken))
        .send({ content });
      expect(saved.status).toBe(200);
      expect(saved.body.content.summary).toBe('Persisted via Oracle.');

      const reloaded = await request(app)
        .get(`/api/v1/versions/${versionId}`)
        .set(auth(owner.accessToken));
      expect(reloaded.status).toBe(200);
      expect(reloaded.body.content.contacts.fullName).toBe('Arun Kumar');
      expect(reloaded.body.content.skills).toEqual(['Oracle', 'PL/SQL', 'Node.js']);
      expect(reloaded.body.content.experiences[0].bullets[0]).toBe('Built Oracle-backed APIs.');
    });

    it('data survives a database-connection restart (fresh pool)', async () => {
      const owner = await registerUser('OracleRestartOwner');
      const resume = await createResume(owner.accessToken, 'Restart Survival');
      const versions = await listVersions(owner.accessToken, resume.id);
      const versionId = versions[0].id;

      const content = structuredClone(emptyResumeContent);
      content.summary = 'Survives restarts';
      const saved = await request(app)
        .patch(`/api/v1/versions/${versionId}/content`)
        .set(auth(owner.accessToken))
        .send({ content });
      expect(saved.status).toBe(200);

      // Simulate a backend restart: drop the pool; the next request rebuilds it
      // and must still find the rows committed to Oracle.
      await Db.close();
      expect(Db.isInitialized()).toBe(false);

      const reloaded = await request(app)
        .get(`/api/v1/versions/${versionId}`)
        .set(auth(owner.accessToken));
      expect(reloaded.status).toBe(200);
      expect(reloaded.body.content.summary).toBe('Survives restarts');
      expect(reloaded.body.content.contacts.fullName).toBe('');

      const list = await request(app).get('/api/v1/resumes').set(auth(owner.accessToken));
      expect(list.status).toBe(200);
      expect(list.body).toHaveLength(1);
      expect(list.body[0].id).toBe(resume.id);
    });

    it('rejects cross-user access with 404 after a reconnect', async () => {
      const owner = await registerUser('OracleCrossOwner');
      const other = await registerUser('OracleCrossOther');
      const resume = await createResume(owner.accessToken, 'Mine');
      const versions = await listVersions(owner.accessToken, resume.id);
      const versionId = versions[0].id;

      await Db.close();

      const t = auth(other.accessToken);
      expect((await request(app).get(`/api/v1/resumes/${resume.id}`).set(t)).status).toBe(404);
      expect((await request(app).delete(`/api/v1/resumes/${resume.id}`).set(t)).status).toBe(404);
      expect((await request(app).get(`/api/v1/versions/${versionId}`).set(t)).status).toBe(404);
    });
  }
});
