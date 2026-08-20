import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

let nextId = 0;

@Component({
  selector: 'app-month-year-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MonthYearPickerComponent),
      multi: true,
    },
  ],
  template: `
    <fieldset class="picker" [disabled]="disabled()">
      <legend>{{ label() }}</legend>
      <div class="controls">
        <select
          [id]="id + '-month'"
          [attr.aria-label]="label() + ' month'"
          [attr.aria-invalid]="error() ? 'true' : null"
          [attr.aria-describedby]="error() ? id + '-error' : null"
          [value]="month()"
          (change)="selectMonth($event)"
          (blur)="touch()"
        >
          <option value="">Month</option>
          @for (name of months; track $index; let index = $index) {
            <option [value]="pad(index + 1)" [disabled]="monthDisabled(index + 1)">
              {{ name }}
            </option>
          }
        </select>
        <select
          [id]="id + '-year'"
          [attr.aria-label]="label() + ' year'"
          [attr.aria-invalid]="error() ? 'true' : null"
          [attr.aria-describedby]="error() ? id + '-error' : null"
          [value]="year()"
          (change)="selectYear($event)"
          (blur)="touch()"
        >
          <option value="">Year</option>
          @for (item of years; track item) {
            <option [value]="item">{{ item }}</option>
          }
        </select>
      </div>
      @if (error()) {
        <p class="error" [id]="id + '-error'" role="alert">{{ error() }}</p>
      }
    </fieldset>
  `,
  styles: `
    .picker {
      min-width: 0;
      margin: 0;
      padding: 0;
      border: 0;
    }
    legend {
      margin-bottom: 0.35rem;
      font-size: var(--fs-sm);
      font-weight: 600;
    }
    .controls {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(5.5rem, 0.75fr);
      gap: 0.5rem;
    }
    select {
      width: 100%;
      min-height: 2.75rem;
      padding: 0.55rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: inherit;
    }
    select:focus-visible {
      outline: 3px solid color-mix(in srgb, var(--color-primary) 35%, transparent);
      outline-offset: 1px;
    }
    .error {
      margin: 0.3rem 0 0;
      color: var(--color-danger);
      font-size: var(--fs-sm);
    }
  `,
})
export class MonthYearPickerComponent implements ControlValueAccessor {
  readonly label = input.required<string>();
  readonly error = input<string | null>(null);
  readonly id = `month-year-${++nextId}`;
  readonly now = new Date();
  readonly years = Array.from({ length: this.now.getFullYear() - 1949 }, (_, i) =>
    String(this.now.getFullYear() - i),
  );
  readonly months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  readonly month = signal('');
  readonly year = signal('');
  readonly disabled = signal(false);
  private change: (value: string) => void = () => undefined;
  private touched: () => void = () => undefined;

  writeValue(value: string | null): void {
    const match = /^(\d{4})-(\d{2})$/.exec(value ?? '');
    this.year.set(match?.[1] ?? '');
    this.month.set(match?.[2] ?? '');
  }
  registerOnChange(fn: (value: string) => void): void {
    this.change = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.touched = fn;
  }
  setDisabledState(value: boolean): void {
    this.disabled.set(value);
  }
  selectMonth(event: Event): void {
    this.month.set((event.target as HTMLSelectElement).value);
    this.emit();
  }
  selectYear(event: Event): void {
    this.year.set((event.target as HTMLSelectElement).value);
    if (this.monthDisabled(Number(this.month()))) this.month.set('');
    this.emit();
  }
  touch(): void {
    this.touched();
  }
  pad(value: number): string {
    return String(value).padStart(2, '0');
  }
  monthDisabled(month: number): boolean {
    return Number(this.year()) === this.now.getFullYear() && month > this.now.getMonth() + 1;
  }
  private emit(): void {
    this.change(this.year() && this.month() ? `${this.year()}-${this.month()}` : '');
  }
}
