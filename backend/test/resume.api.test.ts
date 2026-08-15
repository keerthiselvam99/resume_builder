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
import { emptyResumeContent } from '../src/types/domain';
import { sampleContent } from '../../frontend/scripts/shared/sample-content';

describe('resume and version API', () => {
  let ownerToken = '';
  let ownerId = '';
  let otherToken = '';

  beforeEach(async () => {
    resetDataStore();

    const owner = await request(app).post('/api/v1/auth/register').send({
      name: 'Owner',
      email: 'owner@example.com',
      password: 'Password123',
    });
    ownerToken = owner.body.accessToken;
    ownerId = owner.body.user.id;

    const other = await request(app).post('/api/v1/auth/register').send({
      name: 'Other',
      email: 'other@example.com',
      password: 'Password123',
    });
    otherToken = other.body.accessToken;
  });

  afterEach(() => {
    resetDataStore();
  });

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async function createResume(token: string, name = 'Master Resume') {
    const res = await request(app)
      .post('/api/v1/resumes')
      .set(auth(token))
      .send({ name, templateId: 't-classic-ats-navy' });
    expect(res.status).toBe(201);
    return res.body as {
      id: string;
      userId: string;
      name: string;
      primary: boolean;
      status: string;
    };
  }

  async function listVersions(token: string, resumeId: string) {
    const res = await request(app).get(`/api/v1/resumes/${resumeId}/versions`).set(auth(token));
    expect(res.status).toBe(200);
    return res.body as { id: string; isMaster: boolean }[];
  }

  it('creates a resume with a master version and marks it primary', async () => {
    const resume = await createResume(ownerToken);
    expect(resume.primary).toBe(true);
    expect(resume.status).toBe('draft');
    expect(resume.userId).toBe(ownerId);

    const versions = await listVersions(ownerToken, resume.id);
    expect(versions).toHaveLength(1);
    expect(versions[0].isMaster).toBe(true);
  });

  it('marks a resume as saved via POST /resumes/:id/save', async () => {
    const resume = await createResume(ownerToken);
    expect(resume.status).toBe('draft');

    const saved = await request(app)
      .post(`/api/v1/resumes/${resume.id}/save`)
      .set(auth(ownerToken));
    expect(saved.status).toBe(200);
    expect(saved.body.status).toBe('saved');

    const listed = await request(app).get('/api/v1/resumes').set(auth(ownerToken));
    expect(listed.body[0].status).toBe('saved');

    const again = await request(app)
      .post(`/api/v1/resumes/${resume.id}/save`)
      .set(auth(ownerToken));
    expect(again.status).toBe(200);
    expect(again.body.status).toBe('saved');
  });

  it('duplicates a resume as a draft', async () => {
    const resume = await createResume(ownerToken, 'Original');
    const marked = await request(app)
      .post(`/api/v1/resumes/${resume.id}/save`)
      .set(auth(ownerToken));
    expect(marked.status).toBe(200);
    expect(marked.body.status).toBe('saved');

    const dup = await request(app)
      .post(`/api/v1/resumes/${resume.id}/duplicate`)
      .set(auth(ownerToken));
    expect(dup.status).toBe(201);
    expect(dup.body.name).toBe('Original (copy)');
    expect(dup.body.status).toBe('draft');
  });

  it('only the first resume is primary', async () => {
    await createResume(ownerToken, 'One');
    await createResume(ownerToken, 'Two');
    const list = await request(app).get('/api/v1/resumes').set(auth(ownerToken));
    expect(list.body.filter((r: { primary: boolean }) => r.primary)).toHaveLength(1);
  });

  it('lists and retrieves only the callerG��s resumes', async () => {
    const mine = await createResume(ownerToken, 'Mine');
    await createResume(otherToken, 'Theirs');

    const mineList = await request(app).get('/api/v1/resumes').set(auth(ownerToken));
    expect(mineList.body).toHaveLength(1);
    expect(mineList.body[0].id).toBe(mine.id);

    const theirs = await request(app).get(`/api/v1/resumes/${mine.id}`).set(auth(otherToken));
    expect(theirs.status).toBe(404);
  });

  it('renames a resume', async () => {
    const resume = await createResume(ownerToken, 'Before');
    const renamed = await request(app)
      .patch(`/api/v1/resumes/${resume.id}`)
      .set(auth(ownerToken))
      .send({ name: 'After' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.name).toBe('After');
  });

  it('duplicates a resume and clones its master version', async () => {
    const resume = await createResume(ownerToken, 'Original');
    const dup = await request(app)
      .post(`/api/v1/resumes/${resume.id}/duplicate`)
      .set(auth(ownerToken));
    expect(dup.status).toBe(201);
    expect(dup.body.name).toBe('Original (copy)');
    expect(dup.body.id).not.toBe(resume.id);

    const versions = await listVersions(ownerToken, dup.body.id);
    expect(versions).toHaveLength(1);
    expect(versions[0].isMaster).toBe(true);
  });

  it('deletes a resume and its versions', async () => {
    const resume = await createResume(ownerToken);
    const del = await request(app).delete(`/api/v1/resumes/${resume.id}`).set(auth(ownerToken));
    expect(del.status).toBe(204);
    const gone = await request(app).get(`/api/v1/resumes/${resume.id}`).set(auth(ownerToken));
    expect(gone.status).toBe(404);
    const versions = await request(app)
      .get(`/api/v1/resumes/${resume.id}/versions`)
      .set(auth(ownerToken));
    expect(versions.status).toBe(404);
  });

  it('rejects cross-user resume operations with 404', async () => {
    const resume = await createResume(ownerToken);
    for (const method of ['delete', 'primary', 'duplicate', 'save'] as const) {
      const res = await request(app)
        .post(`/api/v1/resumes/${resume.id}/${method}`)
        .set(auth(otherToken));
      expect(res.status).toBe(404);
    }
    const rename = await request(app)
      .patch(`/api/v1/resumes/${resume.id}`)
      .set(auth(otherToken))
      .send({ name: 'hacked' });
    expect(rename.status).toBe(404);
  });

  it('rejects unauthenticated resume access', async () => {
    expect((await request(app).get('/api/v1/resumes')).status).toBe(401);
  });

  it('autosaves content and reloads it (persistence round-trip)', async () => {
    const resume = await createResume(ownerToken);
    const versions = await listVersions(ownerToken, resume.id);
    const versionId = versions[0].id;

    const content = structuredClone(emptyResumeContent);
    content.contacts.fullName = 'Arun Kumar';
    content.summary = 'Saved via autosave.';
    content.skills = ['Angular', 'Oracle'];
    content.experiences = [
      {
        id: 'e-1',
        company: 'Acme',
        role: 'Developer',
        location: 'Bengaluru',
        startDate: '2021-01',
        endDate: '',
        current: true,
        bullets: ['Built APIs.'],
      },
    ];

    const saved = await request(app)
      .patch(`/api/v1/versions/${versionId}/content`)
      .set(auth(ownerToken))
      .send({ content });
    expect(saved.status).toBe(200);
    expect(saved.body.content.summary).toBe('Saved via autosave.');

    const reloaded = await request(app).get(`/api/v1/versions/${versionId}`).set(auth(ownerToken));
    expect(reloaded.status).toBe(200);
    expect(reloaded.body.content.contacts.fullName).toBe('Arun Kumar');
    expect(reloaded.body.content.skills).toEqual(['Angular', 'Oracle']);
  });

  it('publishes a version and then rejects edits with 409', async () => {
    const resume = await createResume(ownerToken);
    const versions = await listVersions(ownerToken, resume.id);
    const versionId = versions[0].id;

    const publish = await request(app)
      .post(`/api/v1/versions/${versionId}/publish`)
      .set(auth(ownerToken));
    expect(publish.status).toBe(200);
    expect(publish.body.published).toBe(true);

    const edit = await request(app)
      .patch(`/api/v1/versions/${versionId}/content`)
      .set(auth(ownerToken))
      .send({ content: sampleContent });
    expect(edit.status).toBe(409);
    expect(edit.body.error).toContain('published');

    const templateEdit = await request(app)
      .patch(`/api/v1/versions/${versionId}/template`)
      .set(auth(ownerToken))
      .send({ templateId: 't-premium-sidebar-navy' });
    expect(templateEdit.status).toBe(409);
  });

  it('creates a tailored version from a source version', async () => {
    const resume = await createResume(ownerToken);
    const versions = await listVersions(ownerToken, resume.id);
    const sourceId = versions[0].id;

    const created = await request(app)
      .post(`/api/v1/resumes/${resume.id}/versions`)
      .set(auth(ownerToken))
      .send({ name: 'TCS G�� Angular Developer', sourceVersionId: sourceId });
    expect(created.status).toBe(201);
    expect(created.body.isTailored).toBe(true);

    const all = await listVersions(ownerToken, resume.id);
    expect(all).toHaveLength(2);
  });

  it('compares two versions', async () => {
    const resume = await createResume(ownerToken);
    const versions = await listVersions(ownerToken, resume.id);
    const a = versions[0].id;
    const created = await request(app)
      .post(`/api/v1/resumes/${resume.id}/versions`)
      .set(auth(ownerToken))
      .send({ name: 'Version B' });
    const b = created.body.id;

    const res = await request(app)
      .get(`/api/v1/versions/compare?versionA=${a}&versionB=${b}`)
      .set(auth(ownerToken));
    expect(res.status).toBe(200);
    expect(res.body.versionA.id).toBe(a);
    expect(res.body.versionB.id).toBe(b);
  });

  it('rejects an invalid template id on resume creation', async () => {
    const res = await request(app)
      .post('/api/v1/resumes')
      .set(auth(ownerToken))
      .send({ name: 'Bad', templateId: 't-not-real' });
    expect(res.status).toBe(400);
  });

  it('enforces the admin role gate', async () => {
    const forbidden = await request(app).get('/api/v1/admin/placeholder').set(auth(ownerToken));
    expect(forbidden.status).toBe(403);
  });
});
