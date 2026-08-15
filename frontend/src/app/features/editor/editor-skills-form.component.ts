import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { AppButton } from '../../shared/components/app-button.component';
import { AppInput } from '../../shared/components/app-input.component';

@Component({
  selector: 'app-editor-skills-form',
  template: `
    <section class="section">
      <h2 class="section__title">Skills</h2>
      <div class="add">
        <app-input
          label="Add a skill"
          placeholder="e.g. Angular"
          [formControl]="newSkill"
          (keyup.enter)="addSkill()"
        />
        <app-button variant="secondary" (click)="addSkill()">Add</app-button>
      </div>
      @if (skills()?.length) {
        <ul class="chips">
          @for (skill of skills(); track skill) {
            <li class="chip">
              <span>{{ skill }}</span>
              <button
                type="button"
                class="chip__remove"
                [attr.aria-label]="'Remove ' + skill"
                (click)="removeSkill(skill)"
              >
                ×
              </button>
            </li>
          }
        </ul>
      } @else {
        <p class="text-muted empty">No skills added yet. Type one above and press Enter.</p>
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
    .section__title {
      font-size: var(--fs-md);
      margin: 0 0 var(--space-4);
    }
    .add {
      display: flex;
      align-items: flex-end;
      gap: var(--space-2);
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2);
      list-style: none;
      margin: var(--space-4) 0 0;
      padding: 0;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: var(--space-1);
      background: var(--color-primary-soft);
      color: var(--color-primary);
      border-radius: 999px;
      padding: 0.3rem 0.3rem 0.3rem 0.75rem;
      font-size: var(--fs-sm);
      font-weight: 600;
      &__remove {
        width: 20px;
        height: 20px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: none;
        border-radius: 50%;
        background: transparent;
        color: inherit;
        cursor: pointer;
        &:hover {
          background: var(--color-primary);
          color: var(--color-text-on-primary);
        }
      }
    }
    .empty {
      margin: var(--space-4) 0 0;
      font-size: var(--fs-sm);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, AppButton, AppInput],
})
export class EditorSkillsFormComponent {
  readonly skills = input<string[]>([]);
  readonly skillsChange = output<string[]>();

  readonly newSkill = new FormControl('');

  addSkill(): void {
    const raw = (this.newSkill.value ?? '').trim();
    if (!raw) {
      return;
    }
    const exists = this.skills().some((s) => s.toLowerCase() === raw.toLowerCase());
    if (!exists) {
      this.skillsChange.emit([...this.skills(), raw]);
    }
    this.newSkill.setValue('');
  }

  removeSkill(skill: string): void {
    this.skillsChange.emit(this.skills().filter((s) => s !== skill));
  }
}
