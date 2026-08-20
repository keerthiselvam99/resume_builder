import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { SessionService } from '../../core/session/session.service';
import { AUTH_REPOSITORY, RESUME_REPOSITORY } from '../../core/repositories/repository.providers';
import { CheckEmailComponent } from './check-email.component';

describe('CheckEmailComponent delivery states', () => {
  let fixture: ComponentFixture<CheckEmailComponent>;
  let auth: { resendVerification: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    auth = { resendVerification: vi.fn() };
    history.replaceState({ email: 'synthetic@example.test' }, '');
    await TestBed.configureTestingModule({
      imports: [CheckEmailComponent],
      providers: [
        SessionService,
        { provide: AUTH_REPOSITORY, useValue: auth },
        { provide: RESUME_REPOSITORY, useValue: {} },
        provideRouter([]),
        provideLocationMocks(),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CheckEmailComponent);
    fixture.detectChanges();
  });

  it('announces a generic success and enforces the resend cooldown', () => {
    vi.useFakeTimers();
    auth.resendVerification.mockReturnValue(of(undefined));
    fixture.componentInstance.resend();
    fixture.detectChanges();

    const status = fixture.nativeElement.querySelector('[aria-live="polite"]') as HTMLElement;
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(status.textContent).toContain('If verification is needed');
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain('30 seconds');

    vi.advanceTimersByTime(30_000);
    fixture.detectChanges();
    expect(button.disabled).toBe(false);
    vi.useRealTimers();
  });

  it('announces a safe resend failure', () => {
    auth.resendVerification.mockReturnValue(
      throwError(() => new Error('Email delivery is temporarily unavailable. Please try again.')),
    );
    fixture.componentInstance.resend();
    fixture.detectChanges();

    const status = fixture.nativeElement.querySelector('[aria-live="polite"]') as HTMLElement;
    expect(status.textContent).toContain('temporarily unavailable');
    expect(status.textContent).not.toMatch(/API key|token|provider response/i);
  });
});
