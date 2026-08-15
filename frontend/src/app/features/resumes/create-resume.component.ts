import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RESUME_REPOSITORY } from '../../core/repositories/repository.providers';
import { ResumeRepository, CreateResumeRequest } from '../../core/repositories/resume.repository';
import { TemplateRegistry } from '../../core/templates/template-registry';
import { TemplateDefinition } from '../../core/models/template-definition.model';
import { ResumeContent } from '../../core/models/resume.model';
import { AppButton } from '../../shared/components/app-button.component';
import { PreviewFrameComponent } from '../../shared/components/preview-frame.component';
import { templatePreviewSampleContent } from '../../core/templates/template-preview-content';

@Component({
  selector: 'app-create-resume',
  template: `
    <div class="container">
      <div class="head">
        <a class="back-link" routerLink="/templates">← Back to templates</a>
        <h1>Create Resume</h1>
      </div>

      <div class="layout">
        <aside class="template-card">
          @if (template(); as tpl) {
            <app-preview-frame
              [content]="previewContent()"
              [templateId]="tpl.id"
              [title]="'Preview of ' + tpl.name"
              mode="fit"
            />
          }
        </aside>

        <div>
          <div class="card">
            <h2>Create a new resume</h2>
            <p class="text-muted">
              This will create a new resume using the selected template. You can rename it later.
            </p>
            <form (submit)="onSubmit($event)" class="form">
              <div class="field">
                <label class="field__label" for="resume-name">Resume name</label>
                <input
                  id="resume-name"
                  type="text"
                  class="field__control"
                  placeholder="e.g., Summer 2024 Internship, My Portfolio Resume"
                  [value]="name()"
                  (input)="name.set($any($event.target).value)"
                  required
                  autocomplete="off"
                />
              </div>
              <div class="form-actions">
                <app-button variant="primary" type="submit" [loading]="creating()">
                  Create and edit
                </app-button>
                <app-button variant="secondary" type="button" (click)="back()"> Cancel </app-button>
              </div>
            </form>
            @if (errorMessage()) {
              <div class="error" role="alert">{{ errorMessage() }}</div>
            }
          </div>
          <div class="card">
            @if (template(); as tpl) {
              <h2 class="template-card__name">{{ tpl.name }}</h2>
              <div class="template-card__badges">
                @if (tpl.isAtsFriendly) {
                  <span class="badge badge--ats">ATS-friendly</span>
                }
                @if (tpl.isVisual) {
                  <span class="badge badge--visual">Visual</span>
                }
              </div>
              <a class="change-link" routerLink="/templates">Change template</a>
            }
          </div>
        </div>
      </div>
    </div>
  `,
  styles: `
    .head {
      display: flex;
      align-items: center;
      gap: var(--space-4);
      margin: var(--space-6) 0 var(--space-4);
    }
    .back-link {
      color: var(--color-primary);
      text-decoration: none;
      font-weight: 600;
      font-size: var(--fs-sm);
      &:hover {
        text-decoration: underline;
      }
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: var(--space-6);
      align-items: start;
      @media (max-width: 720px) {
        grid-template-columns: 1fr;
      }
    }
    .template-card {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      padding: var(--space-4);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      align-self: start;
    }
    .template-card__name {
      font-size: var(--fs-lg);
      margin: 0;
    }
    .template-card__badges {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1);
    }
    .badge {
      border-radius: 999px;
      padding: 0.1rem 0.5rem;
      font-size: var(--fs-xs);
      font-weight: 700;
    }
    .badge--ats {
      background: var(--color-success-soft);
      color: var(--color-success);
    }
    .badge--visual {
      background: var(--color-accent-soft);
      color: var(--color-accent);
    }
    .change-link {
      color: var(--color-primary);
      text-decoration: none;
      font-weight: 600;
      font-size: var(--fs-sm);
      &:hover {
        text-decoration: underline;
      }
    }
    .card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: var(--space-6);
    }
    .text-muted {
      color: var(--color-text-muted);
      margin-bottom: var(--space-4);
    }
    .form {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      margin-top: var(--space-4);
    }
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
      }
    }
    .form-actions {
      display: flex;
      gap: var(--space-2);
    }
    .error {
      background: var(--color-danger-soft);
      color: var(--color-danger);
      border-radius: var(--radius-md);
      padding: var(--space-3);
      margin-top: var(--space-2);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppButton, RouterLink, PreviewFrameComponent],
})
export class CreateResumeComponent {
  private readonly resumeRepo = inject(RESUME_REPOSITORY) as ResumeRepository;
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly registry = inject(TemplateRegistry);

  readonly name = signal('');
  readonly creating = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly template = signal<TemplateDefinition | null>(null);

  readonly previewContent = computed<ResumeContent>(() => templatePreviewSampleContent);

  constructor() {
    const templateId = this.route.snapshot.queryParamMap.get('templateId');
    if (!templateId) {
      this.router.navigate(['/templates']);
      return;
    }
    this.template.set(this.registry.get(templateId));
    this.name.set('My Resume');
  }

  onSubmit(event: SubmitEvent): void {
    event.preventDefault();
    this.create();
  }

  create(): void {
    const templateId = this.route.snapshot.queryParamMap.get('templateId');
    if (!templateId || !this.name().trim()) {
      return;
    }
    this.creating.set(true);
    this.errorMessage.set(null);
    const request: CreateResumeRequest = {
      name: this.name().trim(),
      templateId: templateId,
    };
    this.resumeRepo.create(request).subscribe({
      next: (resume) => {
        this.resumeRepo.listVersions(resume.id).subscribe({
          next: (versions) => {
            const master = versions.find((v) => v.isMaster) ?? versions[0];
            this.creating.set(false);
            if (master) {
              this.router.navigate(['/resumes', resume.id, 'versions', master.id, 'edit']);
            }
          },
          error: () => {
            this.creating.set(false);
            this.errorMessage.set('Could not load the new resume version.');
          },
        });
      },
      error: (err) => {
        this.creating.set(false);
        this.errorMessage.set(err?.message || 'Could not create the resume.');
      },
    });
  }

  back(): void {
    this.router.navigate(['/templates']);
  }
}
