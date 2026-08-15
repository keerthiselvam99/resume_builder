import { describe, expect, it, vi, beforeEach } from 'vitest';
import { HttpAuthSession } from './http-auth-session';
import { AuthSession } from '../../models/auth.model';

const sampleSession = (overrides: Partial<AuthSession> = {}): AuthSession => ({
  accessToken: 'real-access-token',
  refreshToken: 'rt-1',
  expiresAt: '2099-01-01T00:00:00.000Z',
  user: {
    id: 'u-1',
    name: 'Arun',
    email: 'arun@example.com',
    role: 'user',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  ...overrides,
});

describe('HttpAuthSession', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('adopts a persisted real access token on startup', () => {
    localStorage.setItem('resumeiq_session', JSON.stringify(sampleSession()));
    const session = new HttpAuthSession('/api/v1');
    expect(session.currentAccessToken).toBe('real-access-token');
  });

  it('ignores a persisted token left behind by the mock repos', () => {
    localStorage.setItem(
      'resumeiq_session',
      JSON.stringify(sampleSession({ accessToken: 'mock-access-token' })),
    );
    const session = new HttpAuthSession('/api/v1');
    expect(session.currentAccessToken).toBeNull();
  });

  it('persists a full session and exposes its access token', () => {
    const session = new HttpAuthSession('/api/v1');
    session.setSession(sampleSession());
    expect(session.currentAccessToken).toBe('real-access-token');
    expect(JSON.parse(localStorage.getItem('resumeiq_session') ?? 'null').refreshToken).toBe(
      'rt-1',
    );
  });

  it('clears the token and persisted session', () => {
    const session = new HttpAuthSession('/api/v1');
    session.setSession(sampleSession());
    session.clear();
    expect(session.currentAccessToken).toBeNull();
    expect(localStorage.getItem('resumeiq_session')).toBeNull();
  });

  it('refreshes via the httpOnly cookie and persists the new session', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(fakeResponse(sampleSession({ accessToken: 'fresh-token' })));
    vi.stubGlobal('fetch', fetchMock);

    const session = new HttpAuthSession('/api/v1');
    const result = await session.refreshSession();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/auth/refresh',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(result?.accessToken).toBe('fresh-token');
    expect(session.currentAccessToken).toBe('fresh-token');
    expect(JSON.parse(localStorage.getItem('resumeiq_session') ?? 'null').accessToken).toBe(
      'fresh-token',
    );
  });

  it('returns null when the refresh request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fakeResponse({ error: 'expired' }, 401)));

    const session = new HttpAuthSession('/api/v1');
    expect(await session.refreshSession()).toBeNull();
  });
});

function fakeResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}
