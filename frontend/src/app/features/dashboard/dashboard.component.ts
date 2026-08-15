import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RESUME_REPOSITORY } from '../../core/repositories/repository.providers';
import { Resume } from '../../core/models/resume.model';
import { AppButton } from '../../shared/components/app-button.component';
import { DeleteDialogComponent } from './delete-dialog.component';

@Component({
  selector: 'app-dashboard',
  template: `
    <div class="container">
      <div class="head">
        <div>
          <h1>{{ heading() }}</h1>
          <p class="text-muted">{{ subtitle() }}</p>
        </div>
        <app-button (click)="createResume()">+ New resume</app-button>
      </div>

      <nav class="tabs" aria-label="Resume lists">
        <a
          routerLink="/resumes"
          class="tabs__tab"
          [class.tabs__tab--active]="!isDraftsView()"
          [attr.aria-current]="!isDraftsView() ? 'page' : null"
          >My Resumes</a
        >
        <a
          routerLink="/resumes/drafts"
          class="tabs__tab"
          [class.tabs__tab--active]="isDraftsView()"
          [attr.aria-current]="isDraftsView() ? 'page' : null"
          >Drafts</a
        >
      </nav>

      @if (loading()) {
        <div class="state" role="status">Loading resumes…</div>
      } @else if (errorMessage()) {
        <div class="state state--error" role="alert">{{ errorMessage() }}</div>
      } @else if (visibleResumes().length === 0) {
        <div class="state">
          @if (isDraftsView()) {
            <h2>No drafts</h2>
            <p class="text-muted">
              New resumes start as drafts and appear here until you click "Save resume" in the
              editor.
            </p>
          } @else {
            <h2>No saved resumes yet</h2>
            <p class="text-muted">
              Drafts you save in the editor appear here. Create a resume to get started.
            </p>
            <app-button (click)="createResume()">Create your first resume</app-button>
          }
        </div>
      } @else {
        <div class="grid">
          @for (resume of visibleResumes(); track resume.id) {
            <article class="card" [class.card--primary]="resume.primary">
              <div class="card__top">
                <h2 class="card__title">{{ resume.name }}</h2>
                @if (isDraftsView()) {
                  <span class="badge badge--draft">Draft</span>
                } @else if (resume.primary) {
                  <span class="badge">Primary</span>
                }
              </div>
              <p class="card__meta text-muted">
                Updated {{ resume.updatedAt | date: 'mediumDate' }}
              </p>
              <div class="card__actions">
                <app-button variant="secondary" (click)="openResume(resume)">Open</app-button>
                <app-button variant="ghost" (click)="cloneResume(resume)">Clone</app-button>
                <app-button variant="ghost" (click)="renameResume(resume)">Rename</app-button>
                <app-button variant="ghost" (click)="askDelete(resume)">Delete</app-button>
              </div>
            </article>
          }
        </div>
      }
    </div>

    @if (deleteTarget()) {
      <app-delete-dialog
        [resume]="deleteTarget()!"
        [deleting]="deleting()"
        (confirm)="confirmDelete()"
        (dismiss)="deleteTarget.set(null)"
      />
    }
  `,
  styles: `
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      margin: var(--space-8) 0 var(--space-4);
      flex-wrap: wrap;
    }
    .tabs {
      display: flex;
      gap: var(--space-1);
      background: var(--color-surface-alt);
      border-radius: var(--radius-md);
      padding: var(--space-1);
      margin-bottom: var(--space-6);
      width: fit-content;
      &__tab {
        padding: 0.5rem 1.25rem;
        border-radius: calc(var(--radius-md) - 2px);
        text-decoration: none;
        color: var(--color-primary);
        font-size: var(--fs-sm);
        font-weight: 600;
        &:hover {
          background: var(--color-primary);
          color: #fff;
        }
        &:focus-visible {
          outline: 2px solid var(--color-accent);
          outline-offset: 2px;
        }
        &--active,
        &--active:hover,
        &[aria-current='page'],
        &[aria-current='page']:hover {
          background: var(--color-primary);
          color: #fff;
        }
        & *,
        &--active *,
        &[aria-current='page'] * {
          color: inherit;
        }
      }
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: var(--space-4);
    }
    .card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      padding: var(--space-5);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      &--primary {
        border-color: var(--color-primary);
      }
      &__top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--space-2);
      }
      &__title {
        font-size: var(--fs-lg);
        overflow-wrap: anywhere;
      }
      &__actions {
        display: flex;
        flex-wrap: wrap;
        gap: var(--space-2);
      }
    }
    .badge {
      background: var(--color-primary-soft);
      color: var(--color-primary);
      border-radius: 999px;
      padding: 0.15rem 0.6rem;
      font-size: var(--fs-xs);
      font-weight: 700;
      white-space: nowrap;
      &--draft {
        background: var(--color-warning-bg);
        color: var(--color-warning-emphasis);
      }
    }
    .state {
      background: var(--color-surface);
      border: 1px dashed var(--color-border-strong);
      border-radius: var(--radius-lg);
      padding: var(--space-12) var(--space-6);
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
      &--error {
        border-color: var(--color-danger);
        color: var(--color-danger);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, AppButton, RouterLink, DeleteDialogComponent],
})
export class DashboardComponent {
  private readonly resumeRepo = inject(RESUME_REPOSITORY);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  private readonly data = signal<Resume[]>([]);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly deleteTarget = signal<Resume | null>(null);
  readonly deleting = signal(false);

  /** True when the component renders the drafts list (/resumes/drafts). */
  readonly isDraftsView = computed(() => this.route.snapshot.data['drafts'] === true);

  readonly visibleResumes = computed(() =>
    this.isDraftsView()
      ? this.data().filter((r) => r.status === 'draft')
      : this.data().filter((r) => r.status !== 'draft'),
  );

  readonly heading = computed(() => (this.isDraftsView() ? 'Drafts' : 'My Resumes'));

  readonly subtitle = computed(() =>
    this.isDraftsView()
      ? 'Resumes you have not saved yet. Opening one lets you keep editing or save it.'
      : 'Create, manage and tailor your resumes.',
  );

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.resumeRepo.list().subscribe({
      next: (resumes) => {
        this.data.set(resumes);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load your resumes. Please try again.');
        this.loading.set(false);
      },
    });
  }

  openResume(resume: Resume): void {
    this.resumeRepo.listVersions(resume.id).subscribe({
      next: (versions) => {
        const target = versions.find((v) => v.isMaster) ?? versions[0];
        if (target) {
          this.router.navigate(['/resumes', resume.id, 'versions', target.id, 'edit']);
        }
      },
      error: () => this.errorMessage.set('Could not open the resume.'),
    });
  }

  createResume(): void {
    this.router.navigate(['/templates']);
  }

  cloneResume(resume: Resume): void {
    this.resumeRepo.duplicate(resume.id).subscribe({
      next: () => this.load(),
      error: () => this.errorMessage.set('Could not clone the resume.'),
    });
  }

  renameResume(resume: Resume): void {
    const name = window.prompt('New name for this resume:', resume.name);
    if (name && name.trim()) {
      this.resumeRepo.rename(resume.id, name.trim()).subscribe({
        next: () => this.load(),
        error: () => this.errorMessage.set('Could not rename the resume.'),
      });
    }
  }

  askDelete(resume: Resume): void {
    this.deleteTarget.set(resume);
  }

  confirmDelete(): void {
    const target = this.deleteTarget();
    if (!target) {
      return;
    }
    this.deleting.set(true);
    this.resumeRepo.delete(target.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.deleteTarget.set(null);
        this.load();
      },
      error: () => {
        this.deleting.set(false);
        this.errorMessage.set('Could not delete the resume.');
      },
    });
  }
}
