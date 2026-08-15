import { AuthSession } from '../../models/auth.model';

/** Error carrying the HTTP status so callers can distinguish 404 vs 401 etc. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClientConfig {
  baseUrl: string;
  getAccessToken(): string | null;
  setAccessToken(token: string | null): void;
  /** POST /auth/refresh; resolves null when the session cannot be renewed. */
  refresh(): Promise<AuthSession | null>;
  /** Called when a refresh attempt fails, so the caller can drop the session. */
  onSessionExpired(): void;
}

const REFRESH_PATH = '/auth/refresh';

/**
 * Thin fetch wrapper shared by every HTTP repository. Attaches the bearer
 * token, sends cookies (`credentials: 'include'` — the refresh token lives in
 * an httpOnly cookie the browser manages), and transparently retries a request
 * once after refreshing the short-lived access token when a 401 comes back.
 */
export class HttpApiClient {
  private refreshing: Promise<string | null> | null = null;

  constructor(private readonly config: ApiClientConfig) {}

  /** Performs a request and parses the JSON (or undefined for 204) response. */
  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await this.sendWithRetry(method, path, body);
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  }

  /** Performs a request and returns the raw response (for binary payloads). */
  async requestRaw(method: string, path: string, body?: unknown): Promise<Response> {
    return this.sendWithRetry(method, path, body);
  }

  private async sendWithRetry(method: string, path: string, body: unknown): Promise<Response> {
    try {
      return await this.send(method, path, body, this.config.getAccessToken());
    } catch (err) {
      if (path === REFRESH_PATH || !(err instanceof ApiError) || err.status !== 401) {
        throw err;
      }
      const token = await this.refreshAccessToken();
      if (!token) {
        throw err;
      }
      return this.send(method, path, body, token);
    }
  }

  private async send(
    method: string,
    path: string,
    body: unknown,
    token: string | null,
  ): Promise<Response> {
    const headers: Record<string, string> = {};
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'include',
    });
    if (!response.ok) {
      throw new ApiError(await readError(response), response.status);
    }
    return response;
  }

  private refreshAccessToken(): Promise<string | null> {
    if (!this.refreshing) {
      this.refreshing = (async () => {
        try {
          const session = await this.config.refresh();
          if (!session) {
            this.config.onSessionExpired();
            return null;
          }
          this.config.setAccessToken(session.accessToken);
          return session.accessToken;
        } catch {
          this.config.onSessionExpired();
          return null;
        } finally {
          this.refreshing = null;
        }
      })();
    }
    return this.refreshing;
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && 'error' in body) {
      const message = (body as { error?: unknown }).error;
      if (typeof message === 'string' && message) {
        return message;
      }
    }
  } catch {
    // Non-JSON error body; fall through to the status-based message.
  }
  return `Request failed (${response.status}).`;
}
