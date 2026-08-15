import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SessionService } from '../../core/session/session.service';
import {
  emailValidator,
  matchValues,
  passwordStrengthValidator,
} from '../../core/validators/auth.validators';
import { AppButton } from '../../shared/components/app-button.component';
import { AppInput } from '../../shared/components/app-input.component';
import { AppPasswordInput } from '../../shared/components/app-password-input.component';
import { AuthShellComponent } from './auth-shell.component';

@Component({
  selector: 'app-register',
  template: `
    <app-auth-shell
      heading="Create your account"
      subtitle="Start building ATS-friendly resumes in minutes"
    >
      <form [formGroup]="form" (ngSubmit)="onSubmit()" novalidate>
        <div class="stack">
          <app-input
            id="register-name"
            label="Full name"
            autocomplete="name"
            [error]="getError(form.controls.name)"
            formControlName="name"
          />
          <app-input
            id="register-email"
            label="Email"
            type="email"
            autocomplete="email"
            [error]="getError(form.controls.email)"
            formControlName="email"
          />
          <app-password-input
            id="register-password"
            label="Password"
            autocomplete="new-password"
            [error]="getError(form.controls.password)"
            formControlName="password"
          />
          <app-password-input
            id="register-confirm"
            label="Confirm password"
            autocomplete="new-password"
            [error]="getError(form.controls.confirmPassword)"
            formControlName="confirmPassword"
          />

          @if (errorMessage()) {
            <p class="error" role="alert">{{ errorMessage() }}</p>
          }

          <app-button type="submit" [loading]="submitting()">Create account</app-button>

          <p class="text-muted center">
            Already have an account?
            <a routerLink="/login" class="link">Log in</a>
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
export class RegisterComponent {
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);

  readonly form = new FormGroup({
    name: new FormControl('', [Validators.required, Validators.minLength(2)]),
    email: new FormControl('', [Validators.required, emailValidator]),
    password: new FormControl('', [Validators.required, passwordStrengthValidator]),
    confirmPassword: new FormControl('', [Validators.required, matchValues('password')]),
  });

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);
    const { name, email, password } = this.form.value;
    this.session.register(name ?? '', email ?? '', password ?? '').subscribe({
      next: () => this.router.navigateByUrl('/resumes'),
      error: (err: Error) => {
        this.submitting.set(false);
        this.errorMessage.set(err.message || 'Registration failed.');
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
    if (control.hasError('minlength')) {
      return 'Enter at least 2 characters.';
    }
    if (control.hasError('invalidEmail')) {
      return 'Enter a valid email address.';
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
