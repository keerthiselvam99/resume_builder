import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SessionService } from '../../core/session/session.service';
import { emailValidator } from '../../core/validators/auth.validators';
import { AppButton } from '../../shared/components/app-button.component';
import { AppInput } from '../../shared/components/app-input.component';
import { AppPasswordInput } from '../../shared/components/app-password-input.component';
import { AuthShellComponent } from './auth-shell.component';
import { ApiError } from '../../core/repositories/http/api-client';

@Component({
  selector: 'app-login',
  template: `
    <app-auth-shell heading="Welcome back" subtitle="Log in to continue building your resumes">
      <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
        <div class="stack">
          <app-input
            id="login-email"
            label="Email"
            type="email"
            autocomplete="email"
            [error]="getError(form.controls.email)"
            formControlName="email"
          />
          <app-password-input
            id="login-password"
            label="Password"
            autocomplete="current-password"
            [error]="getError(form.controls.password)"
            formControlName="password"
          />

          <div class="row">
            <a routerLink="/forgot-password" class="link">Forgot password?</a>
          </div>

          @if (errorMessage()) {
            <p class="error" role="alert">{{ errorMessage() }}</p>
          }
          @if (verificationRequired()) {
            <button type="button" (click)="openCheckEmail()">Resend verification</button>
          }

          <app-button type="submit" [loading]="submitting()" class="submit">Log in</app-button>

          <p class="text-muted center">
            Don't have an account?
            <a routerLink="/register" class="link">Register</a>
          </p>
        </div>
      </form>
    </app-auth-shell>
  `,
  styles: `
    .stack {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }
    .row {
      display: flex;
      justify-content: flex-end;
    }
    .link {
      color: var(--color-primary);
      text-decoration: none;
      font-size: var(--fs-sm);
      font-weight: 600;
      &:hover {
        text-decoration: underline;
      }
    }
    .error {
      background: var(--color-danger-bg);
      color: var(--color-danger);
      border: 1px solid var(--color-danger-border);
      border-radius: var(--radius-md);
      padding: var(--space-3);
      font-size: var(--fs-sm);
    }
    .center {
      text-align: center;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    AppButton,
    AppInput,
    AppPasswordInput,
    AuthShellComponent,
  ],
})
export class LoginComponent {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly form = new FormGroup({
    email: new FormControl('', [Validators.required, emailValidator]),
    password: new FormControl('', [Validators.required]),
  });

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly verificationRequired = signal(false);

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);
    const { email, password } = this.form.value;
    this.session.login(email ?? '', password ?? '').subscribe({
      next: () => this.redirectAfterLogin(),
      error: (err: Error) => {
        this.submitting.set(false);
        this.errorMessage.set(err.message || 'Login failed.');
        this.verificationRequired.set(
          err instanceof ApiError && err.code === 'EMAIL_VERIFICATION_REQUIRED',
        );
      },
    });
  }

  openCheckEmail(): void {
    this.router.navigate(['/check-email'], { state: { email: this.form.value.email ?? '' } });
  }

  private redirectAfterLogin(): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/resumes';
    this.router.navigateByUrl(returnUrl);
  }

  getError(control: FormControl): string | null {
    if (!control.touched) {
      return null;
    }
    if (control.hasError('required')) {
      return 'This field is required.';
    }
    if (control.hasError('invalidEmail')) {
      return 'Enter a valid email address.';
    }
    if (control.hasError('weakPassword')) {
      return 'Password must be at least 8 characters and include a letter and a number.';
    }
    return null;
  }
}
