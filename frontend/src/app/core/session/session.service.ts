import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthSession, User } from '../models/auth.model';
import { AUTH_REPOSITORY, RESUME_REPOSITORY } from '../repositories/repository.providers';
import { MockStore } from '../repositories/mock/mock-store';
import { tap } from 'rxjs';

const SESSION_KEY = 'session';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly auth = inject(AUTH_REPOSITORY);
  private readonly resumes = inject(RESUME_REPOSITORY);

  private readonly state = signal<AuthSession | null>(
    MockStore.read<AuthSession | null>(SESSION_KEY, null),
  );

  readonly user = computed(() => this.state()?.user ?? null);
  readonly isAuthenticated = computed(() => this.state() !== null);
  readonly isAdmin = computed(() => this.user()?.role === 'admin');

  get currentUser(): User | null {
    return this.state()?.user ?? null;
  }

  get currentUserId(): string | null {
    return this.state()?.user?.id ?? null;
  }

  register(name: string, email: string, password: string) {
    return this.auth.register({ name, email, password }).pipe(
      tap((result) => {
        if (!result.requiresVerification) {
          this.state.set(MockStore.read<AuthSession | null>(SESSION_KEY, null));
        }
      }),
    );
  }

  login(email: string, password: string) {
    return this.auth.login({ email, password }).pipe(tap((s) => this.setSession(s)));
  }

  refresh() {
    return this.auth.refresh().pipe(tap((s) => this.setSession(s)));
  }

  logout() {
    return this.auth.logout().pipe(
      tap(() => {
        MockStore.remove(SESSION_KEY);
        this.state.set(null);
      }),
    );
  }

  requestPasswordReset(email: string) {
    return this.auth.requestPasswordReset(email);
  }

  resetPassword(token: string, newPassword: string) {
    return this.auth.resetPassword(token, newPassword).pipe(
      tap(() => {
        MockStore.remove(SESSION_KEY);
        this.state.set(null);
      }),
    );
  }
  verifyEmail(token: string) {
    return this.auth.verifyEmail(token);
  }
  resendVerification(email: string) {
    return this.auth.resendVerification(email);
  }

  private setSession(session: AuthSession): void {
    MockStore.write(SESSION_KEY, session);
    this.state.set(session);
  }
}
