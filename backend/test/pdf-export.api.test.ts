import { it, describe, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

vi.mock('../src/db/connection', () => ({
  Db: {
    getConnection: vi.fn(),
    close: vi.fn(),
  },
}));

import { app } from '../src/server';
import { sampleContent } from '../../frontend/scripts/shared/sample-content';

describe('PDF export API (authenticated, ownership-checked)', () => {
  let token = '';
  let ownerVersionId = '';
  let otherToken = '';

  beforeAll(async () => {
    vi.restoreAllMocks();

    const owner = await request(app).post('/api/v1/auth/register').send({
      name: 'Owner',
      email: 'owner@example.com',
      password: 'Password123',
    });
    token = owner.body.accessToken;

    const resume = await request(app)
      .post('/api/v1/resumes')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Master Resume', templateId: 't-classic-ats-navy' });
    const versions = await request(app)
      .get(`/api/v1/resumes/${resume.body.id}/versions`)
      .set('Authorization', `Bearer ${token}`);
    ownerVersionId = versions.body[0].id;

    const other = await request(app).post('/api/v1/auth/register').send({
      name: 'Other',
      email: 'other@example.com',
      password: 'Password123',
    });
    otherToken = other.body.accessToken;
  });

  afterAll(async () => {
    const { pdfExportService } = await import('../src/services/pdf/pdf-export.service');
    await pdfExportService.close();
  });

  function pdfRequest(versionId: string) {
    return request(app)
      .post(`/api/v1/versions/${versionId}/pdf`)
      .set('Authorization', `Bearer ${token}`);
  }

  /** Structurally valid request body with no user-supplied content. */
  const emptyContentBody = {
    templateDefinitionId: 't-classic-ats-navy',
    content: {
      contacts: {
        fullName: '',
        title: '',
        email: '',
        phone: '',
        location: '',
        linkedinUrl: '',
        githubUrl: '',
        portfolioUrl: '',
      },
      summary: '',
      skills: [],
      experiences: [],
      projects: [],
      education: [],
      certifications: [],
      awards: [],
      achievements: [],
      languages: [],
      customSections: [],
    },
  };

  it('GET /healthz returns 200 without Oracle', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });

  it('GET /livez returns 200 without Oracle', async () => {
    const res = await request(app).get('/livez');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });

  it('rejects unauthenticated export with 401', async () => {
    const res = await request(app)
      .post('/api/v1/versions/some-version/pdf')
      .send({ templateDefinitionId: 't-classic-ats-navy', content: sampleContent });
    expect(res.status).toBe(401);
  });

  it('returns 404 when exporting another user’s version', async () => {
    const res = await request(app)
      .post(`/api/v1/versions/${ownerVersionId}/pdf`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({
        templateDefinitionId: 't-classic-ats-navy',
        content: sampleContent,
        filename: 'sneaky',
      });
    expect(res.status).toBe(404);
  });

  it('POST /api/v1/versions/:id/pdf returns a PDF with headers', async () => {
    const res = await pdfRequest(ownerVersionId).send({
      templateDefinitionId: 't-classic-ats-navy',
      content: sampleContent,
      filename: 'Arun Kumar Master Resume',
    });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('arun-kumar-master-resume.pdf');
    expect(Number(res.headers['x-pdf-page-count'])).toBeGreaterThan(0);
    expect(res.body.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('exposes only page count and a request id; diagnostic details stay server-side', async () => {
    const res = await pdfRequest(ownerVersionId).send({
      templateDefinitionId: 't-classic-ats-navy',
      content: sampleContent,
      filename: 'diagnostics',
    });

    expect(res.status).toBe(200);
    expect(typeof res.headers['x-request-id']).toBe('string');
    expect((res.headers['x-request-id'] as string).length).toBeGreaterThan(0);
    expect(Number(res.headers['x-pdf-page-count'])).toBeGreaterThan(0);
    expect(res.headers['x-pdf-filename']).toBeUndefined();
    expect(res.headers['x-pdf-network-attempts']).toBeUndefined();
    expect(res.headers['x-pdf-link-annotations']).toBeUndefined();
  });

  it('rejects legacy HTML payloads (unknown keys are not accepted)', async () => {
    const res = await pdfRequest(ownerVersionId).send({
      html: '<script>alert(1)</script>',
      filename: 'x',
    });
    expect(res.status).toBe(400);
  });

  it('rejects unknown template definition ids', async () => {
    const res = await pdfRequest(ownerVersionId).send({
      templateDefinitionId: 't-unknown-navy',
      content: sampleContent,
    });
    expect(res.status).toBe(400);
  });

  it('rejects malformed content', async () => {
    const res = await pdfRequest(ownerVersionId).send({
      templateDefinitionId: 't-classic-ats-navy',
      content: { contacts: {} },
    });
    expect(res.status).toBe(400);
  });

  it('rejects exporting an empty resume with a clear message', async () => {
    const res = await pdfRequest(ownerVersionId).send(emptyContentBody);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no content to export/i);
  });

  it('rejects an invalid version id', async () => {
    const res = await pdfRequest('v-master..bad').send({
      templateDefinitionId: 't-classic-ats-navy',
      content: sampleContent,
    });
    expect(res.status).toBe(400);
  });

  it('sanitizes unsafe URLs in structured content instead of failing', async () => {
    const hostile = structuredClone(sampleContent);
    hostile.contacts.linkedinUrl = 'javascript:alert(1)';
    hostile.contacts.portfolioUrl = 'data:text/html,<script>x</script>';

    const res = await pdfRequest(ownerVersionId).send({
      templateDefinitionId: 't-classic-ats-navy',
      content: hostile,
      filename: 'safe',
    });
    expect(res.status).toBe(200);
    expect(res.body.subarray(0, 4).toString()).toBe('%PDF');
  });
});
