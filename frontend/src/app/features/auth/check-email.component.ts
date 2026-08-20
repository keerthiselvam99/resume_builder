import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { SessionService } from '../../core/session/session.service';
import { AuthShellComponent } from './auth-shell.component';

@Component({
  selector: 'app-check-email',
  imports: [RouterLink, AuthShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-auth-shell
    heading="Check your email"
    subtitle="Verification is required before you can sign in"
    ><div class="stack">
      <p>
        We sent a verification link to <strong>{{ masked() }}</strong
        >.
      </p>
      <p aria-live="polite">{{ message() }}</p>
      <button type="button" [disabled]="cooldown() > 0" (click)="resend()">
        {{
          cooldown() > 0
            ? 'Resend available in ' + cooldown() + ' seconds'
            : 'Resend verification email'
        }}</button
      ><a routerLink="/register">Change email</a><a routerLink="/login">Back to login</a>
      <p class="demo">Demo mode uses the local development mailbox; no external email is sent.</p>
    </div></app-auth-shell
  >`,
  styles: `
    .stack {
      display: grid;
      gap: 1rem;
    }
    .demo {
      padding: 0.75rem;
      border: 1px solid var(--color-border);
      border-radius: 0.5rem;
    }
  `,
})
export class CheckEmailComponent {
  private session = inject(SessionService);
  private router = inject(Router);
  readonly email =
    (this.router.getCurrentNavigation()?.extras.state?.['email'] as string | undefined) ??
    (history.state.email as string | undefined) ??
    '';
  readonly cooldown = signal(0);
  readonly message = signal('');
  readonly masked = () => mask(this.email);
  resend() {
    if (!this.email) return;
    this.session.resendVerification(this.email).subscribe({
      next: () => {
        this.message.set('If verification is needed, an email will be sent.');
        this.cooldown.set(30);
        const id = setInterval(() => {
          this.cooldown.update((v) => v - 1);
          if (this.cooldown() <= 0) clearInterval(id);
        }, 1000);
      },
      error: (e: Error) => this.message.set(e.message),
    });
  }
}
function mask(email: string) {
  const [name, domain] = email.split('@');
  return domain ? `${name.slice(0, 1)}***@${domain}` : 'your email address';
}
