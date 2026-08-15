import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { provideRouter } from '@angular/router';
import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { AuthSession } from '../models/auth.model';
import { SessionService } from './session.service';
import { AUTH_REPOSITORY, RESUME_REPOSITORY } from '../repositories/repository.providers';
import { MockAuthRepository } from '../repositories/mock/mock-auth.repository';
import { MockResumeRepository } from '../repositories/mock/mock-resume.repository';
import { MockStore } from '../repositories/mock/mock-store';
import { authGuard, guestGuard, adminGuard } from '../guards/auth.guard';

const emptyRoute = {} as ActivatedRouteSnapshot;
const emptyState = {} as RouterStateSnapshot;

function fakeSession(): AuthSession {
  return {
    accessToken: 'tok',
    refreshToken: 'ref',
    expiresAt: new Date(Date.now() + 1000).toISOString(),
    user: {
      id: 'u1',
      name: 'A',
      email: 'a@b.com',
      role: 'user',
      createdAt: new Date().toISOString(),
    },
  };
}

describe('SessionService', () => {
  beforeEach(() => localStorage.clear());

  function setup(): { service: SessionService; router: Router } {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        SessionService,
        { provide: AUTH_REPOSITORY, useClass: MockAuthRepository },
        { provide: RESUME_REPOSITORY, useClass: MockResumeRepository },
      ],
    });
    return {
      service: TestBed.inject(SessionService),
      router: TestBed.inject(Router),
    };
  }

  it('starts unauthenticated when no session exists', () => {
    const { service } = setup();
    expect(service.isAuthenticated()).toBe(false);
  });

  it('restores a persisted session on refresh', () => {
    MockStore.write('session', fakeSession());
    const { service } = setup();
    expect(service.isAuthenticated()).toBe(true);
    expect(service.user()?.email).toBe('a@b.com');
  });

  it('login sets the session and logout clears it', async () => {
    const { service } = setup();
    await lastValueFrom(service.login('arun@example.com', 'Password123!'));
    expect(service.isAuthenticated()).toBe(true);

    await lastValueFrom(service.logout());
    expect(service.isAuthenticated()).toBe(false);
  });
});

describe('route guards', () => {
  beforeEach(() => localStorage.clear());

  function configure(session?: AuthSession) {
    if (session) {
      MockStore.write('session', session);
    }
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        SessionService,
        { provide: AUTH_REPOSITORY, useClass: MockAuthRepository },
        { provide: RESUME_REPOSITORY, useClass: MockResumeRepository },
      ],
    });
    return TestBed.inject(SessionService);
  }

  it('authGuard allows an authenticated user', () => {
    configure(fakeSession());
    const result = TestBed.runInInjectionContext(() => authGuard(emptyRoute, emptyState));
    expect(result).toBe(true);
  });

  it('authGuard redirects an anonymous user to /login', () => {
    configure();
    const result = TestBed.runInInjectionContext(() => authGuard(emptyRoute, emptyState));
    expect(result instanceof UrlTree).toBe(true);
  });

  it('authGuard preserves the attempted URL as the returnUrl query param', () => {
    configure();
    const state = { url: '/resumes' } as RouterStateSnapshot;
    const result = TestBed.runInInjectionContext(() => authGuard(emptyRoute, state)) as UrlTree;
    expect(result.toString()).toContain('/login');
    expect(result.queryParams['returnUrl']).toBe('/resumes');
  });

  it('guestGuard redirects an authenticated user to /resumes', () => {
    configure(fakeSession());
    const result = TestBed.runInInjectionContext(() => guestGuard(emptyRoute, emptyState));
    expect(result instanceof UrlTree).toBe(true);
    expect((result as UrlTree).toString()).toContain('/resumes');
  });

  it('guestGuard allows anonymous users', () => {
    configure();
    expect(TestBed.runInInjectionContext(() => guestGuard(emptyRoute, emptyState))).toBe(true);
  });

  it('adminGuard blocks non-admin users', () => {
    configure(fakeSession());
    const result = TestBed.runInInjectionContext(() => adminGuard(emptyRoute, emptyState));
    expect(result instanceof UrlTree).toBe(true);
    expect((result as UrlTree).toString()).toContain('/resumes');
  });

  it('adminGuard allows admins', () => {
    configure({ ...fakeSession(), user: { ...fakeSession().user, role: 'admin' } });
    expect(TestBed.runInInjectionContext(() => adminGuard(emptyRoute, emptyState))).toBe(true);
  });
});
