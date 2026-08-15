import { describe, expect, it, vi, beforeEach } from 'vitest';
import { lastValueFrom } from 'rxjs';
import { HttpApiClient } from './api-client';
import { HttpAnalysisRepository } from './http-analysis.repository';
import { AtsAnalysis } from '../../models/ats.model';

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

const sampleAnalysis: AtsAnalysis = {
  rulesetVersion: 'ats-rules-v1',
  versionId: 'v-1',
  overallScore: 82,
  categories: [],
  findings: [],
  summary: { errors: 0, warnings: 0, info: 0 },
};

describe('HttpAnalysisRepository', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let repo: HttpAnalysisRepository;

  beforeEach(() => {
    fetchMock = vi.fn();
    repo = new HttpAnalysisRepository(makeClient(fetchMock));
  });

  it('maps runAtsAnalysis() to POST /versions/:id/ats-analysis with no body', async () => {
    fetchMock.mockResolvedValue(fakeResponse(sampleAnalysis));
    const analysis = await lastValueFrom(repo.runAtsAnalysis('v-1'));

    expect(analysis).toEqual(sampleAnalysis);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/versions/v-1/ats-analysis');
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
  });

  it('attaches the bearer access token', async () => {
    fetchMock.mockResolvedValue(fakeResponse(sampleAnalysis));
    await lastValueFrom(repo.runAtsAnalysis('v-1'));
    const [, init] = fetchMock.mock.calls[0];
    expect((init as { headers: Record<string, string> }).headers['Authorization']).toBe(
      'Bearer token-1',
    );
  });

  it('encodes the version id in the URL', async () => {
    fetchMock.mockResolvedValue(fakeResponse(sampleAnalysis));
    await lastValueFrom(repo.runAtsAnalysis('v 1/2'));
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/versions/v%201%2F2/ats-analysis');
  });

  it('surfaces a non-2xx response as an ApiError with the backend message', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ error: 'Version not found.' }, 404));
    await expect(lastValueFrom(repo.runAtsAnalysis('v-missing'))).rejects.toMatchObject({
      status: 404,
      message: 'Version not found.',
    });
  });
});

function fakeResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}
