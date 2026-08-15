import { ChangeDetectionStrategy, Component } from '@angular/core';
import { environment } from '../core/environment';

@Component({
  selector: 'app-mock-banner',
  template: `
    @if (environment.useMockApi) {
      <div class="mock-banner" role="status">
        <span class="mock-banner__dot" aria-hidden="true"></span>
        <strong>Demo mode:</strong>
        data is stored in your browser (localStorage) and authentication is mocked. Not production
        data.
      </div>
    }
  `,
  styles: `
    .mock-banner {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4);
      background: var(--color-warning-bg);
      color: var(--color-warning);
      border-bottom: 1px solid var(--color-warning-bg);
      font-size: var(--fs-sm);
    }
    .mock-banner__dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--color-warning);
      flex: none;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MockBannerComponent {
  protected readonly environment = environment;
}
