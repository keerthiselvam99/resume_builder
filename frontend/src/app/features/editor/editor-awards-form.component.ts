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
import { AwardEntry } from '../../core/models/resume.model';
import { AppButton } from '../../shared/components/app-button.component';
import { AppInput } from '../../shared/components/app-input.component';
import { afterNextPaint, entryId, moveIndex } from './editor-entry.utils';

@Component({
  selector: 'app-editor-awards-form',
  template: `
    <section class="section">
      <div class="section__head">
        <h2 class="section__title">Awards &amp; Achievements</h2>
        <app-button variant="secondary" (click)="addEntry()">+ Add award</app-button>
      </div>

      @if (entries.length === 0) {
        <p class="empty text-muted">No awards added yet.</p>
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
                  New award
                } @else {
                  Award {{ i + 1 }}
                }
              </h3>
              @if (!isDraft(group)) {
                <div class="entry__actions">
                  <button
                    type="button"
                    class="icon-btn"
                    [disabled]="i === 0"
                    [attr.aria-label]="'Move award up'"
                    (click)="moveEntry(i, -1)"
                  >
                    &#9650;
                  </button>
                  <button
                    type="button"
                    class="icon-btn"
                    [disabled]="i === entries.length - 1"
                    [attr.aria-label]="'Move award down'"
                    (click)="moveEntry(i, 1)"
                  >
                    &#9660;
                  </button>
                  <button
                    type="button"
                    class="icon-btn icon-btn--danger"
                    [attr.aria-label]="'Remove award'"
                    (click)="removeEntry(i)"
                  >
                    &#10005;
                  </button>
                </div>
              }
            </div>

            <div class="grid">
              <app-input
                label="Award or achievement title"
                [error]="errorFor(group, 'title')"
                formControlName="title"
              />
              <app-input label="Issuing organization" formControlName="issuer" />
              <app-input label="Date" type="month" formControlName="date" />
              <app-input
                label="Description"
                formControlName="description"
                [error]="errorFor(group, 'description')"
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
      border-radius: var(--radius-lg);
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
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, AppButton, AppInput],
})
export class EditorAwardsFormComponent {
  readonly awards = input<AwardEntry[]>([]);
  readonly awardsChange = output<AwardEntry[]>();

  readonly entries = new FormArray<FormGroup>([]);
  private readonly draftIds = new Set<string>();
  private lastEmittedJson = '';

  private readonly entriesEl = viewChild<ElementRef<HTMLElement>>('entriesEl');

  constructor() {
    effect(() => {
      const value = this.awards();
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

  errorFor(group: FormGroup, control: string): string | null {
    const c = group.controls[control];
    if (!c || !c.touched || !c.errors) {
      return null;
    }
    if (c.errors['required']) {
      return 'Required';
    }
    if (c.errors['maxlength']) {
      return 'Maximum 500 characters';
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

  private rebuild(value: AwardEntry[]): void {
    this.draftIds.clear();
    this.entries.clear({ emitEvent: false });
    value.forEach((entry) => {
      const group = this.createGroup();
      group.patchValue({
        id: entry.id,
        title: entry.title,
        issuer: entry.issuer,
        date: entry.date,
        description: entry.description,
      });
      this.entries.push(group, { emitEvent: false });
    });
  }

  private createGroup(): FormGroup {
    return new FormGroup({
      id: new FormControl(entryId()),
      title: new FormControl('', Validators.required),
      issuer: new FormControl(''),
      date: new FormControl(''),
      description: new FormControl('', Validators.maxLength(500)),
    });
  }

  private emit(): void {
    const value = (this.entries.getRawValue() ?? []) as AwardEntry[];
    const filtered = value
      .filter((e) => !this.draftIds.has(e.id))
      .filter((e) => e.title.trim().length > 0);
    this.lastEmittedJson = JSON.stringify(filtered);
    this.awardsChange.emit(filtered);
  }
}
