import { Observable } from 'rxjs';
import { AuthRepository } from '../auth.repository';
import {
  AuthSession,
  LoginRequest,
  RegisterRequest,
  UserProfile,
  User,
  RegistrationResult,
} from '../../models/auth.model';
import { MockStore, mockResponse, mockError } from './mock-store';
import { fixtures, MockUserRecord } from './fixtures';

export class MockAuthRepository implements AuthRepository {
  private static readonly tokens = new Map<
    string,
    { email: string; purpose: 'verify' | 'reset' }
  >();
  private usersKey = 'users';
  private sessionKey = 'session';

  register(request: RegisterRequest): Observable<RegistrationResult> {
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
      emailVerifiedAt: null,
    };
    MockStore.write(this.usersKey, [...users, record]);
    const token = crypto.randomUUID() + crypto.randomUUID();
    MockAuthRepository.tokens.set(token, { email: record.email, purpose: 'verify' });
    return mockResponse({ requiresVerification: true, email: record.email });
  }

  login(request: LoginRequest): Observable<AuthSession> {
    const users = MockStore.read<MockUserRecord[]>(this.usersKey, fixtures.users);
    const record = users.find((u) => u.email === request.email);
    if (!record || record.password !== request.password) {
      return mockError('Invalid email or password.');
    }
    if (record.emailVerifiedAt === null) return mockError('Verify your email before signing in.');
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

  requestPasswordReset(email: string): Observable<void> {
    const users = MockStore.read<MockUserRecord[]>(this.usersKey, fixtures.users);
    if (users.some((user) => user.email === email))
      MockAuthRepository.tokens.set(crypto.randomUUID() + crypto.randomUUID(), {
        email,
        purpose: 'reset',
      });
    return mockResponse(undefined, 250);
  }

  resetPassword(token: string, newPassword: string): Observable<void> {
    const action = MockAuthRepository.tokens.get(token);
    if (!action || action.purpose !== 'reset')
      return mockError('This link is invalid or has expired.');
    const users = MockStore.read<MockUserRecord[]>(this.usersKey, fixtures.users);
    const user = users.find((item) => item.email === action.email);
    if (!user) return mockError('This link is invalid or has expired.');
    user.password = newPassword;
    MockStore.write(this.usersKey, users);
    MockAuthRepository.tokens.delete(token);
    MockStore.remove(this.sessionKey);
    return mockResponse(undefined, 250);
  }

  verifyEmail(token: string): Observable<void> {
    const action = MockAuthRepository.tokens.get(token);
    if (!action || action.purpose !== 'verify')
      return mockError('This link is invalid or has expired.');
    const users = MockStore.read<MockUserRecord[]>(this.usersKey, fixtures.users);
    const user = users.find((item) => item.email === action.email);
    if (!user) return mockError('This link is invalid or has expired.');
    user.emailVerifiedAt = new Date().toISOString();
    MockStore.write(this.usersKey, users);
    MockAuthRepository.tokens.delete(token);
    return mockResponse(undefined);
  }
  resendVerification(email: string): Observable<void> {
    const users = MockStore.read<MockUserRecord[]>(this.usersKey, fixtures.users);
    if (users.some((user) => user.email === email && user.emailVerifiedAt === null))
      MockAuthRepository.tokens.set(crypto.randomUUID() + crypto.randomUUID(), {
        email,
        purpose: 'verify',
      });
    return mockResponse(undefined);
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
