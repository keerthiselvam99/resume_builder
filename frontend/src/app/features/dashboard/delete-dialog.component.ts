import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Resume } from '../../core/models/resume.model';
import { AppButton } from '../../shared/components/app-button.component';

@Component({
  selector: 'app-delete-dialog',
  template: `
    <div class="backdrop" tabindex="-1" (click)="dismiss.emit()" (keydown.escape)="dismiss.emit()">
      <div
        class="dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-dialog-title"
        (click)="$event.stopPropagation()"
        (keydown.escape)="dismiss.emit()"
      >
        <h2 id="delete-dialog-title" class="dialog__title">Delete resume?</h2>
        <p class="dialog__body">
          <strong>{{ resume().name }}</strong> will be permanently deleted along with all its
          versions. This cannot be undone.
        </p>
        <div class="dialog__actions">
          <app-button variant="secondary" (click)="dismiss.emit()">Cancel</app-button>
          <app-button variant="danger" [loading]="deleting()" (click)="confirm.emit()">
            Delete
          </app-button>
        </div>
      </div>
    </div>
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgb(15 23 42 / 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--space-4);
      z-index: 50;
    }
    .dialog {
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      padding: var(--space-6);
      max-width: 420px;
      width: 100%;
    }
    .dialog__title {
      font-size: var(--fs-xl);
      margin-bottom: var(--space-2);
    }
    .dialog__body {
      color: var(--color-text-muted);
      margin-bottom: var(--space-6);
    }
    .dialog__actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--space-3);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppButton],
})
export class DeleteDialogComponent {
  readonly resume = input.required<Resume>();
  readonly deleting = input(false);
  readonly confirm = output();
  readonly dismiss = output();
}
