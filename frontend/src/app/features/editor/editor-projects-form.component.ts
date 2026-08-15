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
import { ProjectEntry } from '../../core/models/resume.model';
import { AppButton } from '../../shared/components/app-button.component';
import { AppInput } from '../../shared/components/app-input.component';
import { httpUrlValidator } from '../../core/validators/resume.validators';
import { afterNextPaint, endNotBeforeStart, entryId, moveIndex } from './editor-entry.utils';

@Component({
  selector: 'app-editor-projects-form',
  template: `
    <section class="section">
      <div class="section__head">
        <h2 class="section__title">Projects</h2>
        <app-button variant="secondary" (click)="addEntry()">+ Add project</app-button>
      </div>

      @if (entries.length === 0) {
        <p class="empty text-muted">No projects added yet.</p>
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
                  New project
                } @else {
                  Project {{ i + 1 }}
                }
              </h3>
              @if (!isDraft(group)) {
                <div class="entry__actions">
                  <button
                    type="button"
                    class="icon-btn"
                    [disabled]="i === 0"
                    [attr.aria-label]="'Move project up'"
                    (click)="moveEntry(i, -1)"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    class="icon-btn"
                    [disabled]="i === entries.length - 1"
                    [attr.aria-label]="'Move project down'"
                    (click)="moveEntry(i, 1)"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    class="icon-btn icon-btn--danger"
                    [attr.aria-label]="'Remove project'"
                    (click)="removeEntry(i)"
                  >
                    ×
                  </button>
                </div>
              }
            </div>

            <div class="grid">
              <app-input label="Title" [error]="errorFor(group, 'name')" formControlName="name" />
              <app-input label="Role" formControlName="role" />
              <app-input
                label="URL"
                [error]="errorFor(group, 'link')"
                formControlName="link"
                placeholder="https://..."
              />
            </div>

            <div class="grid grid--dates">
              <app-input label="Start date" type="month" formControlName="startDate" />
              <app-input label="End date" type="month" formControlName="endDate" />
            </div>
            @if (
              group.hasError('endBeforeStart') &&
              group.controls['startDate'].touched &&
              group.controls['endDate'].touched
            ) {
              <p class="field-error" role="alert">End date cannot be before start date.</p>
            }

            <app-input label="Technologies" formControlName="technologies" />
            <app-input label="Summary" formControlName="description" />

            <div class="bullets">
              <h4 class="bullets__title">Highlights</h4>
              @if (bulletsOf(group).length === 0) {
                <p class="text-muted bullets__empty">No highlights yet.</p>
              }
              @for (bullet of bulletsOf(group).controls; track bullet; let j = $index) {
                <div class="bullet__input" [formGroupName]="'bullets'">
                  <input
                    class="bullet__text"
                    [formControlName]="j"
                    placeholder="Write a highlight…"
                  />
                  <div class="bullet__actions">
                    <button
                      type="button"
                      class="icon-btn"
                      [disabled]="j === 0"
                      [attr.aria-label]="'Move highlight up'"
                      (click)="moveBullet(group, j, -1)"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      class="icon-btn"
                      [disabled]="j === bulletsOf(group).length - 1"
                      [attr.aria-label]="'Move highlight down'"
                      (click)="moveBullet(group, j, 1)"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      class="icon-btn icon-btn--danger"
                      [attr.aria-label]="'Remove highlight'"
                      (click)="removeBullet(group, j)"
                    >
                      ×
                    </button>
                  </div>
                </div>
              }
              <app-button variant="ghost" (click)="addBullet(group)">+ Add highlight</app-button>
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
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        align-items: flex-end;
      }
    }
    .field-error {
      color: var(--color-danger);
      font-size: var(--fs-xs);
      margin: 0;
    }
    .bullets {
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
      border-top: 1px solid var(--color-border);
      padding-top: var(--space-3);
    }
    .bullets__title {
      font-size: var(--fs-xs);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--color-text-muted);
      margin: 0;
    }
    .bullets__empty {
      font-size: var(--fs-xs);
      margin: 0;
    }
    .bullet__input {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .bullet__text {
      flex: 1;
      padding: 0.5rem 0.75rem;
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
    }
    .bullet__actions {
      display: flex;
      gap: var(--space-1);
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
  imports: [ReactiveFormsModule, AppButton, AppInput],
})
export class EditorProjectsFormComponent {
  readonly projects = input<ProjectEntry[]>([]);
  readonly projectsChange = output<ProjectEntry[]>();

  readonly entries = new FormArray<FormGroup>([]);
  private readonly draftIds = new Set<string>();
  private lastEmittedJson = '';

  private readonly entriesEl = viewChild<ElementRef<HTMLElement>>('entriesEl');

  constructor() {
    effect(() => {
      const value = this.projects();
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

  addBullet(group: FormGroup): void {
    this.bulletsOf(group).push(new FormControl('', { validators: [Validators.required] }));
  }

  removeBullet(group: FormGroup, index: number): void {
    this.bulletsOf(group).removeAt(index);
  }

  moveBullet(group: FormGroup, index: number, delta: number): void {
    const bullets = this.bulletsOf(group);
    const target = moveIndex(index, delta, bullets.length);
    if (target === index) {
      return;
    }
    const control = bullets.at(index);
    bullets.removeAt(index);
    bullets.insert(target, control);
  }

  errorFor(group: FormGroup, name: string): string | null {
    const control = group.controls[name];
    if (!control.touched) {
      return null;
    }
    if (control.hasError('required')) {
      return 'This field is required.';
    }
    if (control.hasError('invalidUrl')) {
      return 'Enter a valid http(s) URL.';
    }
    return null;
  }

  bulletsOf(group: FormGroup): FormArray {
    return group.controls['bullets'] as FormArray;
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

  private createEntry(data?: ProjectEntry): FormGroup {
    return new FormGroup(
      {
        id: new FormControl(data?.id ?? entryId()),
        name: new FormControl(data?.name ?? '', [Validators.required]),
        role: new FormControl(data?.role ?? ''),
        link: new FormControl(data?.link ?? '', [httpUrlValidator]),
        startDate: new FormControl(data?.startDate ?? ''),
        endDate: new FormControl(data?.endDate ?? ''),
        technologies: new FormControl(data?.technologies ?? ''),
        description: new FormControl(data?.description ?? ''),
        bullets: new FormArray(
          (data?.bullets ?? []).map(
            (b) => new FormControl(b, { validators: [Validators.required] }),
          ),
        ),
      },
      { validators: [endNotBeforeStart] },
    );
  }

  private rebuild(entries: ProjectEntry[]): void {
    this.draftIds.clear();
    this.entries.clear({ emitEvent: false });
    entries.forEach((entry) => this.entries.push(this.createEntry(entry), { emitEvent: false }));
  }

  private emit(): void {
    const result = this.toEntries(this.entries.value)
      .filter((e) => !this.draftIds.has(e.id))
      .filter((e) => e.name.trim())
      .map((e) => ({ ...e, bullets: e.bullets.filter((b) => b.trim().length > 0) }));
    this.lastEmittedJson = JSON.stringify(result);
    this.projectsChange.emit(result);
  }

  private toEntries(value: unknown[]): ProjectEntry[] {
    return value.map((raw) => {
      const entry = raw as ProjectEntry;
      return {
        id: entry.id,
        name: entry.name ?? '',
        role: entry.role ?? '',
        description: entry.description ?? '',
        technologies: entry.technologies ?? '',
        link: entry.link ?? '',
        startDate: entry.startDate ?? '',
        endDate: entry.endDate ?? '',
        bullets: [...(entry.bullets ?? [])],
      };
    });
  }
}
