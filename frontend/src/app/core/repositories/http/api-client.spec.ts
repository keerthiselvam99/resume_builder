import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HttpApiClient } from './api-client';
import { AuthSession } from '../../models/auth.model';

interface StubConfigOptions {
  token?: string | null;
  refresh?: AuthSession | null;
}

function makeConfig(opts: StubConfigOptions = {}) {
  return {
    baseUrl: '/api/v1',
    getAccessToken: vi.fn(() => opts.token ?? null),
    setAccessToken: vi.fn(),
    refresh: vi.fn(() => Promise.resolve(opts.refresh ?? null)),
    onSessionExpired: vi.fn(),
  };
}

function fakeResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('HttpApiClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('sends the bearer token and credentials on every request', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ ok: true }));
    const client = new HttpApiClient(makeConfig({ token: 'token-1' }));

    await client.request('GET', '/resumes');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/resumes');
    const [, init] = fetchMock.mock.calls[0];
    expect(init).toMatchObject({
      method: 'GET',
      credentials: 'include',
      headers: { Authorization: 'Bearer token-1' },
    });
  });

  it('sends JSON bodies', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ id: 'r-1' }));
    const client = new HttpApiClient(makeConfig({ token: 't' }));

    await client.request('POST', '/resumes', { name: 'New', templateId: 't-1' });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBe('{"name":"New","templateId":"t-1"}');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('refreshes once and retries the original request after a 401', async () => {
    const config = makeConfig({ token: 'token-1', refresh: fakeSession('token-2') });
    fetchMock
      .mockResolvedValueOnce(fakeResponse({ error: 'expired' }, 401))
      .mockResolvedValueOnce(fakeResponse({ ok: true }));
    const client = new HttpApiClient(config);

    await client.request('GET', '/resumes');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(config.refresh).toHaveBeenCalledTimes(1);
    expect(config.setAccessToken).toHaveBeenCalledWith('token-2');
    const retryInit = fetchMock.mock.calls[1][1];
    expect(retryInit.headers.Authorization).toBe('Bearer token-2');
  });

  it('does not retry the refresh endpoint itself', async () => {
    const config = makeConfig({ token: 'token-1' });
    fetchMock.mockResolvedValue(fakeResponse({ error: 'no cookie' }, 401));
    const client = new HttpApiClient(config);

    await expect(client.request('GET', '/auth/refresh')).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(config.refresh).not.toHaveBeenCalled();
  });

  it('clears the session when a refresh attempt fails', async () => {
    const config = makeConfig({ token: 'expired' });
    fetchMock.mockResolvedValue(fakeResponse({ error: 'expired' }, 401));
    const client = new HttpApiClient(config);

    await expect(client.request('GET', '/resumes')).rejects.toMatchObject({ status: 401 });
    expect(config.onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('throws the server message for non-401 failures', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ error: 'Resume not found.' }, 404));
    const client = new HttpApiClient(makeConfig({ token: 't' }));

    await expect(client.request('GET', '/resumes/nope')).rejects.toThrow('Resume not found.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns undefined for a 204 and parsed JSON for 200', async () => {
    fetchMock.mockResolvedValue(fakeResponse(null, 204));
    const client = new HttpApiClient(makeConfig({ token: 't' }));

    await expect(client.request('DELETE', '/resumes/1')).resolves.toBeUndefined();

    fetchMock.mockResolvedValue(fakeResponse({ id: 'r-1' }));
    const data = await client.request<{ id: string }>('GET', '/resumes/1');
    expect(data.id).toBe('r-1');
  });
});

function fakeSession(accessToken: string): AuthSession {
  return {
    accessToken,
    refreshToken: 'rt-1',
    expiresAt: '2099-01-01T00:00:00.000Z',
    user: {
      id: 'u-1',
      name: 'Arun',
      email: 'arun@example.com',
      role: 'user',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  };
}
