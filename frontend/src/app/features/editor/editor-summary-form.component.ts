import { ChangeDetectionStrategy, Component, computed, effect, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';

@Component({
  selector: 'app-editor-summary-form',
  template: `
    <section class="section">
      <div class="section__head">
        <h2 class="section__title" id="summary-title">Summary</h2>
        <span
          class="section__count text-muted"
          [class.section__count--limit]="remaining() < 0"
          id="summary-count"
          >{{ remaining() }} characters left</span
        >
      </div>
      <textarea
        class="summary"
        [formControl]="control"
        rows="5"
        maxlength="600"
        aria-labelledby="summary-title"
        aria-describedby="summary-count"
        [attr.aria-invalid]="remaining() < 0 ? 'true' : null"
      ></textarea>
      @if (control.touched && remaining() < 0) {
        <p class="section__error" role="alert">Summary is limited to 600 characters.</p>
      }
    </section>
  `,
  styles: `
    .section {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: var(--space-5);
    }
    .section__head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-3);
      margin-bottom: var(--space-4);
    }
    .section__title {
      font-size: var(--fs-md);
      margin: 0;
    }
    .section__count {
      font-size: var(--fs-xs);
      font-weight: 600;
      &--limit {
        color: var(--color-danger);
      }
    }
    .summary {
      width: 100%;
      min-height: 8rem;
      padding: 0.6rem 0.75rem;
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-md);
      font-size: var(--fs-sm);
      font-family: inherit;
      line-height: 1.5;
      resize: vertical;
      background: var(--color-surface);
      color: var(--color-text);
      &:focus-visible {
        outline: 3px solid var(--color-primary);
        outline-offset: 1px;
      }
    }
    .section__error {
      font-size: var(--fs-xs);
      color: var(--color-danger);
      margin: var(--space-2) 0 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
})
export class EditorSummaryFormComponent {
  readonly summary = input<string | null>(null);
  readonly summaryChange = output<string>();

  readonly control = new FormControl('', [Validators.maxLength(600)]);

  readonly remaining = computed(() => 600 - (this.control.value?.length ?? 0));

  constructor() {
    effect(() => {
      const value = this.summary();
      if (value !== null && value !== this.control.value) {
        this.control.setValue(value, { emitEvent: false });
      }
    });
    this.control.valueChanges.subscribe((value) => this.summaryChange.emit(value ?? ''));
  }
}
