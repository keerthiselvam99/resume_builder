import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { Router, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SessionService } from '../../core/session/session.service';
import { AUTH_REPOSITORY, RESUME_REPOSITORY } from '../../core/repositories/repository.providers';
import { RegisterComponent } from './register.component';

describe('RegisterComponent email delivery states', () => {
  let fixture: ComponentFixture<RegisterComponent>;
  let auth: { register: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    auth = { register: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        SessionService,
        { provide: AUTH_REPOSITORY, useValue: auth },
        { provide: RESUME_REPOSITORY, useValue: {} },
        provideRouter([]),
        provideLocationMocks(),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(RegisterComponent);
    fixture.detectChanges();
    fixture.componentInstance.form.setValue({
      name: 'Synthetic User',
      email: 'synthetic@example.test',
      password: 'Password123!',
      confirmPassword: 'Password123!',
    });
  });

  it('navigates to the accessible check-email state after delivery', () => {
    auth.register.mockReturnValue(
      of({ requiresVerification: true, email: 'synthetic@example.test' }),
    );
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.componentInstance.onSubmit();
    expect(router.navigate).toHaveBeenCalledWith(['/check-email'], {
      state: { email: 'synthetic@example.test' },
    });
  });

  it('shows the safe delivery failure without exposing provider details', () => {
    auth.register.mockReturnValue(
      throwError(
        () =>
          new Error(
            'Your account was created, but we could not send the email. Please try resend shortly.',
          ),
      ),
    );
    fixture.componentInstance.onSubmit();
    fixture.detectChanges();
    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain('Please try resend shortly');
    expect(alert.textContent).not.toMatch(/API key|provider response/i);
  });
});
