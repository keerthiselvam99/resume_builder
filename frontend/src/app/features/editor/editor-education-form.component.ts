import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { EducationEntry } from '../../core/models/resume.model';
import { AppButton } from '../../shared/components/app-button.component';
import { AppInput } from '../../shared/components/app-input.component';
import { MonthYearPickerComponent } from '../../shared/components/month-year-picker.component';
import {
  afterNextPaint,
  endNotBeforeStart,
  entryId,
  monthError,
  monthNotInFuture,
  moveIndex,
} from './editor-entry.utils';

@Component({
  selector: 'app-editor-education-form',
  template: `
    <section class="section">
      <div class="section__head">
        <h2 class="section__title">Education</h2>
        <app-button variant="secondary" (click)="addEntry()">+ Add education</app-button>
      </div>

      @if (entries.length === 0) {
        <p class="empty text-muted">No education added yet.</p>
      }

      <div class="entries" #entriesEl>
        @for (group of entries.controls; track group.controls['id'].value; let i = $index) {
          <article
            class="entry"
            [formGroup]="group"
            [attr.data-entry-id]="group.controls['id'].value"
            [attr.data-draft]="isDraft(group) ? 'true' : null"
          >
            <div class="entry__head">
              <h3 class="entry__title">
                @if (isDraft(group)) {
                  New education
                } @else {
                  Education {{ i + 1 }}
                }
              </h3>
              @if (!isDraft(group)) {
                <div class="entry__actions">
                  <button
                    type="button"
                    class="icon-btn"
                    [disabled]="i === 0"
                    [attr.aria-label]="'Move education up'"
                    (click)="moveEntry(i, -1)"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    class="icon-btn"
                    [disabled]="i === entries.length - 1"
                    [attr.aria-label]="'Move education down'"
                    (click)="moveEntry(i, 1)"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    class="icon-btn icon-btn--danger"
                    [attr.aria-label]="'Remove education'"
                    (click)="removeEntry(i)"
                  >
                    ×
                  </button>
                </div>
              }
            </div>

            <div class="grid">
              <app-input
                label="Institution"
                [error]="errorFor(group, 'institution')"
                formControlName="institution"
              />
              <app-input label="Degree" formControlName="degree" />
              <app-input label="Field of study" formControlName="field" />
            </div>

            <div class="grid grid--dates">
              <app-month-year-picker
                label="Start date"
                [error]="dateError(group, 'startDate', 'start')"
                formControlName="startDate"
              />
              <app-month-year-picker
                label="End date"
                [error]="dateError(group, 'endDate', 'end')"
                formControlName="endDate"
              />
              <app-input
                label="Grade / Score (optional)"
                [error]="errorFor(group, 'gpa')"
                formControlName="gpa"
              />
            </div>
            @if (
              group.hasError('endBeforeStart') &&
              group.controls['startDate'].touched &&
              group.controls['endDate'].touched
            ) {
              <p class="field-error" role="alert">
                End date must be the same as or later than the start date.
              </p>
            }

            @if (isDraft(group)) {
              <div class="entry__form-actions">
                <app-button variant="primary" (click)="saveDraft(group)">Save</app-button>
                <app-button variant="ghost" (click)="cancelDraft(group)">Cancel</app-button>
              </div>
            }
          </article>
        }
      </div>
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
      align-items: center;
      justify-content: space-between;
      gap: var(--space-3);
      margin-bottom: var(--space-4);
    }
    .section__title {
      font-size: var(--fs-md);
      margin: 0;
    }
    .empty {
      font-size: var(--fs-sm);
      margin: 0;
    }
    .entries {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }
    .entry {
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: var(--space-4);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .entry__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
    }
    .entry__title {
      font-size: var(--fs-sm);
      margin: 0;
    }
    .entry__actions {
      display: flex;
      gap: var(--space-1);
    }
    .entry__form-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-2);
      border-top: 1px solid var(--color-border);
      padding-top: var(--space-3);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--space-3);
      &--dates {
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
        align-items: flex-end;
      }
    }
    .field-error {
      color: var(--color-danger);
      font-size: var(--fs-xs);
      margin: 0;
    }
    .icon-btn {
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-text);
      font-size: var(--fs-sm);
      cursor: pointer;
      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      &--danger {
        color: var(--color-danger);
        border-color: var(--color-danger);
      }
    }
    @media (max-width: 720px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, AppButton, AppInput, MonthYearPickerComponent],
})
export class EditorEducationFormComponent {
  readonly education = input<EducationEntry[]>([]);
  readonly educationChange = output<EducationEntry[]>();

  readonly entries = new FormArray<FormGroup>([]);
  private readonly draftIds = new Set<string>();
  private lastEmittedJson = '';

  private readonly entriesEl = viewChild<ElementRef<HTMLElement>>('entriesEl');

  constructor() {
    effect(() => {
      const value = this.education();
      if (JSON.stringify(value) !== this.lastEmittedJson) {
        this.rebuild(value);
        this.lastEmittedJson = JSON.stringify(value);
      }
    });
    this.entries.valueChanges.subscribe(() => this.emit());
  }

  addEntry(): void {
    const existing = this.draftEntry();
    if (existing) {
      this.focusFirstField(existing);
      return;
    }
    const group = this.createEntry();
    this.draftIds.add(String(group.controls['id'].value));
    this.entries.push(group);
    this.focusFirstField(group);
  }

  saveDraft(group: FormGroup): void {
    group.markAllAsTouched();
    if (group.invalid) {
      return;
    }
    this.draftIds.delete(String(group.controls['id'].value));
    this.emit();
  }

  cancelDraft(group: FormGroup): void {
    const index = this.entries.controls.indexOf(group);
    if (index >= 0) {
      this.entries.removeAt(index);
    }
  }

  isDraft(group: FormGroup): boolean {
    return this.draftIds.has(String(group.controls['id'].value));
  }

  removeEntry(index: number): void {
    this.entries.removeAt(index);
  }

  moveEntry(index: number, delta: number): void {
    const target = moveIndex(index, delta, this.entries.length);
    if (target === index) {
      return;
    }
    const control = this.entries.at(index);
    this.entries.removeAt(index);
    this.entries.insert(target, control);
  }

  errorFor(group: FormGroup, name: string): string | null {
    const control = group.controls[name];
    if (!control.touched) {
      return null;
    }
    if (control.hasError('required')) {
      return 'This field is required.';
    }
    return null;
  }

  private draftEntry(): FormGroup | null {
    return this.entries.controls.find((group) => this.isDraft(group)) ?? null;
  }

  private focusFirstField(group: FormGroup): void {
    const id = String(group.controls['id'].value);
    afterNextPaint(() => {
      const container = this.entriesEl()?.nativeElement;
      const card = container?.querySelector(`[data-entry-id="${id}"]`);
      const field = card?.querySelector<HTMLElement>('input, textarea, select');
      field?.focus();
    });
  }

  private createEntry(data?: EducationEntry): FormGroup {
    return new FormGroup(
      {
        id: new FormControl(data?.id ?? entryId()),
        institution: new FormControl(data?.institution ?? '', [Validators.required]),
        degree: new FormControl(data?.degree ?? ''),
        field: new FormControl(data?.field ?? ''),
        startDate: new FormControl(data?.startDate ?? '', [monthNotInFuture]),
        endDate: new FormControl(data?.endDate ?? '', [monthNotInFuture]),
        gpa: new FormControl(data?.gpa ?? '', [Validators.maxLength(15)]),
      },
      { validators: [endNotBeforeStart] },
    );
  }

  private rebuild(entries: EducationEntry[]): void {
    this.draftIds.clear();
    this.entries.clear({ emitEvent: false });
    entries.forEach((entry) => this.entries.push(this.createEntry(entry), { emitEvent: false }));
  }

  dateError(group: FormGroup, control: string, kind: 'start' | 'end'): string | null {
    return monthError(group.controls[control], kind);
  }

  private emit(): void {
    const committed = this.entries.controls.filter(
      (group) => !this.draftIds.has(String(group.controls['id'].value)),
    );
    if (committed.some((group) => group.invalid)) return;
    const validValues = committed.map((group) => group.getRawValue());
    const result = this.toEntries(validValues).filter((e) => e.institution.trim());
    this.lastEmittedJson = JSON.stringify(result);
    this.educationChange.emit(result);
  }

  private toEntries(value: unknown[]): EducationEntry[] {
    return value.map((raw) => {
      const entry = raw as EducationEntry;
      return {
        id: entry.id,
        institution: entry.institution ?? '',
        degree: entry.degree ?? '',
        field: entry.field ?? '',
        startDate: entry.startDate ?? '',
        endDate: entry.endDate ?? '',
        gpa: entry.gpa ?? '',
      };
    });
  }
}
