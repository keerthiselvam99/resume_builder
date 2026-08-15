import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type AppButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type AppButtonType = 'button' | 'submit' | 'reset';

@Component({
  selector: 'app-button',
  template: `
    <button
      [type]="type()"
      [disabled]="disabled() || loading()"
      [class]="'app-button app-button--' + variant()"
      [attr.aria-busy]="loading() ? 'true' : null"
      [attr.aria-label]="ariaLabel() || null"
      [attr.aria-describedby]="describedBy() || null"
      [attr.title]="titleText() || null"
    >
      @if (loading()) {
        <span class="spinner" aria-hidden="true"></span>
      }
      <span><ng-content /></span>
    </button>
  `,
  styles: `
    .app-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      padding: 0.55rem 1rem;
      border-radius: var(--radius-md);
      border: 1px solid transparent;
      font-size: var(--fs-sm);
      font-weight: 600;
      cursor: pointer;
      transition:
        background-color 150ms ease,
        border-color 150ms ease,
        color 150ms ease;
      &:disabled {
        opacity: 0.55;
        cursor: not-allowed;
      }
      &:focus-visible {
        outline: 3px solid var(--color-primary);
        outline-offset: 2px;
      }
      &--primary {
        background: var(--color-primary);
        color: var(--color-text-on-primary);
        &:not(:disabled):hover {
          background: var(--color-primary-hover);
        }
      }
      &--secondary {
        background: var(--color-surface);
        color: var(--color-text);
        border-color: var(--color-border-strong);
        &:not(:disabled):hover {
          background: var(--color-surface-alt);
        }
      }
      &--ghost {
        background: transparent;
        color: var(--color-primary);
        &:not(:disabled):hover {
          background: var(--color-primary-soft);
        }
      }
      &--danger {
        background: var(--color-danger-bg);
        color: var(--color-danger);
        &:not(:disabled):hover {
          background: var(--color-danger-hover-bg);
        }
      }
      .spinner {
        width: 14px;
        height: 14px;
        border: 2px solid currentColor;
        border-top-color: transparent;
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
      }
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppButton {
  readonly variant = input<AppButtonVariant>('primary');
  readonly type = input<AppButtonType>('button');
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly ariaLabel = input<string | null>(null);
  readonly describedBy = input<string | null>(null);
  readonly titleText = input<string | null>(null);
}
