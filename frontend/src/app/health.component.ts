import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { shareReplay } from 'rxjs';
import { HealthService } from './core/health.service';
import { HealthStatus } from './core/health-status';

@Component({
  selector: 'app-health',
  template: `
    @switch (database()) {
      @case ('up') {
        <p class="health status-up">API: {{ app() }} | Database: up | v{{ version() }}</p>
      }
      @case ('down') {
        <p class="health status-down">
          API: {{ app() }} | Database: down — is Oracle running and .env configured?
        </p>
      }
      @default {
        <p class="health status-loading">Checking service health…</p>
      }
    }
  `,
  styles: `
    .health {
      padding: 0.75rem 1rem;
      border-radius: 6px;
      font-family: monospace;
      margin: 0;
    }
    .status-up {
      background: var(--color-success-bg);
      color: var(--color-success);
    }
    &.error {
      background: var(--color-danger-bg);
      color: var(--color-danger);
    }
    &.warning {
      background: var(--color-warning-bg);
      color: var(--color-warning);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HealthComponent {
  private readonly health = toSignal<HealthStatus | undefined>(
    inject(HealthService).getHealth().pipe(shareReplay(1)),
  );

  protected readonly database = computed(() => this.health()?.database);
  protected readonly app = computed(() => this.health()?.app);
  protected readonly version = computed(() => this.health()?.version);
}
