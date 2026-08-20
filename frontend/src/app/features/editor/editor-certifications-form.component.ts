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
import { CertificationEntry } from '../../core/models/resume.model';
import { AppButton } from '../../shared/components/app-button.component';
import { AppInput } from '../../shared/components/app-input.component';
import { MonthYearPickerComponent } from '../../shared/components/month-year-picker.component';
import {
  afterNextPaint,
  entryId,
  issueNotAfterExpiry,
  monthError,
  monthNotInFuture,
  moveIndex,
} from './editor-entry.utils';

@Component({
  selector: 'app-editor-certifications-form',
  template: `
    <section class="section">
      <div class="section__head">
        <h2 class="section__title">Certifications</h2>
        <app-button variant="secondary" (click)="addEntry()">+ Add certification</app-button>
      </div>

      @if (entries.length === 0) {
        <p class="empty text-muted">No certifications added yet.</p>
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
                  New certification
                } @else {
                  Certification {{ i + 1 }}
                }
              </h3>
              @if (!isDraft(group)) {
                <div class="entry__actions">
                  <button
                    type="button"
                    class="icon-btn"
                    [disabled]="i === 0"
                    [attr.aria-label]="'Move certification up'"
                    (click)="moveEntry(i, -1)"
                  >
                    &#9650;
                  </button>
                  <button
                    type="button"
                    class="icon-btn"
                    [disabled]="i === entries.length - 1"
                    [attr.aria-label]="'Move certification down'"
                    (click)="moveEntry(i, 1)"
                  >
                    &#9660;
                  </button>
                  <button
                    type="button"
                    class="icon-btn icon-btn--danger"
                    [attr.aria-label]="'Remove certification'"
                    (click)="removeEntry(i)"
                  >
                    &#10005;
                  </button>
                </div>
              }
            </div>

            <div class="grid">
              <app-input
                label="Certification name"
                [error]="errorFor(group, 'name')"
                formControlName="name"
              />
              <app-input
                label="Issuing organization"
                [error]="errorFor(group, 'issuer')"
                formControlName="issuer"
              />
              <app-month-year-picker
                label="Issue date"
                [error]="dateError(group, 'issueDate')"
                formControlName="issueDate"
              />
              <div class="field">
                <label class="field__label" for="doesNotExpire-{{ group.controls['id'].value }}">
                  Does not expire
                </label>
                <input
                  id="doesNotExpire-{{ group.controls['id'].value }}"
                  type="checkbox"
                  formControlName="doesNotExpire"
                />
              </div>
              <app-month-year-picker
                label="Expiry date"
                formControlName="expiryDate"
                [error]="dateError(group, 'expiryDate')"
              />
              <app-input label="Credential ID" formControlName="credentialId" />
              <app-input
                label="Credential URL"
                type="url"
                [error]="errorFor(group, 'credentialUrl')"
                formControlName="credentialUrl"
              />
            </div>

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
      border-radius: var(--radius-md);
      padding: var(--space-4);
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
    .empty {
      margin: var(--space-4) 0 0;
      font-size: var(--fs-sm);
    }
    .entries {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }
    .entry {
      background: var(--color-surface-alt);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: var(--space-3);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .entry__head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
      margin-bottom: 0;
    }
    .entry__title {
      font-size: var(--fs-sm);
      font-weight: 700;
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
    .icon-btn {
      width: 28px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-sm);
      background: var(--color-surface);
      color: var(--color-text);
      cursor: pointer;
      font-size: var(--fs-xs);
      padding: 0;
      &:hover {
        background: var(--color-primary-soft);
      }
      &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
      }
      &--danger {
        color: var(--color-danger);
        border-color: var(--color-danger);
        &:hover {
          background: var(--color-danger-bg);
        }
      }
      &:focus-visible {
        outline: 3px solid var(--color-primary);
        outline-offset: 2px;
      }
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: var(--space-3);
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      &__label {
        font-size: var(--fs-xs);
        font-weight: 600;
        color: var(--color-text-muted);
      }
      input[type='checkbox'] {
        width: auto;
        margin-top: var(--space-2);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, AppButton, AppInput, MonthYearPickerComponent],
})
export class EditorCertificationsFormComponent {
  readonly certifications = input<CertificationEntry[]>([]);
  readonly certificationsChange = output<CertificationEntry[]>();

  readonly entries = new FormArray<FormGroup>([]);
  private readonly draftIds = new Set<string>();
  private lastEmittedJson = '';

  private readonly entriesEl = viewChild<ElementRef<HTMLElement>>('entriesEl');

  constructor() {
    effect(() => {
      const value = this.certifications();
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
    const group = this.createGroup();
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

  onDoesNotExpireChange(group: FormGroup): void {
    const doesNotExpire = group.controls['doesNotExpire'].value;
    if (doesNotExpire) {
      group.controls['expiryDate'].setValue('');
      group.controls['expiryDate'].disable({ emitEvent: false });
    } else {
      group.controls['expiryDate'].enable({ emitEvent: false });
    }
  }

  errorFor(group: FormGroup, control: string): string | null {
    const c = group.controls[control];
    if (!c || !c.touched || !c.errors) {
      return null;
    }
    if (c.errors['required']) {
      return 'Required';
    }
    if (c.errors['url']) {
      return 'Must be a valid URL';
    }
    if (c.errors['expiryBeforeIssue']) {
      return 'Expiry cannot precede issue date';
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

  private rebuild(value: CertificationEntry[]): void {
    this.draftIds.clear();
    this.entries.clear({ emitEvent: false });
    value.forEach((entry) => {
      const group = this.createGroup();
      group.patchValue({
        id: entry.id,
        name: entry.name,
        issuer: entry.issuer,
        issueDate: entry.issueDate,
        doesNotExpire: entry.doesNotExpire,
        expiryDate: entry.expiryDate,
        credentialId: entry.credentialId,
        credentialUrl: entry.credentialUrl,
      });
      if (entry.doesNotExpire) {
        group.controls['expiryDate'].disable({ emitEvent: false });
      }
      this.entries.push(group, { emitEvent: false });
    });
  }

  private createGroup(): FormGroup {
    const group = new FormGroup(
      {
        id: new FormControl(entryId()),
        name: new FormControl('', Validators.required),
        issuer: new FormControl('', Validators.required),
        issueDate: new FormControl('', [monthNotInFuture]),
        doesNotExpire: new FormControl(false),
        expiryDate: new FormControl('', [monthNotInFuture]),
        credentialId: new FormControl(''),
        credentialUrl: new FormControl(''),
      },
      { validators: issueNotAfterExpiry },
    );

    group.controls['doesNotExpire'].valueChanges.subscribe(() => this.onDoesNotExpireChange(group));
    return group;
  }

  private emit(): void {
    const committed = this.entries.controls.filter(
      (group) => !this.draftIds.has(String(group.controls['id'].value)),
    );
    if (committed.some((group) => group.invalid)) return;
    const value = committed.map((group) => group.getRawValue()) as CertificationEntry[];
    const filtered = value
      .filter((e) => e.name.trim().length > 0 && e.issuer.trim().length > 0)
      .map((e) => ({
        ...e,
        expiryDate: e.doesNotExpire ? '' : e.expiryDate,
      }));
    this.lastEmittedJson = JSON.stringify(filtered);
    this.certificationsChange.emit(filtered);
  }

  dateError(group: FormGroup, control: string): string | null {
    return monthError(group.controls[control], 'date');
  }
}
