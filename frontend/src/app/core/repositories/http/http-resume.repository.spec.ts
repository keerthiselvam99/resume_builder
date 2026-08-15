import { describe, expect, it, vi, beforeEach } from 'vitest';
import { lastValueFrom } from 'rxjs';
import { HttpApiClient } from './api-client';
import { HttpResumeRepository } from './http-resume.repository';
import { emptyContent } from './spec-helpers';

function makeClient(fetcher: ReturnType<typeof vi.fn>): HttpApiClient {
  vi.stubGlobal('fetch', fetcher);
  return new HttpApiClient({
    baseUrl: '/api/v1',
    getAccessToken: () => 'token-1',
    setAccessToken: vi.fn(),
    refresh: () => Promise.resolve(null),
    onSessionExpired: vi.fn(),
  });
}

describe('HttpResumeRepository', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let repo: HttpResumeRepository;

  beforeEach(() => {
    fetchMock = vi.fn();
    repo = new HttpResumeRepository(makeClient(fetchMock));
  });

  it('maps list() to GET /resumes', async () => {
    fetchMock.mockResolvedValue(fakeResponse([]));
    const resumes = await lastValueFrom(repo.list());
    expect(resumes).toEqual([]);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/resumes');
    expect(fetchMock.mock.calls[0][1].method).toBe('GET');
  });

  it('maps create() to POST /resumes with the request body', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ id: 'r-1' }));
    const resume = await lastValueFrom(
      repo.create({ name: 'Master', templateId: 't-classic-ats-navy' }),
    );
    expect(resume.id).toBe('r-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/resumes');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"name":"Master","templateId":"t-classic-ats-navy"}');
  });

  it('maps get() to GET /resumes/:id and returns null on 404', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ error: 'Resume not found.' }, 404));
    const resume = await lastValueFrom(repo.get('r-1'));
    expect(resume).toBeNull();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/resumes/r-1');
  });

  it('maps duplicate() to POST /resumes/:id/duplicate', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ id: 'r-2' }));
    const copy = await lastValueFrom(repo.duplicate('r-1'));
    expect(copy.id).toBe('r-2');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/resumes/r-1/duplicate');
  });

  it('maps markSaved() to POST /resumes/:id/save', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ id: 'r-1', status: 'saved' }));
    const saved = await lastValueFrom(repo.markSaved('r-1'));
    expect(saved.status).toBe('saved');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/resumes/r-1/save');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  });

  it('maps updateContent() to PATCH /versions/:id/content', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ id: 'v-1', content: emptyContent }));
    const version = await lastValueFrom(repo.updateContent('v-1', emptyContent));
    expect(version.id).toBe('v-1');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/versions/v-1/content');
    expect(init.method).toBe('PATCH');
  });

  it('maps compare() to GET /versions/compare with query params', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ versionA: { id: 'v-1' }, versionB: { id: 'v-2' } }));
    const pair = await lastValueFrom(repo.compare('v-1', 'v-2'));
    expect(pair.versionA.id).toBe('v-1');
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/versions/compare?versionA=v-1&versionB=v-2');
  });

  it('maps delete() to DELETE /resumes/:id and resolves on 204', async () => {
    fetchMock.mockResolvedValue(fakeResponse(null, 204));
    await expect(lastValueFrom(repo.delete('r-1'))).resolves.toBeUndefined();
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/resumes/r-1');
    expect(fetchMock.mock.calls[0][1].method).toBe('DELETE');
  });
});

function fakeResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}
