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
  selector: 'app-input',
  template: `
    <div class="field" [class.field--invalid]="showError()">
      <label class="field__label" [for]="id()">{{ label() }}</label>
      <input
        [id]="id()"
        class="field__control"
        [type]="type()"
        [attr.placeholder]="placeholder()"
        [attr.autocomplete]="autocomplete()"
        [attr.aria-invalid]="showError() ? 'true' : null"
        [attr.aria-describedby]="showError() ? id() + '-error' : null"
        [value]="value()"
        [disabled]="disabled()"
        (input)="onInput($event)"
        (blur)="markTouched()"
      />
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
      &__control {
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
      useExisting: forwardRef(() => AppInput),
      multi: true,
    },
  ],
  imports: [FormsModule],
})
export class AppInput implements ControlValueAccessor {
  readonly label = input<string>('');
  readonly type = input<string>('text');
  readonly placeholder = input<string>('');
  readonly autocomplete = input<string>('off');
  readonly id = input<string>(`app-input-${Math.random().toString(36).slice(2, 8)}`);
  readonly error = input<string | null>(null);

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

  markTouched(): void {
    this.onTouched();
  }
}
