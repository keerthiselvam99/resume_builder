import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { ATS_TEMPLATE_PROFILES } from '../../shared/ats-template-catalogue';
import { sampleContent } from '../../frontend/scripts/shared/sample-content';
import { ResumeContent } from '../../frontend/src/app/core/models/resume.model';

vi.mock('../src/db/connection', () => ({
  Db: {
    getConnection: vi.fn(),
    close: vi.fn(),
  },
}));

import { app } from '../src/server';
import { resetDataStore } from '../src/repositories';
import { ATS_RULESET_VERSION } from '../src/services/ats/ats-model';

describe('ATS analysis API', () => {
  let ownerToken = '';
  let otherToken = '';
  let resumeId = '';
  let versionId = '';

  beforeEach(async () => {
    resetDataStore();

    const owner = await request(app).post('/api/v1/auth/register').send({
      name: 'Owner',
      email: 'owner@example.com',
      password: 'Password123',
    });
    ownerToken = owner.body.accessToken;

    const other = await request(app).post('/api/v1/auth/register').send({
      name: 'Other',
      email: 'other@example.com',
      password: 'Password123',
    });
    otherToken = other.body.accessToken;

    const resume = await request(app)
      .post('/api/v1/resumes')
      .set(auth(ownerToken))
      .send({ name: 'ATS Resume', templateId: 't-classic-ats-navy' });
    expect(resume.status).toBe(201);
    resumeId = resume.body.id as string;

    const versions = await request(app)
      .get(`/api/v1/resumes/${resumeId}/versions`)
      .set(auth(ownerToken));
    versionId = (versions.body[0] as { id: string }).id;
  });

  afterEach(() => {
    resetDataStore();
  });

  function auth(token: string) {
    return { Authorization: `Bearer ${token}` };
  }

  async function saveContent(payload: ResumeContent) {
    const res = await request(app)
      .patch(`/api/v1/versions/${versionId}/content`)
      .set(auth(ownerToken))
      .send({ content: payload });
    expect(res.status).toBe(200);
  }

  async function runAnalysis(token: string, version: string, body: object = {}) {
    return request(app)
      .post(`/api/v1/versions/${version}/ats-analysis`)
      .set(auth(token))
      .send(body);
  }

  it('requires authentication', async () => {
    const res = await request(app).post(`/api/v1/versions/${versionId}/ats-analysis`).send({});
    expect(res.status).toBe(401);
  });

  it('returns a full versioned report from the saved content', async () => {
    await saveContent(sampleContent);
    const res = await runAnalysis(ownerToken, versionId);
    expect(res.status).toBe(200);
    expect(res.body.versionId).toBe(versionId);
    expect(res.body.rulesetVersion).toBe(ATS_RULESET_VERSION);
    expect(res.body.categories).toHaveLength(9);
    expect(Array.isArray(res.body.findings)).toBe(true);
    expect(Number.isInteger(res.body.overallScore)).toBe(true);
    expect(res.body.overallScore).toBeGreaterThanOrEqual(0);
    expect(res.body.overallScore).toBeLessThanOrEqual(100);
  });

  it('ignores any client-supplied body and scores the saved version', async () => {
    const tampered = {
      ...sampleContent,
      contacts: { ...sampleContent.contacts, email: 'not-an-email' },
    };
    await saveContent(tampered);
    const res = await runAnalysis(ownerToken, versionId, {
      overallScore: 100,
      categories: [],
      findings: [],
    });
    expect(res.status).toBe(200);
    expect(res.body.overallScore).not.toBe(100);
    expect(
      res.body.findings.some((f: { code: string }) => f.code === 'contact.email.invalid')
    ).toBe(true);
  });

  it('is deterministic across repeated requests', async () => {
    await saveContent(sampleContent);
    const first = await runAnalysis(ownerToken, versionId);
    const second = await runAnalysis(ownerToken, versionId);
    expect(first.body).toEqual(second.body);
  });

  it('rejects analysis of another user’s version as not found', async () => {
    await saveContent(sampleContent);
    const res = await runAnalysis(otherToken, versionId);
    expect(res.status).toBe(404);
  });

  it('rejects a malformed version id', async () => {
    const res = await request(app)
      .post('/api/v1/versions/bad%20id/ats-analysis')
      .set(auth(ownerToken))
      .send({});
    expect(res.status).toBe(400);
  });

  it('uses the canonical template catalogue metadata server-side', async () => {
    await saveContent(sampleContent);
    const defaultRes = await runAnalysis(ownerToken, versionId);
    expect(
      defaultRes.body.findings.some((f: { code: string }) => f.code === 'template.notAtsFriendly')
    ).toBe(false);

    const nonAts = ATS_TEMPLATE_PROFILES.find((d) => !d.isAtsFriendly);
    if (!nonAts) {
      throw new Error('Expected a non-ATS template profile in the catalogue.');
    }
    const switched = await request(app)
      .patch(`/api/v1/versions/${versionId}/template`)
      .set(auth(ownerToken))
      .send({ templateId: nonAts.id });
    expect(switched.status).toBe(200);

    const res = await runAnalysis(ownerToken, versionId);
    expect(
      res.body.findings.some((f: { code: string }) => f.code === 'template.notAtsFriendly')
    ).toBe(true);
  });
});
