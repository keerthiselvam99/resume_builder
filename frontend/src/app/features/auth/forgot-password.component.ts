import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SessionService } from '../../core/session/session.service';
import { emailValidator } from '../../core/validators/auth.validators';
import { AppButton } from '../../shared/components/app-button.component';
import { AppInput } from '../../shared/components/app-input.component';
import { AuthShellComponent } from './auth-shell.component';

@Component({
  selector: 'app-forgot-password',
  template: `
    <app-auth-shell
      heading="Reset your password"
      subtitle="Enter your email and we'll send you a reset link"
    >
      @if (!sent()) {
        <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
          <div class="stack">
            <app-input
              id="forgot-email"
              label="Email"
              type="email"
              autocomplete="email"
              [error]="getError()"
              formControlName="email"
            />

            @if (errorMessage()) {
              <p class="error" role="alert">{{ errorMessage() }}</p>
            }

            <app-button type="submit" [loading]="submitting()">Send reset link</app-button>

            <p class="text-muted center">
              Remembered it?
              <a routerLink="/login" class="link">Log in</a>
            </p>
          </div>
        </form>
      } @else {
        <div class="success" role="status">
          <p>
            If an account exists for <strong>{{ email() }}</strong
            >, a reset link has been sent.
          </p>
          <a routerLink="/login" class="link">Back to log in</a>
        </div>
      }
    </app-auth-shell>
  `,
  styles: `
    .stack {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
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
    .success {
      background: var(--color-success-bg);
      color: #166534;
      border: 1px solid var(--color-success);
      border-radius: var(--radius-md);
      padding: var(--space-4);
      font-size: var(--fs-sm);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .center {
      text-align: center;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, AppButton, AppInput, AuthShellComponent],
})
export class ForgotPasswordComponent {
  private readonly session = inject(SessionService);

  readonly form = new FormGroup({
    email: new FormControl('', [Validators.required, emailValidator]),
  });

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly sent = signal(false);
  readonly email = signal('');

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.controls.email.markAsTouched();
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);
    const email = this.form.value.email ?? '';
    this.session.requestPasswordReset(email).subscribe({
      next: () => {
        this.email.set(email);
        this.sent.set(true);
        this.submitting.set(false);
      },
      error: (err: Error) => {
        this.submitting.set(false);
        this.errorMessage.set(err.message || 'Something went wrong.');
      },
    });
  }

  getError(): string | null {
    const control = this.form.controls.email;
    if (!control.touched) {
      return null;
    }
    if (control.hasError('required')) {
      return 'This field is required.';
    }
    if (control.hasError('invalidEmail')) {
      return 'Enter a valid email address.';
    }
    return null;
  }
}
