import { environment } from '../../environment';
import { AuthSession } from '../../models/auth.model';
import { MockStore } from '../mock/mock-store';

/** Must match the key used by SessionService and the mock repositories. */
export const HTTP_SESSION_KEY = 'session';

const MOCK_TOKEN_PREFIX = 'mock-access-token';

/**
 * Holds the short-lived access token in memory and mirrors the full session in
 * localStorage (same key as the mock repos) so a page reload keeps the user
 * logged in. The refresh token is NOT stored here: it lives in an httpOnly
 * cookie managed by the browser, so JS can never read it.
 */
export class HttpAuthSession {
  private accessToken: string | null = null;

  constructor(private readonly baseUrl: string = environment.apiUrl) {
    const persisted = MockStore.read<AuthSession | null>(HTTP_SESSION_KEY, null);
    if (persisted?.accessToken && !persisted.accessToken.startsWith(MOCK_TOKEN_PREFIX)) {
      this.accessToken = persisted.accessToken;
    }
  }

  get currentAccessToken(): string | null {
    return this.accessToken;
  }

  setAccessToken(token: string | null): void {
    this.accessToken = token;
  }

  /** Persists the full session and adopts its access token. */
  setSession(session: AuthSession): void {
    this.accessToken = session.accessToken;
    MockStore.write(HTTP_SESSION_KEY, session);
  }

  clear(): void {
    this.accessToken = null;
    MockStore.remove(HTTP_SESSION_KEY);
  }

  /** Renews the access token using the httpOnly refresh cookie. */
  async refreshSession(): Promise<AuthSession | null> {
    const response = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) {
      return null;
    }
    const session = (await response.json()) as AuthSession;
    this.setSession(session);
    return session;
  }
}
