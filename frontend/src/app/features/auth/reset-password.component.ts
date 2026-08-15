import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SessionService } from '../../core/session/session.service';
import { matchValues, passwordStrengthValidator } from '../../core/validators/auth.validators';
import { AppButton } from '../../shared/components/app-button.component';
import { AppPasswordInput } from '../../shared/components/app-password-input.component';
import { AuthShellComponent } from './auth-shell.component';

@Component({
  selector: 'app-reset-password',
  template: `
    <app-auth-shell
      heading="Set a new password"
      subtitle="Choose a strong password for your account"
    >
      <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
        <div class="stack">
          <app-password-input
            id="reset-password"
            label="New password"
            autocomplete="new-password"
            [error]="getError(form.controls.password)"
            formControlName="password"
          />
          <app-password-input
            id="reset-confirm"
            label="Confirm new password"
            autocomplete="new-password"
            [error]="getError(form.controls.confirmPassword)"
            formControlName="confirmPassword"
          />

          @if (errorMessage()) {
            <p class="error" role="alert">{{ errorMessage() }}</p>
          }
          @if (success()) {
            <p class="success" role="status">Password reset. You can now log in.</p>
          }

          <app-button type="submit" [loading]="submitting()">Reset password</app-button>

          <p class="text-muted center">
            <a routerLink="/login" class="link">Back to log in</a>
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
      color: var(--color-success);
      border: 1px solid var(--color-success);
      border-radius: var(--radius-md);
      padding: var(--space-3);
      font-size: var(--fs-sm);
    }
    .center {
      text-align: center;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, AppButton, AppPasswordInput, AuthShellComponent],
})
export class ResetPasswordComponent {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly form = new FormGroup({
    password: new FormControl('', [Validators.required, passwordStrengthValidator]),
    confirmPassword: new FormControl('', [Validators.required, matchValues('password')]),
  });

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly success = signal(false);

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const token = this.route.snapshot.queryParamMap.get('token') ?? 'mock-token';
    const password = this.form.value.password ?? '';
    this.submitting.set(true);
    this.errorMessage.set(null);
    this.session.resetPassword(token, password).subscribe({
      next: () => {
        this.success.set(true);
        this.submitting.set(false);
        setTimeout(() => this.router.navigateByUrl('/login'), 1500);
      },
      error: (err: Error) => {
        this.submitting.set(false);
        this.errorMessage.set(err.message || 'Reset failed.');
      },
    });
  }

  getError(control: FormControl): string | null {
    if (!control.touched) {
      return null;
    }
    if (control.hasError('required')) {
      return 'This field is required.';
    }
    if (control.hasError('weakPassword')) {
      return 'Password must be at least 8 characters and include a letter and a number.';
    }
    if (control.hasError('mismatch')) {
      return 'Passwords do not match.';
    }
    return null;
  }
}
