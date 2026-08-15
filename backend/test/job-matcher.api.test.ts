import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { sampleContent } from '../../frontend/scripts/shared/sample-content';
vi.mock('../src/db/connection', () => ({ Db: { getConnection: vi.fn(), close: vi.fn() } }));
import { app } from '../src/server';
import { resetDataStore } from '../src/repositories';
import { analyzeJobMatch } from '../../shared/job-matcher';

const body = {
  jobTitle: 'Senior Angular Developer',
  company: 'Northstar Careers',
  jobDescription:
    'Angular, TypeScript, JavaScript, REST APIs, Node.js, AWS, testing and CI/CD are required. Docker is preferred. The successful candidate must build accessible, reliable applications, collaborate with product teams, document technical decisions, review code, improve performance, and deliver measurable customer outcomes.',
};
describe('Job Matcher API', () => {
  let ownerToken = '';
  let otherToken = '';
  let versionId = '';
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  beforeEach(async () => {
    resetDataStore();
    const owner = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Owner', email: 'jm-owner@example.com', password: 'Password123' });
    const other = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Other', email: 'jm-other@example.com', password: 'Password123' });
    ownerToken = owner.body.accessToken;
    otherToken = other.body.accessToken;
    const resume = await request(app)
      .post('/api/v1/resumes')
      .set(auth(ownerToken))
      .send({ name: 'Strong', templateId: 't-classic-ats-navy' });
    const versions = await request(app)
      .get(`/api/v1/resumes/${resume.body.id}/versions`)
      .set(auth(ownerToken));
    versionId = versions.body[0].id;
    await request(app)
      .patch(`/api/v1/versions/${versionId}/content`)
      .set(auth(ownerToken))
      .send({ content: sampleContent });
  });
  const run = (token = ownerToken, id = versionId, payload: object | string = body) =>
    request(app).post(`/api/v1/versions/${id}/job-match`).set(auth(token)).send(payload);
  it('requires authentication', async () =>
    expect(
      (await request(app).post(`/api/v1/versions/${versionId}/job-match`).send(body)).status
    ).toBe(401));
  it('allows the owner, is deterministic, and equals the shared Demo engine', async () => {
    const a = await run();
    const b = await run();
    expect(a.status).toBe(200);
    expect(a.body).toEqual(b.body);
    expect(a.body).toEqual(
      analyzeJobMatch({
        content: sampleContent,
        versionId,
        templateId: 't-classic-ats-navy',
        ...body,
      })
    );
    expect(a.body.matchedKeywords.every((x: { evidence: unknown[] }) => x.evidence.length)).toBe(
      true
    );
  });
  it('hides another user version as 404', async () =>
    expect((await run(otherToken)).status).toBe(404));
  it('rejects malformed ids and invalid or oversized bodies', async () => {
    expect((await run(ownerToken, 'bad%20id')).status).toBe(400);
    expect((await run(ownerToken, versionId, { ...body, jobTitle: 'x' })).status).toBe(400);
    expect((await run(ownerToken, versionId, { ...body, jobDescription: 'short' })).status).toBe(
      400
    );
    expect(
      (await run(ownerToken, versionId, { ...body, jobDescription: 'x'.repeat(15001) })).status
    ).toBe(400);
  });
  it('does not echo the job description in validation errors', async () => {
    const secret = 'PRIVATE-JOB-DESCRIPTION-CONTENT';
    const res = await run(ownerToken, versionId, { ...body, jobDescription: secret });
    expect(JSON.stringify(res.body)).not.toContain(secret);
  });
});
