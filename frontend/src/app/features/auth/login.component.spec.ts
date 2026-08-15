import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { SessionService } from '../../core/session/session.service';
import { AUTH_REPOSITORY, RESUME_REPOSITORY } from '../../core/repositories/repository.providers';
import { MockAuthRepository } from '../../core/repositories/mock/mock-auth.repository';
import { MockResumeRepository } from '../../core/repositories/mock/mock-resume.repository';
import { LoginComponent } from './login.component';

const wait = () => new Promise((resolve) => setTimeout(resolve, 350));

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        SessionService,
        { provide: AUTH_REPOSITORY, useClass: MockAuthRepository },
        { provide: RESUME_REPOSITORY, useClass: MockResumeRepository },
        provideRouter([]),
        provideLocationMocks(),
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
  });

  function setField(selector: string, value: string): void {
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function submit(): void {
    const form = (fixture.nativeElement as HTMLElement).querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit'));
    fixture.detectChanges();
  }

  it('logs in successfully with valid credentials and redirects', async () => {
    const session = TestBed.inject(SessionService);
    setField('app-input input', 'arun@example.com');
    setField('app-password-input input', 'Password123!');
    submit();
    await wait();
    fixture.detectChanges();

    expect(session.isAuthenticated()).toBe(true);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/resumes');
  });

  it('shows an error message for invalid credentials', async () => {
    const session = TestBed.inject(SessionService);
    setField('app-input input', 'arun@example.com');
    setField('app-password-input input', 'wrong-password');
    submit();
    await wait();
    fixture.detectChanges();

    expect(session.isAuthenticated()).toBe(false);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Invalid email or password.');
  });
});
