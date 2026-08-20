import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { isContentEmpty } from '../../core/models/resume-content-empty';
import { normalizeResumeContent } from '../../core/templates/resume-template-renderer';
import { ApiError } from '../../core/repositories/http/api-client';
import {
  RESUME_REPOSITORY,
  PDF_EXPORT_REPOSITORY,
  DEMO_MODE,
} from '../../core/repositories/repository.providers';
import { ResumeContent } from '../../core/models/resume.model';
import { AtsFinding } from '../../core/models/ats.model';
import { SessionService } from '../../core/session/session.service';
import { AppButton } from '../../shared/components/app-button.component';
import { ResumeEditorStore } from './resume-editor.store';
import { buildPdfFilename } from './pdf-filename';
import { EditorContactFormComponent } from './editor-contact-form.component';
import { EditorSummaryFormComponent } from './editor-summary-form.component';
import { EditorSkillsFormComponent } from './editor-skills-form.component';
import { EditorExperienceFormComponent } from './editor-experience-form.component';
import { EditorProjectsFormComponent } from './editor-projects-form.component';
import { EditorEducationFormComponent } from './editor-education-form.component';
import { EditorCertificationsFormComponent } from './editor-certifications-form.component';
import { EditorAwardsFormComponent } from './editor-awards-form.component';
import { ResumePreviewComponent } from './resume-preview.component';
import { AtsAnalysisPanelComponent } from './ats-analysis-panel.component';

@Component({
  selector: 'app-resume-editor',
  template: `
    <div class="editor">
      @if (store.loading()) {
        <div class="state" role="status">Loading version…</div>
      } @else if (store.errorMessage()) {
        <div class="state state--error" role="alert">
          <p>{{ store.errorMessage() }}</p>
          <app-button variant="secondary" (click)="goBack()">Back to My Resumes</app-button>
        </div>
      } @else {
        <header class="editor__bar">
          <a class="back-link" routerLink="/resumes">← My Resumes</a>
          <div class="editor__actions">
            <app-button variant="secondary" (click)="changeTemplate()">Change template</app-button>
            <span class="editor__save-label sr-only" role="status" aria-live="polite">{{
              saveStatus()
            }}</span>
            @if (store.saveState() === 'failed') {
              <app-button variant="secondary" (click)="store.retry()">Retry</app-button>
            }
            @if (store.resumeStatus() === 'draft') {
              <app-button variant="primary" [loading]="savingResume()" (click)="saveResume()"
                >Save resume</app-button
              >
            }
            <app-button
              variant="primary"
              [loading]="pdfState() === 'generating'"
              [disabled]="pdfState() === 'generating' || pdfDisabled()"
              [describedBy]="
                isDemoMode ? 'editor-pdf-demo-hint' : pdfDisabled() ? 'editor-pdf-empty-hint' : null
              "
              [titleText]="
                isDemoMode
                  ? 'PDF download requires the local backend. Start the full application to export your resume.'
                  : null
              "
              (click)="downloadPdf()"
              >Download PDF</app-button
            >
            @if (isDemoMode) {
              <span id="editor-pdf-demo-hint" class="editor__pdf-label" role="status"
                >PDF download requires the local backend. Start the full application to export your
                resume.</span
              >
            } @else {
              <span id="editor-pdf-empty-hint" class="sr-only"
                >Add resume content before downloading your PDF.</span
              >
            }
            @if (pdfState() === 'generating') {
              <span class="editor__pdf-label" role="status" aria-live="polite">Generating…</span>
            } @else if (pdfState() === 'success') {
              <span class="editor__pdf-label editor__pdf-label--ok" role="status" aria-live="polite"
                >Downloaded</span
              >
            } @else if (pdfState() === 'error') {
              <span class="editor__pdf-label editor__pdf-label--error" role="alert">{{
                pdfMessage()
              }}</span>
              @if (pdfRetryable()) {
                <app-button variant="secondary" (click)="downloadPdf()">Retry</app-button>
              }
            }
          </div>
        </header>

        <div class="editor__toggle" role="tablist" aria-label="Editor panes">
          <button
            type="button"
            role="tab"
            id="tab-edit"
            [attr.aria-selected]="mobilePane() === 'edit'"
            [attr.aria-controls]="'panel-edit'"
            [class.editor__toggle-btn--active]="mobilePane() === 'edit'"
            (click)="mobilePane.set('edit')"
          >
            Edit
          </button>
          <button
            type="button"
            role="tab"
            id="tab-preview"
            [attr.aria-selected]="mobilePane() === 'preview'"
            [attr.aria-controls]="'panel-preview'"
            [class.editor__toggle-btn--active]="mobilePane() === 'preview'"
            (click)="mobilePane.set('preview')"
          >
            Preview
          </button>
        </div>

        <div class="editor__body" role="group" aria-label="Resume editor">
          <div
            id="panel-edit"
            role="tabpanel"
            aria-labelledby="tab-edit"
            class="editor__form"
            [class.editor__form--hidden]="mobilePane() === 'preview'"
          >
            @if (content(); as c) {
              <section id="editor-section-contact" class="editor__section">
                <app-editor-contact-form
                  [contacts]="c.contacts"
                  (contactsChange)="updateContacts($event)"
                />
              </section>
              <section id="editor-section-summary" class="editor__section">
                <app-editor-summary-form
                  [summary]="c.summary"
                  (summaryChange)="updateSummary($event)"
                />
              </section>
              <section id="editor-section-skills" class="editor__section">
                <app-editor-skills-form [skills]="c.skills" (skillsChange)="updateSkills($event)" />
              </section>
              <section id="editor-section-experience" class="editor__section">
                <app-editor-experience-form
                  [experiences]="c.experiences"
                  (experiencesChange)="updateExperiences($event)"
                />
              </section>
              <section id="editor-section-projects" class="editor__section">
                <app-editor-projects-form
                  [projects]="c.projects"
                  (projectsChange)="updateProjects($event)"
                />
              </section>
              <section id="editor-section-education" class="editor__section">
                <app-editor-education-form
                  [education]="c.education"
                  (educationChange)="updateEducation($event)"
                />
              </section>
              <section id="editor-section-certifications" class="editor__section">
                <app-editor-certifications-form
                  [certifications]="c.certifications"
                  (certificationsChange)="updateCertifications($event)"
                />
              </section>
              <section id="editor-section-awards" class="editor__section">
                <app-editor-awards-form [awards]="c.awards" (awardsChange)="updateAwards($event)" />
              </section>
              @if (versionId(); as vid) {
                <app-ats-analysis-panel
                  [versionId]="vid"
                  [templateId]="templateId() ?? ''"
                  [content]="c"
                  [prepareAnalysis]="prepareAnalysis"
                  (improveRequested)="focusFinding($event)"
                />
              }
            }
          </div>

          <div
            id="panel-preview"
            role="tabpanel"
            aria-labelledby="tab-preview"
            class="editor__preview"
            [class.editor__preview--hidden]="mobilePane() === 'edit'"
          >
            <app-resume-preview [content]="content()" [templateId]="templateId()" />
          </div>
        </div>
      }
    </div>
  `,
  styles: `
    .editor {
      padding: var(--space-4);
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }
    .state {
      background: var(--color-surface);
      border: 1px dashed var(--color-border-strong);
      border-radius: var(--radius-lg);
      padding: var(--space-12) var(--space-6);
      text-align: center;
      &--error {
        border-color: var(--color-danger);
        color: var(--color-danger);
      }
    }
    .editor__bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      flex-wrap: wrap;
    }
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: var(--space-2);
      color: var(--color-primary);
      font-weight: 600;
      text-decoration: none;
      white-space: nowrap;
      &:hover {
        text-decoration: underline;
      }
    }
    .editor__actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: var(--space-3);
      flex-wrap: wrap;
    }
    :host ::ng-deep .editor__actions app-button .app-button {
      height: 2.5rem;
      padding-top: 0;
      padding-bottom: 0;
      box-sizing: border-box;
    }
    .editor__pdf-label {
      font-size: var(--fs-sm);
      font-weight: 600;
      color: var(--color-text-muted);
      &--ok {
        color: var(--color-success);
      }
      &--error {
        color: var(--color-danger);
      }
    }
    @media (max-width: 800px) {
      .editor__bar {
        flex-direction: column;
        align-items: stretch;
      }
      .editor__actions {
        justify-content: flex-start;
      }
    }
    .editor__toggle {
      display: none;
      gap: var(--space-1);
      background: var(--color-surface-alt);
      border-radius: var(--radius-md);
      padding: var(--space-1);
      button {
        flex: 1;
        border: none;
        background: transparent;
        padding: 0.5rem 1rem;
        border-radius: calc(var(--radius-md) - 2px);
        font-size: var(--fs-sm);
        font-weight: 600;
        cursor: pointer;
        &--active {
          background: var(--color-primary);
          color: var(--color-text-on-primary);
        }
      }
    }
    .editor__body {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: var(--space-5);
      align-items: start;
    }
    .editor__form {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
    }
    .editor__section {
      scroll-margin-top: calc(var(--header-height) + var(--space-4));
    }
    .editor__preview {
      position: sticky;
      top: calc(var(--header-height) + var(--space-4));
    }
    @media (max-width: 960px) {
      .editor__toggle {
        display: flex;
      }
      .editor__body {
        grid-template-columns: 1fr;
      }
      .editor__preview {
        position: static;
      }
      .editor__form--hidden,
      .editor__preview--hidden {
        display: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AppButton,
    RouterLink,
    EditorContactFormComponent,
    EditorSummaryFormComponent,
    EditorSkillsFormComponent,
    EditorExperienceFormComponent,
    EditorProjectsFormComponent,
    EditorEducationFormComponent,
    EditorCertificationsFormComponent,
    EditorAwardsFormComponent,
    ResumePreviewComponent,
    AtsAnalysisPanelComponent,
  ],
})
export class ResumeEditorComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pdfRepo = inject(PDF_EXPORT_REPOSITORY);
  private readonly session = inject(SessionService);

  /** True when the app runs on localStorage-backed repositories (no backend). */
  readonly isDemoMode = inject(DEMO_MODE);

  readonly store = new ResumeEditorStore(inject(RESUME_REPOSITORY));

  readonly content = computed(() => this.store.content());
  readonly templateId = computed(() => this.store.version()?.templateId ?? null);
  readonly versionId = computed(() => this.store.version()?.id ?? null);
  readonly mobilePane = signal<'edit' | 'preview'>('edit');

  readonly pdfState = signal<'idle' | 'generating' | 'success' | 'error'>('idle');
  readonly pdfMessage = signal('');
  readonly pdfRetryable = signal(false);
  private pdfSuccessTimer: ReturnType<typeof setTimeout> | null = null;

  readonly savingResume = signal(false);

  readonly prepareAnalysis = async (): Promise<void> => {
    this.store.flush();
    await this.store.waitForIdle();
  };

  readonly saveStatus = computed(() => {
    switch (this.store.saveState()) {
      case 'saving':
        return 'Saving…';
      case 'unsaved':
        return 'Unsaved changes';
      case 'failed':
        return 'Save failed';
      default:
        return this.store.resumeStatus() === 'draft' ? 'Draft saved' : 'Saved';
    }
  });

  /**
   * There is nothing to export, an export is already running, or the app is in
   * demo mode where PDF export needs the local backend.
   */
  readonly pdfDisabled = computed(() => {
    if (this.isDemoMode) {
      return true;
    }
    const content = this.content();
    const templateId = this.templateId();
    return !content || !templateId || isContentEmpty(content);
  });

  /**
   * Explicit draft → saved promotion. Content autosaves never do this; the
   * resume leaves the Drafts list only when the user clicks "Save resume".
   */
  saveResume(): void {
    if (this.savingResume()) {
      return;
    }
    this.savingResume.set(true);
    this.store.saveResume().subscribe({
      next: () => this.savingResume.set(false),
      error: () => this.savingResume.set(false),
    });
  }

  private readonly paramSub = this.route.paramMap.subscribe((params) => {
    const versionId = params.get('versionId');
    if (versionId) {
      this.store.load(versionId);
    }
  });

  updateContacts(contacts: ResumeContent['contacts']): void {
    this.store.patchContent((c) => ({ ...c, contacts }));
  }

  updateSummary(summary: string): void {
    this.store.patchContent((c) => ({ ...c, summary }));
  }

  updateSkills(skills: string[]): void {
    this.store.patchContent((c) => ({ ...c, skills }));
  }

  updateExperiences(experiences: ResumeContent['experiences']): void {
    this.store.patchContent((c) => ({ ...c, experiences }));
  }

  updateProjects(projects: ResumeContent['projects']): void {
    this.store.patchContent((c) => ({ ...c, projects }));
  }

  updateEducation(education: ResumeContent['education']): void {
    this.store.patchContent((c) => ({ ...c, education }));
  }

  updateCertifications(certifications: ResumeContent['certifications']): void {
    this.store.patchContent((c) => ({ ...c, certifications }));
  }

  updateAwards(awards: ResumeContent['awards']): void {
    this.store.patchContent((c) => ({ ...c, awards }));
  }

  goBack(): void {
    this.router.navigate(['/resumes']);
  }

  /**
   * Scrolls the relevant editor form section into view and focuses its first
   * field, based on the ATS finding the user chose to act on. When a section
   * has no text field yet (e.g. an empty experience list) the first action
   * button — such as "Add experience" — is focused instead. On mobile the
   * form pane is opened first so the target is actually visible.
   */
  focusFinding(finding: AtsFinding): void {
    this.mobilePane.set('edit');
    const sectionId =
      SECTION_IDS.get(finding.category) ??
      SECTION_IDS.get(finding.section) ??
      'editor-section-contact';
    requestAnimationFrame(() => {
      const section = document.getElementById(sectionId);
      if (!section) {
        return;
      }
      const firstField =
        section.querySelector<HTMLElement>('input, textarea, select') ??
        section.querySelector<HTMLElement>('button');
      section.scrollIntoView({ block: 'start', behavior: 'auto' });
      firstField?.focus({ preventScroll: true });
    });
  }

  /**
   * Exports the current in-memory version content as an A4 PDF through the
   * backend export service, preserving the selected template and theme. Flushes
   * pending autosaves first so the saved version matches what is exported.
   */
  async downloadPdf(): Promise<void> {
    // The disabled control is the primary UI guard. Keep this method-level
    // guard as well so keyboard/programmatic invocation can never reach a PDF
    // repository or issue a request in standalone Demo mode.
    if (this.isDemoMode || this.pdfState() === 'generating') {
      return;
    }
    const version = this.store.version();
    const templateId = this.templateId();
    const content = this.content();
    const exportContent = content ? normalizeResumeContent(content) : null;
    if (!version || !exportContent || !templateId || isContentEmpty(exportContent)) {
      this.pdfState.set('error');
      this.pdfRetryable.set(false);
      this.pdfMessage.set('Add resume content before downloading your PDF.');
      return;
    }

    this.clearPdfSuccessTimer();
    this.pdfState.set('generating');
    this.pdfMessage.set('');
    this.pdfRetryable.set(false);
    this.store.flush();
    await this.store.waitForIdle();
    if (this.store.saveState() === 'failed') {
      this.pdfState.set('error');
      this.pdfRetryable.set(true);
      this.pdfMessage.set('Save failed. Retry saving before downloading your PDF.');
      return;
    }

    const filename = buildPdfFilename(this.session.user()?.name, version.name);
    try {
      const result = await this.pdfRepo.exportPdf(version.id, {
        templateDefinitionId: templateId,
        content: exportContent,
        filename,
      });
      await this.downloadBlob(result.blob, result.filename);
      this.pdfState.set('success');
      this.pdfMessage.set(`Downloaded ${result.filename}`);
      this.pdfSuccessTimer = setTimeout(() => {
        this.pdfState.set('idle');
        this.pdfMessage.set('');
      }, 4000);
      await this.router.navigate(['/job-matcher'], {
        queryParams: { resumeId: version.resumeId, versionId: version.id },
      });
    } catch (err) {
      this.pdfState.set('error');
      this.pdfRetryable.set(false);
      if (err instanceof ApiError) {
        switch (err.status) {
          case 400:
            this.pdfMessage.set('The template markup is not supported.');
            break;
          case 401:
            this.pdfMessage.set('Your session has expired. Sign in again to generate the PDF.');
            break;
          case 403:
          case 404:
            this.pdfMessage.set('Could not generate the PDF. Please try again.');
            break;
          case 409:
            this.pdfMessage.set('This version cannot be exported. It may be published.');
            break;
          case 503:
            this.pdfRetryable.set(true);
            this.pdfMessage.set('PDF service temporarily unavailable. Please try again later.');
            break;
          case 429:
          case 500:
            this.pdfRetryable.set(true);
            this.pdfMessage.set('Could not generate the PDF. Please try again.');
            break;
          default:
            this.pdfRetryable.set(true);
            this.pdfMessage.set('Could not generate the PDF. Please try again.');
        }
      } else if (err instanceof Error) {
        this.pdfMessage.set(err.message || 'Could not generate the PDF.');
      } else {
        this.pdfMessage.set('Could not generate the PDF.');
      }
    }
  }

  private async downloadBlob(blob: Blob, filename: string): Promise<void> {
    const signature = new TextDecoder().decode(await blob.slice(0, 5).arrayBuffer());
    if (blob.type !== 'application/pdf' || signature !== '%PDF-') {
      throw new Error('The server response was not a valid PDF.');
    }
    if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
      throw new Error('PDF download could not be started in this browser.');
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    try {
      anchor.click();
    } catch (error) {
      URL.revokeObjectURL(url);
      throw error;
    } finally {
      anchor.remove();
    }
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  private clearPdfSuccessTimer(): void {
    if (this.pdfSuccessTimer) {
      clearTimeout(this.pdfSuccessTimer);
      this.pdfSuccessTimer = null;
    }
  }

  /**
   * Flush pending edits, then open the template gallery in "change" mode for
   * the current version. Applying a template there returns to this editor URL
   * with the resume ID, version ID and content preserved.
   */
  async changeTemplate(): Promise<void> {
    const version = this.store.version();
    if (!version) {
      return;
    }
    this.store.flush();
    await this.store.waitForIdle();
    await this.router.navigate(['/templates'], {
      queryParams: {
        mode: 'change',
        resumeId: version.resumeId,
        versionId: version.id,
        returnUrl: `/resumes/${version.resumeId}/versions/${version.id}/edit`,
      },
    });
  }

  /**
   * Navigation guard hook. Flushes pending debounced edits, waits for any
   * in-flight save, and only warns when a save could not be completed.
   */
  async canDeactivate(): Promise<boolean> {
    const state = this.store.saveState();
    if (state === 'saved') {
      return true;
    }
    this.store.flush();
    await this.store.waitForIdle();
    if (this.store.saveState() === 'saved') {
      return true;
    }
    const leave = window.confirm(
      'Your latest changes could not be saved. Choose OK to leave without them, or Cancel to stay and retry.',
    );
    if (leave) {
      return true;
    }
    this.store.retry();
    return false;
  }

  /**
   * Warns on browser refresh/tab-close only while changes are pending, being
   * saved, or failed. No warning after a successful save.
   */
  @HostListener('window:beforeunload', ['$event'])
  handleBeforeUnload(event: BeforeUnloadEvent): void {
    const state = this.store.saveState();
    if (state === 'unsaved' || state === 'saving' || state === 'failed') {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  ngOnDestroy(): void {
    this.paramSub.unsubscribe();
    this.store.dispose();
    this.clearPdfSuccessTimer();
  }
}

/** Maps ATS finding categories / section labels to editor form anchors. */
const SECTION_IDS = new Map<string, string>([
  ['contact', 'editor-section-contact'],
  ['Contact', 'editor-section-contact'],
  ['summary', 'editor-section-summary'],
  ['Summary', 'editor-section-summary'],
  ['skills', 'editor-section-skills'],
  ['Skills', 'editor-section-skills'],
  ['experience', 'editor-section-experience'],
  ['Work experience', 'editor-section-experience'],
  ['projects', 'editor-section-projects'],
  ['Projects', 'editor-section-projects'],
  ['education', 'editor-section-education'],
  ['Education', 'editor-section-education'],
  ['certifications', 'editor-section-certifications'],
  ['Certifications', 'editor-section-certifications'],
  ['awards', 'editor-section-awards'],
  ['Awards', 'editor-section-awards'],
  ['structure', 'editor-section-summary'],
  ['links', 'editor-section-contact'],
  ['Links', 'editor-section-contact'],
]);
