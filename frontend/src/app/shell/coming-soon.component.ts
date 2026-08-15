import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-coming-soon',
  template: `
    <div class="placeholder">
      <h2>{{ title() }}</h2>
      <p class="text-muted">This screen is built in the next milestone.</p>
    </div>
  `,
  styles: `
    .placeholder {
      max-width: var(--content-max-width);
      margin: 0 auto;
      padding: var(--space-12) var(--space-4);
      text-align: center;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComingSoonComponent {
  readonly title = input('Coming soon');
}
