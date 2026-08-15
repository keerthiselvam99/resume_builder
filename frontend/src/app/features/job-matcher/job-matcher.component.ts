import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { JobMatchRequest, JobMatchResult } from '../../core/models/job-match.model';
import { Resume, ResumeVersion } from '../../core/models/resume.model';
import { ApiError } from '../../core/repositories/http/api-client';
import {
  JOB_MATCH_REPOSITORY,
  RESUME_REPOSITORY,
} from '../../core/repositories/repository.providers';

interface StoredState {
  request: JobMatchRequest;
  resumeId: string;
  versionId: string;
  versionUpdatedAt: string;
  result: JobMatchResult;
}
const STORAGE_KEY = 'resumeiq_job_match_state';

@Component({
  selector: 'app-job-matcher',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="matcher container">
      <header class="intro">
        <div>
          <p class="eyebrow">Deterministic analysis</p>
          <h1>Job Matcher</h1>
        </div>
        <p>
          Compare a saved resume version with a job description. ResumeIQ never changes your resume
          automatically.
        </p>
      </header>

      @if (loadingResumes()) {
        <div class="notice" role="status">Loading your resumes…</div>
      } @else if (resumes().length === 0) {
        <div class="notice">
          <h2>No resumes available</h2>
          <p>Create a resume before running a match.</p>
        </div>
      } @else {
        <form class="panel form" [formGroup]="form" (ngSubmit)="analyse()" novalidate>
          <div class="field-grid">
            <label
              >Resume
              <select formControlName="resumeId" (change)="resumeChanged()">
                @for (resume of resumes(); track resume.id) {
                  <option [value]="resume.id">
                    {{ resume.name
                    }}{{
                      resume.status === 'draft' ? ' — Draft' : resume.primary ? ' — Primary' : ''
                    }}
                  </option>
                }
              </select></label
            >
            <label
              >Version
              <select formControlName="versionId" (change)="selectionChanged()">
                @for (version of versions(); track version.id) {
                  <option [value]="version.id">
                    {{ version.name }}{{ version.isMaster ? ' — Master' : '' }}
                  </option>
                }
              </select></label
            >
          </div>
          <div class="field-grid">
            <label
              >Job title
              <input
                formControlName="jobTitle"
                maxlength="120"
                autocomplete="off"
                (input)="inputChanged()"
              />
              <span class="count">{{ form.controls.jobTitle.value.length }}/120</span>
              @if (showError('jobTitle')) {
                <span class="error">Enter 2–120 characters.</span>
              }
            </label>
            <label
              >Company
              <input
                formControlName="company"
                maxlength="120"
                autocomplete="organization"
                (input)="inputChanged()"
              />
              <span class="count">{{ form.controls.company.value.length }}/120</span>
            </label>
          </div>
          <label
            >Job description
            <textarea
              formControlName="jobDescription"
              rows="10"
              maxlength="15000"
              (input)="inputChanged()"
              aria-describedby="description-help description-count"
            ></textarea>
            <span id="description-help" class="help"
              >Paste plain text (200–15,000 characters). HTML is treated only as text.</span
            >
            <span id="description-count" class="count"
              >{{ form.controls.jobDescription.value.length }}/15,000</span
            >
            @if (showError('jobDescription')) {
              <span class="error">Enter 200–15,000 characters.</span>
            }
          </label>
          <div class="actions">
            <button class="primary" type="submit" [disabled]="analysing()">
              {{ analysing() ? 'Analysing…' : result() ? 'Run again' : 'Analyse match' }}
            </button>
            @if (result()) {
              <button type="button" (click)="changeResume()">Change resume</button>
            }
          </div>
        </form>

        @if (analysing()) {
          <div class="notice" role="status" aria-live="polite">
            Analysing the saved resume against this job…
          </div>
        }
        @if (errorMessage()) {
          <div class="notice error-box" role="alert">{{ errorMessage() }}</div>
        }
        @if (stale() && result()) {
          <div class="notice stale" role="status">
            <strong>Result is stale.</strong> The resume, version, or job input changed. Run the
            analysis again for current results.
          </div>
        }

        @if (result(); as match) {
          <section class="results" aria-labelledby="result-title">
            <div class="score-card panel">
              <div>
                <p class="eyebrow">Overall match</p>
                <h2 id="result-title">{{ match.overallScore }}<span>/100</span></h2>
              </div>
              <div
                class="progress"
                role="progressbar"
                aria-label="Overall match score"
                aria-valuemin="0"
                aria-valuemax="100"
                [attr.aria-valuenow]="match.overallScore"
              >
                <span [style.width.%]="match.overallScore"></span>
              </div>
              <p>
                {{
                  match.overallScore === 0
                    ? 'No supported matches found.'
                    : 'Based only on evidence present in the selected saved version.'
                }}
              </p>
            </div>
            <div class="panel">
              <h2>Category scores</h2>
              <div class="categories">
                @for (category of match.categories; track category.key) {
                  <div class="category">
                    <div>
                      <strong>{{ category.label }}</strong
                      ><span>{{ category.score }}% · weight {{ category.weight }}</span>
                    </div>
                    <div
                      class="progress small"
                      role="progressbar"
                      [attr.aria-label]="category.label"
                      aria-valuemin="0"
                      aria-valuemax="100"
                      [attr.aria-valuenow]="category.score"
                    >
                      <span [style.width.%]="category.score"></span>
                    </div>
                  </div>
                }
              </div>
            </div>
            <div class="result-grid">
              <section class="panel">
                <h2>Matched requirements</h2>
                @if (!match.matchedKeywords.length) {
                  <p>No matches were found.</p>
                }
                @for (item of match.matchedKeywords; track item.keyword) {
                  <article class="requirement">
                    <h3>
                      {{ item.keyword }} <span class="badge">{{ item.priority }}</span>
                    </h3>
                    @for (evidence of item.evidence; track evidence.section + evidence.excerpt) {
                      <p>
                        <strong>{{ evidence.section }}:</strong> {{ evidence.excerpt }}
                      </p>
                    }
                  </article>
                }
              </section>
              <section class="panel">
                <h2>Missing requirements</h2>
                @if (!match.missingKeywords.length) {
                  <p>No extracted requirements are missing.</p>
                }
                <ul>
                  @for (item of match.missingKeywords; track item.keyword) {
                    <li>
                      <strong>{{ item.keyword }}</strong>
                      <span class="badge">{{ item.priority }}</span>
                    </li>
                  }
                </ul>
              </section>
            </div>
            <section class="panel">
              <h2>Prioritized suggestions</h2>
              <ol>
                @for (suggestion of match.suggestions; track suggestion) {
                  <li>{{ suggestion }}</li>
                }
              </ol>
            </section>
            <footer class="panel meta">
              <div>
                <strong>Selected:</strong> {{ selectedResume()?.name }} /
                {{ selectedVersion()?.name }}
              </div>
              <div><strong>Ruleset:</strong> {{ match.rulesetVersion }}</div>
              <button class="primary" type="button" (click)="editResume()">
                Edit selected resume
              </button>
            </footer>
          </section>
        }
      }
    </div>
  `,
  styles: `
    .matcher {
      padding-block: var(--space-8) var(--space-12);
      max-width: 1120px;
    }
    .intro {
      display: flex;
      justify-content: space-between;
      gap: var(--space-8);
      align-items: end;
      margin-bottom: var(--space-6);
    }
    .intro > p {
      max-width: 620px;
    }
    .eyebrow {
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: var(--fs-xs);
      font-weight: 800;
      color: var(--color-primary);
      margin: 0;
    }
    .panel,
    .notice {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: var(--space-5);
      box-shadow: var(--shadow-sm);
    }
    .form {
      display: grid;
      gap: var(--space-5);
    }
    .field-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-4);
    }
    label {
      display: grid;
      gap: var(--space-2);
      font-weight: 700;
    }
    input,
    select,
    textarea {
      width: 100%;
      font: inherit;
      color: var(--color-text);
      background: var(--color-surface);
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-md);
      padding: 0.75rem;
    }
    textarea {
      resize: vertical;
      min-height: 180px;
    }
    input:focus-visible,
    select:focus-visible,
    textarea:focus-visible,
    button:focus-visible {
      outline: 3px solid var(--color-accent);
      outline-offset: 2px;
    }
    .count,
    .help {
      font-size: var(--fs-xs);
      font-weight: 400;
      color: var(--color-text-muted);
    }
    .count {
      text-align: right;
    }
    .error {
      color: var(--color-danger);
      font-size: var(--fs-sm);
    }
    button {
      border: 1px solid var(--color-border-strong);
      border-radius: var(--radius-md);
      padding: 0.7rem 1rem;
      background: var(--color-surface);
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }
    .primary {
      background: var(--color-primary);
      color: var(--color-text-on-primary);
      border-color: var(--color-primary);
    }
    button:disabled {
      opacity: 0.6;
      cursor: wait;
    }
    .actions {
      display: flex;
      gap: var(--space-3);
      flex-wrap: wrap;
    }
    .notice {
      margin-top: var(--space-4);
    }
    .error-box {
      border-color: var(--color-danger);
      color: var(--color-danger);
    }
    .stale {
      border-color: var(--color-warning-emphasis);
      background: var(--color-warning-bg);
    }
    .results {
      display: grid;
      gap: var(--space-4);
      margin-top: var(--space-6);
    }
    .score-card {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: var(--space-3) var(--space-6);
      align-items: center;
    }
    .score-card h2 {
      font-size: 3rem;
      margin: 0;
    }
    .score-card h2 span {
      font-size: 1rem;
      color: var(--color-text-muted);
    }
    .score-card p {
      grid-column: 2;
    }
    .progress {
      height: 16px;
      background: var(--color-surface-alt);
      border-radius: 99px;
      overflow: hidden;
    }
    .progress span {
      display: block;
      height: 100%;
      background: var(--color-primary);
    }
    .small {
      height: 10px;
    }
    .categories {
      display: grid;
      gap: var(--space-4);
    }
    .category > div:first-child {
      display: flex;
      justify-content: space-between;
      gap: var(--space-3);
      margin-bottom: var(--space-2);
    }
    .result-grid {
      display: grid;
      grid-template-columns: 1.35fr 1fr;
      gap: var(--space-4);
    }
    .requirement {
      border-top: 1px solid var(--color-border);
      padding-top: var(--space-3);
      margin-top: var(--space-3);
    }
    .requirement h3 {
      font-size: var(--fs-md);
    }
    .requirement p {
      overflow-wrap: anywhere;
    }
    .badge {
      display: inline-block;
      border: 1px solid var(--color-border-strong);
      border-radius: 99px;
      padding: 0.1rem 0.45rem;
      font-size: var(--fs-xs);
      font-weight: 600;
    }
    .meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      flex-wrap: wrap;
    }
    li {
      margin-block: 0.5rem;
      overflow-wrap: anywhere;
    }
    @media (max-width: 700px) {
      .intro,
      .field-grid,
      .result-grid {
        display: grid;
        grid-template-columns: 1fr;
      }
      .score-card {
        grid-template-columns: 1fr;
      }
      .score-card p {
        grid-column: 1;
      }
      .category > div:first-child {
        align-items: start;
      }
      .matcher {
        padding-top: var(--space-5);
      }
    }
  `,
})
export class JobMatcherComponent {
  private readonly resumesRepo = inject(RESUME_REPOSITORY);
  private readonly matcherRepo = inject(JOB_MATCH_REPOSITORY);
  private readonly router = inject(Router);
  readonly resumes = signal<Resume[]>([]);
  readonly versions = signal<ResumeVersion[]>([]);
  readonly loadingResumes = signal(true);
  readonly analysing = signal(false);
  readonly submitted = signal(false);
  readonly result = signal<JobMatchResult | null>(null);
  readonly stale = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly form = new FormGroup({
    resumeId: new FormControl('', { nonNullable: true, validators: Validators.required }),
    versionId: new FormControl('', { nonNullable: true, validators: Validators.required }),
    jobTitle: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(120)],
    }),
    company: new FormControl('', { nonNullable: true, validators: Validators.maxLength(120) }),
    jobDescription: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(200), Validators.maxLength(15000)],
    }),
  });
  selectedResume(): Resume | undefined {
    return this.resumes().find((r) => r.id === this.form.controls.resumeId.value);
  }
  selectedVersion(): ResumeVersion | undefined {
    return this.versions().find((v) => v.id === this.form.controls.versionId.value);
  }

  constructor() {
    this.loadResumes();
  }
  private loadResumes(): void {
    this.resumesRepo.list().subscribe({
      next: (items) => {
        this.resumes.set(items);
        const preferred =
          items.find((r) => r.primary && r.status === 'saved') ??
          items.find((r) => r.status === 'saved') ??
          items[0];
        if (preferred) {
          this.form.controls.resumeId.setValue(preferred.id);
          this.loadVersions(preferred.id, true);
        }
        this.loadingResumes.set(false);
      },
      error: () => {
        this.errorMessage.set('Could not load your resumes.');
        this.loadingResumes.set(false);
      },
    });
  }
  resumeChanged(): void {
    this.markStale();
    this.loadVersions(this.form.controls.resumeId.value, false);
  }
  private loadVersions(resumeId: string, restore: boolean): void {
    this.resumesRepo.listVersions(resumeId).subscribe({
      next: (items) => {
        this.versions.set(items);
        const stored = restore ? this.readStored() : null;
        const restoredVersion =
          stored?.resumeId === resumeId ? items.find((v) => v.id === stored.versionId) : undefined;
        const target = restoredVersion ?? items.find((v) => v.isMaster) ?? items[0];
        this.form.controls.versionId.setValue(target?.id ?? '');
        if (
          stored &&
          stored.resumeId === resumeId &&
          stored.versionId === this.form.controls.versionId.value
        ) {
          this.form.patchValue(stored.request);
          this.result.set(stored.result);
          this.stale.set(stored.versionUpdatedAt !== this.selectedVersion()?.updatedAt);
        }
      },
      error: () => this.errorMessage.set('Could not load resume versions.'),
    });
  }
  selectionChanged(): void {
    this.markStale();
  }
  inputChanged(): void {
    if (this.result()) this.stale.set(true);
  }
  private markStale(): void {
    if (this.result()) this.stale.set(true);
  }
  showError(name: 'jobTitle' | 'jobDescription'): boolean {
    const control = this.form.controls[name];
    return control.invalid && (this.submitted() || control.touched);
  }
  analyse(): void {
    this.submitted.set(true);
    this.errorMessage.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const version = this.selectedVersion();
    if (!version) return;
    const request: JobMatchRequest = {
      jobTitle: this.form.controls.jobTitle.value.trim(),
      company: this.form.controls.company.value.trim() || undefined,
      jobDescription: this.form.controls.jobDescription.value.trim(),
    };
    this.analysing.set(true);
    this.matcherRepo.analyze(version.id, request).subscribe({
      next: (result) => {
        this.result.set(result);
        this.stale.set(false);
        this.analysing.set(false);
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            request,
            resumeId: this.form.controls.resumeId.value,
            versionId: version.id,
            versionUpdatedAt: version.updatedAt,
            result,
          } satisfies StoredState),
        );
      },
      error: (error: unknown) => {
        this.analysing.set(false);
        this.errorMessage.set(this.messageFor(error));
      },
    });
  }
  changeResume(): void {
    this.form.controls.resumeId.setValue('');
    this.versions.set([]);
    this.markStale();
    document.querySelector<HTMLSelectElement>('select[formControlName="resumeId"]')?.focus();
  }
  editResume(): void {
    const resume = this.selectedResume(),
      version = this.selectedVersion();
    if (resume && version)
      void this.router.navigate(['/resumes', resume.id, 'versions', version.id, 'edit']);
  }
  private readStored(): StoredState | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as StoredState) : null;
    } catch {
      return null;
    }
  }
  private messageFor(error: unknown): string {
    if (error instanceof ApiError) {
      if (error.status === 401) return 'Your session expired. Log in again to continue.';
      if (error.status === 403 || error.status === 404)
        return 'That resume version is unavailable or you do not have access.';
      if (error.status === 429) return 'Too many analyses. Please wait and try again.';
    }
    return 'The match could not be completed. Please try again.';
  }
}
