import {
  ChangeDetectionStrategy,
  Component,
  computed,
  forwardRef,
  input,
  signal,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-password-input',
  template: `
    <div class="field" [class.field--invalid]="showError()">
      <label class="field__label" [for]="id()">{{ label() }}</label>
      <div class="field__wrapper">
        <input
          [id]="id()"
          class="field__control"
          [type]="hidden() ? 'password' : 'text'"
          [attr.placeholder]="placeholder()"
          [attr.autocomplete]="autocomplete()"
          [attr.aria-invalid]="showError() ? 'true' : null"
          [attr.aria-describedby]="showError() ? id() + '-error' : null"
          [value]="value()"
          [disabled]="disabled()"
          (input)="onInput($event)"
          (blur)="markTouched()"
        />
        <button
          type="button"
          class="field__toggle"
          [attr.aria-label]="hidden() ? 'Show password' : 'Hide password'"
          (click)="toggle()"
        >
          {{ hidden() ? 'Show' : 'Hide' }}
        </button>
      </div>
      @if (showError()) {
        <span class="field__error" [id]="id() + '-error'">{{ error() }}</span>
      }
    </div>
  `,
  styles: `
    .field {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      &__label {
        font-size: var(--fs-sm);
        font-weight: 600;
        color: var(--color-text);
      }
      &__wrapper {
        display: flex;
        gap: var(--space-2);
      }
      &__control {
        flex: 1;
        padding: 0.55rem 0.75rem;
        border: 1px solid var(--color-border-strong);
        border-radius: var(--radius-md);
        font-size: var(--fs-sm);
        font-family: inherit;
        background: var(--color-surface);
        color: var(--color-text);
        &:focus-visible {
          outline: 3px solid var(--color-primary);
          outline-offset: 1px;
        }
        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      }
      &__toggle {
        padding: 0.55rem 0.75rem;
        border: 1px solid var(--color-border-strong);
        border-radius: var(--radius-md);
        background: var(--color-surface-alt);
        color: var(--color-text-muted);
        font-size: var(--fs-xs);
        font-weight: 600;
        cursor: pointer;
        white-space: nowrap;
        &:hover {
          background: var(--color-border);
        }
      }
      &--invalid {
        .field__control {
          border-color: var(--color-danger);
        }
      }
      &__error {
        font-size: var(--fs-xs);
        color: var(--color-danger);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => AppPasswordInput),
      multi: true,
    },
  ],
  imports: [FormsModule],
})
export class AppPasswordInput implements ControlValueAccessor {
  readonly label = input<string>('');
  readonly placeholder = input<string>('');
  readonly autocomplete = input<string>('off');
  readonly id = input<string>(`app-password-${Math.random().toString(36).slice(2, 8)}`);
  readonly error = input<string | null>(null);

  readonly hidden = signal(true);
  readonly value = signal('');
  readonly disabled = signal(false);
  readonly showError = computed(() => (this.error() ?? '').length > 0);

  private onChange: (value: string) => void = () => {
    /* registered by Angular form control */
  };
  private onTouched: () => void = () => {
    /* registered by Angular form control */
  };

  writeValue(value: string): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
    this.onChange(this.value());
  }

  toggle(): void {
    this.hidden.update((h) => !h);
  }

  markTouched(): void {
    this.onTouched();
  }
}
