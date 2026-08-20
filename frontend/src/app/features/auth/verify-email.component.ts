import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SessionService } from '../../core/session/session.service';
import { AuthShellComponent } from './auth-shell.component';

@Component({
  selector: 'app-verify-email',
  imports: [RouterLink, AuthShellComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-auth-shell heading="Verify email" subtitle="Confirming your ResumeIQ account"
    ><p aria-live="polite">{{ status() }}</p>
    @if (done()) {
      <a routerLink="/login">Continue to login</a>
    }
  </app-auth-shell>`,
})
export class VerifyEmailComponent {
  private session = inject(SessionService);
  private route = inject(ActivatedRoute);
  readonly status = signal('Verifying…');
  readonly done = signal(false);
  constructor() {
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';
    setTimeout(() => history.replaceState({}, '', location.pathname));
    this.session.verifyEmail(token).subscribe({
      next: () => {
        this.status.set('Your email is verified.');
        this.done.set(true);
      },
      error: () => {
        this.status.set('This verification link is invalid or has expired.');
        this.done.set(true);
      },
    });
  }
}
