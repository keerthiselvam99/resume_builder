import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HTTP_API_CLIENT } from '../../core/repositories/repository.providers';

export interface CapturedEmailSummary {
  id: string;
  recipient: string;
  kind: 'verify-email' | 'reset-password' | 'password-changed';
  subject: string;
  createdAt: string;
  expiresAt: string | null;
  hasAction: boolean;
}

@Component({
  selector: 'app-dev-mailbox',
  imports: [DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="mailbox">
      <header>
        <div>
          <p class="eyebrow">Local development tool</p>
          <h1>Development email mailbox — not available in production.</h1>
          <p>Messages exist only in this backend process and disappear when it restarts.</p>
        </div>
        <button type="button" (click)="refresh()" [disabled]="loading()">Refresh mailbox</button>
      </header>

      <p class="status" aria-live="polite">
        @if (loading()) {
          Loading captured emails…
        } @else if (error()) {
          {{ error() }}
        } @else if (messages().length === 0) {
          No captured emails yet. Register or request a password reset, then refresh.
        } @else {
          {{ messages().length }} captured email{{ messages().length === 1 ? '' : 's' }}.
        }
      </p>

      @if (!loading() && !error() && messages().length > 0) {
        <ul aria-label="Captured development emails">
          @for (message of messages(); track message.id) {
            <li>
              <div class="message-heading">
                <strong>{{ label(message.kind) }}</strong>
                <span>{{ message.createdAt | date: 'medium' }}</span>
              </div>
              <dl>
                <div>
                  <dt>Recipient</dt>
                  <dd>{{ message.recipient }}</dd>
                </div>
                <div>
                  <dt>Email type</dt>
                  <dd>{{ label(message.kind) }}</dd>
                </div>
                <div>
                  <dt>Expires</dt>
                  <dd>
                    {{
                      message.expiresAt ? (message.expiresAt | date: 'medium') : 'Not applicable'
                    }}
                  </dd>
                </div>
              </dl>
              @if (message.hasAction) {
                <button
                  type="button"
                  (click)="open(message)"
                  [disabled]="openingId() === message.id"
                >
                  {{ openingId() === message.id ? 'Opening…' : actionLabel(message.kind) }}
                </button>
              }
            </li>
          }
        </ul>
      }

      <a routerLink="/login">Back to login</a>
    </main>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
      background: var(--color-bg);
    }
    .mailbox {
      width: min(70rem, calc(100% - 2rem));
      margin: 0 auto;
      padding: 2rem 0;
    }
    header {
      display: flex;
      justify-content: space-between;
      align-items: start;
      gap: 1.5rem;
    }
    h1 {
      max-width: 48rem;
      margin: 0.25rem 0;
      font-size: clamp(1.6rem, 4vw, 2.4rem);
    }
    .eyebrow {
      color: var(--color-primary);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .status {
      margin: 2rem 0;
      padding: 1rem;
      border: 1px solid var(--color-border);
      border-radius: 0.75rem;
    }
    ul {
      display: grid;
      gap: 1rem;
      padding: 0;
      list-style: none;
    }
    li {
      padding: 1.25rem;
      background: white;
      border: 1px solid var(--color-border);
      border-radius: 0.75rem;
    }
    .message-heading {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
    }
    dl {
      display: grid;
      gap: 0.5rem;
    }
    dl div {
      display: grid;
      grid-template-columns: 7rem 1fr;
      gap: 0.75rem;
    }
    dt {
      font-weight: 700;
    }
    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
    button {
      min-height: 2.75rem;
      padding: 0.65rem 1rem;
      cursor: pointer;
    }
    @media (max-width: 40rem) {
      header,
      .message-heading {
        flex-direction: column;
      }
      dl div {
        grid-template-columns: 1fr;
        gap: 0.1rem;
      }
    }
  `,
})
export class DevMailboxComponent {
  private readonly api = inject(HTTP_API_CLIENT);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly messages = signal<CapturedEmailSummary[]>([]);
  readonly openingId = signal('');

  constructor() {
    void this.load();
  }

  refresh(): void {
    void this.load();
  }

  async open(message: CapturedEmailSummary): Promise<void> {
    this.openingId.set(message.id);
    this.error.set('');
    try {
      const result = await this.api.request<{ actionPath: string }>(
        'POST',
        `/dev/mailbox/${encodeURIComponent(message.id)}/action`,
      );
      location.assign(result.actionPath);
    } catch {
      this.error.set('This captured email is no longer available. Refresh the mailbox.');
      this.openingId.set('');
    }
  }

  label(kind: CapturedEmailSummary['kind']): string {
    return kind === 'verify-email'
      ? 'Email verification'
      : kind === 'reset-password'
        ? 'Password reset'
        : 'Password changed';
  }

  actionLabel(kind: CapturedEmailSummary['kind']): string {
    return kind === 'verify-email' ? 'Open verification link' : 'Open reset link';
  }

  private async load(): Promise<void> {
    this.loading.set(true);
    this.error.set('');
    try {
      const result = await this.api.request<{ messages: CapturedEmailSummary[] }>(
        'GET',
        '/dev/mailbox',
      );
      this.messages.set(result.messages);
    } catch {
      this.messages.set([]);
      this.error.set('Development mailbox is disabled or unavailable.');
    } finally {
      this.loading.set(false);
    }
  }
}
