import { Observable, from, of } from 'rxjs';
import { AuthRepository } from '../auth.repository';
import { AuthSession, LoginRequest, RegisterRequest, UserProfile } from '../../models/auth.model';
import { HttpApiClient } from './api-client';
import { HttpAuthSession } from './http-auth-session';

/**
 * HTTP implementation of the auth repository. The refresh token is set as an
 * httpOnly cookie by the server, so register/login/refresh never touch it from
 * JS — only the short-lived access token passes through this class.
 */
export class HttpAuthRepository implements AuthRepository {
  constructor(
    private readonly client: HttpApiClient,
    private readonly session: HttpAuthSession,
  ) {}

  register(request: RegisterRequest): Observable<AuthSession> {
    return from(this.obtainSession('/auth/register', request));
  }

  login(request: LoginRequest): Observable<AuthSession> {
    return from(this.obtainSession('/auth/login', request));
  }

  refresh(): Observable<AuthSession> {
    return from(
      this.session.refreshSession().then((session) => {
        if (!session) {
          throw new Error('Session expired. Please sign in again.');
        }
        return session;
      }),
    );
  }

  logout(): Observable<void> {
    return from(
      this.client.request<void>('POST', '/auth/logout').finally(() => this.session.clear()),
    );
  }

  requestPasswordReset(_email: string): Observable<void> {
    // Password reset is deferred to a later milestone; mirror the mock's
    // success shape so the UI flow completes.
    return of(undefined);
  }

  resetPassword(_token: string, _newPassword: string): Observable<void> {
    return of(undefined);
  }

  getProfile(): Observable<UserProfile | null> {
    // The backend exposes the session user via /auth/me; the richer UserProfile
    // model has no backend counterpart yet, so return null like the mock.
    return of(null);
  }

  private async obtainSession(
    path: string,
    request: RegisterRequest | LoginRequest,
  ): Promise<AuthSession> {
    const session = await this.client.request<AuthSession>('POST', path, request);
    this.session.setSession(session);
    return session;
  }
}
