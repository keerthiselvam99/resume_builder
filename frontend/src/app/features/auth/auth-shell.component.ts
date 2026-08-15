import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-auth-shell',
  template: `
    <div class="auth">
      <div class="auth__card">
        <a class="auth__brand" routerLink="/">
          <span class="auth__logo" aria-hidden="true">IQ</span>
          <span class="auth__title">ResumeIQ</span>
        </a>
        <h1 class="auth__heading">{{ heading() }}</h1>
        <p class="auth__subtitle text-muted">{{ subtitle() }}</p>
        <ng-content />
      </div>
    </div>
  `,
  styles: `
    .auth {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-6);
      background: linear-gradient(160deg, var(--color-primary-soft), var(--color-surface));
    }
    .auth__card {
      width: 100%;
      max-width: 420px;
      background: var(--color-surface);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-lg);
      padding: var(--space-8);
    }
    .auth__brand {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      text-decoration: none;
      color: var(--color-text);
      margin-bottom: var(--space-6);
    }
    .auth__logo {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: var(--radius-md);
      background: var(--color-primary);
      color: var(--color-text-on-primary);
      font-weight: 800;
    }
    .auth__title {
      font-weight: 700;
      font-size: var(--fs-lg);
    }
    .auth__heading {
      font-size: var(--fs-2xl);
      margin-bottom: var(--space-1);
    }
    .auth__subtitle {
      margin-bottom: var(--space-6);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
})
export class AuthShellComponent {
  readonly heading = input('');
  readonly subtitle = input('');
}
