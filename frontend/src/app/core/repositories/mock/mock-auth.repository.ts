import { Observable } from 'rxjs';
import { AuthRepository } from '../auth.repository';
import {
  AuthSession,
  LoginRequest,
  RegisterRequest,
  UserProfile,
  User,
} from '../../models/auth.model';
import { MockStore, mockResponse, mockError } from './mock-store';
import { fixtures, MockUserRecord } from './fixtures';

export class MockAuthRepository implements AuthRepository {
  private usersKey = 'users';
  private sessionKey = 'session';

  register(request: RegisterRequest): Observable<AuthSession> {
    const users = MockStore.read<MockUserRecord[]>(this.usersKey, fixtures.users);
    if (users.some((u) => u.email === request.email)) {
      return mockError('An account with this email already exists.');
    }
    const record: MockUserRecord = {
      id: MockStore.generateId(),
      name: request.name,
      email: request.email,
      password: request.password,
      role: 'user',
      createdAt: new Date().toISOString(),
    };
    MockStore.write(this.usersKey, [...users, record]);
    const { password: _pw, ...user } = record;
    return this.createSession(user);
  }

  login(request: LoginRequest): Observable<AuthSession> {
    const users = MockStore.read<MockUserRecord[]>(this.usersKey, fixtures.users);
    const record = users.find((u) => u.email === request.email);
    if (!record || record.password !== request.password) {
      return mockError('Invalid email or password.');
    }
    const { password: _pw, ...user } = record;
    return this.createSession(user);
  }

  refresh(): Observable<AuthSession> {
    const session = MockStore.read<AuthSession | null>(this.sessionKey, null);
    if (!session) {
      return mockError('No active session to refresh.');
    }
    const refreshed: AuthSession = {
      ...session,
      accessToken: 'mock-access-token-refreshed',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
    };
    MockStore.write(this.sessionKey, refreshed);
    return mockResponse(refreshed);
  }

  logout(): Observable<void> {
    MockStore.remove(this.sessionKey);
    return mockResponse(undefined, 150);
  }

  requestPasswordReset(_email: string): Observable<void> {
    return mockResponse(undefined, 250);
  }

  resetPassword(_token: string, _newPassword: string): Observable<void> {
    return mockResponse(undefined, 250);
  }

  getProfile(): Observable<UserProfile | null> {
    return mockResponse(null);
  }

  private createSession(user: User): Observable<AuthSession> {
    const session: AuthSession = {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      user,
    };
    MockStore.write(this.sessionKey, session);
    return mockResponse(session);
  }
}
