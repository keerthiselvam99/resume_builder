import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { ApiError } from '../../core/repositories/http/api-client';
import { ANALYSIS_REPOSITORY } from '../../core/repositories/repository.providers';
import { AtsAnalysis, AtsFinding, FindingSeverity } from '../../core/models/ats.model';
import { ResumeContent } from '../../core/models/resume.model';
import { AppButton } from '../../shared/components/app-button.component';

type PanelStatus = 'idle' | 'loading' | 'success' | 'error';

const SEVERITY_LABEL: Record<FindingSeverity, string> = {
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
};

const SEVERITY_RANK: Record<FindingSeverity, number> = {
  error: 0,
  warning: 1,
  info: 2,
};

@Component({
  selector: 'app-ats-analysis-panel',
  template: `
    <aside class="ats-panel" aria-label="ATS analysis">
      <div class="ats-panel__header">
        <h2>ATS analysis</h2>
        <span class="ats-panel__version">{{ rulesetVersion() }}</span>
      </div>

      @if (status() === 'loading') {
        <p class="ats-panel__state" role="status">Analysing your resume…</p>
      } @else if (status() === 'error') {
        <div class="ats-panel__error" role="alert">
          <p class="ats-panel__error-title">Could not run the ATS check.</p>
          <p class="ats-panel__error-detail">{{ errorMessage() }}</p>
        </div>
      } @else if (analysis(); as result) {
        @if (stale()) {
          <p class="ats-panel__stale" role="status">
            Content changed since this analysis — run it again for fresh results.
          </p>
        }

        <section class="ats-panel__overall" aria-label="Overall ATS score">
          <div
            class="ats-score ats-score--{{ scoreBand(result.overallScore) }}"
            role="progressbar"
            aria-valuemin="0"
            aria-valuemax="100"
            [attr.aria-valuenow]="result.overallScore"
            [attr.aria-label]="'Overall ATS score: ' + result.overallScore + ' out of 100'"
          >
            <span class="ats-score__value">{{ result.overallScore }}</span>
            <span class="ats-score__unit">/ 100</span>
          </div>
          <p class="ats-panel__summary" role="status">
            {{ result.summary.errors }} error{{ result.summary.errors === 1 ? '' : 's' }},
            {{ result.summary.warnings }} warning{{ result.summary.warnings === 1 ? '' : 's' }},
            {{ result.summary.info }} info
          </p>
        </section>

        <section class="ats-panel__block" aria-label="Category scores">
          <h3>Category scores</h3>
          <ul class="ats-panel__categories">
            @for (category of result.categories; track category.key) {
              <li class="ats-category">
                <div class="ats-category__row">
                  <span class="ats-category__label">{{ category.label }}</span>
                  <span class="ats-category__value">{{ category.score }}%</span>
                </div>
                <div
                  class="ats-category__bar"
                  role="progressbar"
                  aria-valuemin="0"
                  aria-valuemax="100"
                  [attr.aria-valuenow]="category.score"
                  [attr.aria-label]="category.label + ' score: ' + category.score + ' percent'"
                >
                  <span class="ats-category__fill" [style.width.%]="category.score"></span>
                </div>
              </li>
            }
          </ul>
        </section>

        <section class="ats-panel__block" aria-label="Findings">
          <h3>Findings</h3>
          @if (sortedFindings().length === 0) {
            <p class="ats-panel__clean">No issues found — this version looks great.</p>
          } @else {
            <ol class="ats-panel__findings">
              @for (finding of sortedFindings(); track finding.code) {
                <li class="ats-finding ats-finding--{{ finding.severity }}">
                  <span class="ats-finding__severity">{{ severityLabel(finding.severity) }}</span>
                  <div class="ats-finding__body">
                    <p class="ats-finding__message">{{ finding.message }}</p>
                    <p class="ats-finding__suggestion">{{ finding.suggestion }}</p>
                  </div>
                </li>
              }
            </ol>
          }
        </section>
      } @else {
        <p class="ats-panel__state">
          Run the ATS check to see how this version scores against parsing-friendly resume rules.
        </p>
      }

      <div class="ats-panel__actions">
        @if (improveTarget(); as target) {
          <app-button
            variant="ghost"
            ariaLabel="Focus first issue"
            (click)="improveRequested.emit(target)"
            >Focus first issue</app-button
          >
        }
        <app-button
          variant="secondary"
          [loading]="status() === 'loading'"
          [disabled]="status() === 'loading' || !versionId()"
          (click)="runAnalysis()"
          >Run analysis</app-button
        >
      </div>
    </aside>
  `,
  styles: `
    .ats-panel {
      display: flex;
      flex-direction: column;
      gap: var(--space-4);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: var(--space-4);
    }
    .ats-panel__header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: var(--space-2);
      h2 {
        margin: 0;
        font-size: var(--fs-md);
      }
    }
    .ats-panel__version {
      font-size: var(--fs-xs);
      color: var(--color-text-muted);
      font-weight: 700;
    }
    .ats-panel__state {
      margin: 0;
      color: var(--color-text-muted);
      font-size: var(--fs-sm);
    }
    .ats-panel__error {
      border: 1px solid var(--color-danger);
      background: var(--color-danger-bg);
      border-radius: var(--radius-md);
      padding: var(--space-3);
      &-title {
        margin: 0;
        font-weight: 700;
        color: var(--color-danger);
      }
      &-detail {
        margin: 0;
        font-size: var(--fs-sm);
        color: var(--color-text);
      }
    }
    .ats-panel__stale {
      margin: 0;
      padding: var(--space-2) var(--space-3);
      border: 1px dashed var(--color-warning);
      color: var(--color-warning-emphasis);
      background: var(--color-warning-bg);
      border-radius: var(--radius-md);
      font-size: var(--fs-sm);
      font-weight: 600;
    }
    .ats-panel__overall {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-2);
      text-align: center;
    }
    .ats-score {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 7rem;
      height: 7rem;
      border-radius: 50%;
      border: 4px solid currentColor;
      &--good {
        color: var(--color-success);
      }
      &--ok {
        color: var(--color-warning-emphasis);
      }
      &--poor {
        color: var(--color-danger);
      }
      &__value {
        font-size: var(--fs-2xl);
        font-weight: 800;
        line-height: 1;
      }
      &__unit {
        font-size: var(--fs-xs);
        color: var(--color-text-muted);
      }
    }
    .ats-panel__summary {
      margin: 0;
      font-size: var(--fs-sm);
      color: var(--color-text-muted);
    }
    .ats-panel__block {
      h3 {
        margin: 0 0 var(--space-2);
        font-size: var(--fs-sm);
        text-transform: uppercase;
        letter-spacing: 0.04em;
        color: var(--color-text-muted);
      }
    }
    .ats-panel__categories {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .ats-category__row {
      display: flex;
      justify-content: space-between;
      gap: var(--space-2);
      font-size: var(--fs-sm);
    }
    .ats-category__label {
      font-weight: 600;
    }
    .ats-category__value {
      color: var(--color-text-muted);
      font-variant-numeric: tabular-nums;
    }
    .ats-category__bar {
      height: 0.5rem;
      background: var(--color-surface-alt);
      border-radius: 999px;
      overflow: hidden;
    }
    .ats-category__fill {
      display: block;
      height: 100%;
      background: var(--color-primary);
      border-radius: 999px;
    }
    .ats-panel__findings {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: var(--space-2);
    }
    .ats-finding {
      display: flex;
      gap: var(--space-3);
      padding: var(--space-3);
      border: 1px solid var(--color-border);
      border-left-width: 4px;
      border-radius: var(--radius-md);
      background: var(--color-surface-alt);
      &--error {
        border-left-color: var(--color-danger);
      }
      &--warning {
        border-left-color: var(--color-warning-emphasis);
      }
      &--info {
        border-left-color: var(--color-primary);
      }
      &__severity {
        flex: none;
        font-size: var(--fs-xs);
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: 0.15rem 0.5rem;
        border-radius: 999px;
        align-self: flex-start;
        background: var(--color-surface);
        color: var(--color-text-muted);
      }
      &--error .ats-finding__severity {
        color: var(--color-danger);
      }
      &--warning .ats-finding__severity {
        color: var(--color-warning-emphasis);
      }
      &--info .ats-finding__severity {
        color: var(--color-primary);
      }
      &__message {
        margin: 0;
        font-weight: 600;
        font-size: var(--fs-sm);
      }
      &__suggestion {
        margin: 0.2rem 0 0;
        font-size: var(--fs-sm);
        color: var(--color-text-muted);
      }
    }
    .ats-panel__clean {
      margin: 0;
      color: var(--color-success);
      font-weight: 600;
      font-size: var(--fs-sm);
    }
    .ats-panel__actions {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppButton],
})
export class AtsAnalysisPanelComponent {
  private readonly repo = inject(ANALYSIS_REPOSITORY);

  readonly versionId = input.required<string>();
  readonly templateId = input.required<string>();
  readonly content = input.required<ResumeContent>();
  /** Flushes editor autosave before the repository analyses its saved version. */
  readonly prepareAnalysis = input<(() => Promise<void>) | null>(null);

  /**
   * Emitted when the user clicks "Focus first issue". Carries the highest-priority
   * finding so the editor can scroll to and focus the relevant form section.
   */
  readonly improveRequested = output<AtsFinding>();

  readonly status = signal<PanelStatus>('idle');
  readonly analysis = signal<AtsAnalysis | null>(null);
  readonly errorMessage = signal('');
  readonly stale = signal(false);

  private analyzedSignature: string | null = null;
  private loadedVersionId: string | null = null;

  readonly sortedFindings = computed<AtsFinding[]>(() => {
    const findings = this.analysis()?.findings ?? [];
    return [...findings].sort(
      (a, b) =>
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.pointsLost - a.pointsLost,
    );
  });

  /**
   * Highest-priority finding to act on. Only surfaced while a result with room
   * to improve (score < 80) is shown, so a clean resume stays clean.
   */
  readonly improveTarget = computed<AtsFinding | null>(() => {
    const result = this.analysis();
    if (!result || result.overallScore >= 80) {
      return null;
    }
    return this.sortedFindings()[0] ?? null;
  });

  constructor() {
    effect(() => {
      const versionId = this.versionId();
      const content = this.content();
      const templateId = this.templateId();
      if (versionId !== this.loadedVersionId) {
        this.loadedVersionId = versionId;
        const cached = this.readCachedAnalysis(versionId);
        this.analysis.set(cached?.analysis ?? null);
        this.status.set(cached ? 'success' : 'idle');
        this.analyzedSignature = cached?.signature ?? null;
        this.stale.set(cached !== null && cached.signature !== this.signature(content, templateId));
        this.errorMessage.set('');
        return;
      }
      if (
        this.analyzedSignature !== null &&
        this.signature(content, templateId) !== this.analyzedSignature
      ) {
        this.stale.set(true);
      }
    });
  }

  rulesetVersion(): string {
    return this.analysis()?.rulesetVersion ?? 'ATS rules v1';
  }

  runAnalysis(): void {
    if (this.status() === 'loading') {
      return;
    }
    this.status.set('loading');
    this.errorMessage.set('');
    const prepare = this.prepareAnalysis();
    if (prepare) {
      void prepare().then(
        () => this.requestAnalysis(),
        (err: unknown) => {
          this.status.set('error');
          this.errorMessage.set(describeError(err));
        },
      );
      return;
    }
    this.requestAnalysis();
  }

  private requestAnalysis(): void {
    this.repo.runAtsAnalysis(this.versionId()).subscribe({
      next: (result) => {
        this.analysis.set(result);
        this.analyzedSignature = this.signature(this.content(), this.templateId());
        this.cacheAnalysis(result, this.analyzedSignature);
        this.stale.set(false);
        this.status.set('success');
      },
      error: (err) => {
        this.status.set('error');
        this.errorMessage.set(describeError(err));
      },
    });
  }

  private cacheAnalysis(analysis: AtsAnalysis, signature: string): void {
    if (typeof sessionStorage === 'undefined') return;
    sessionStorage.setItem(
      `resumeiq_ats_${this.versionId()}`,
      JSON.stringify({ analysis, signature }),
    );
  }

  private readCachedAnalysis(
    versionId: string,
  ): { analysis: AtsAnalysis; signature: string } | null {
    if (typeof sessionStorage === 'undefined') return null;
    const raw = sessionStorage.getItem(`resumeiq_ats_${versionId}`);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as { analysis: AtsAnalysis; signature: string };
    } catch {
      sessionStorage.removeItem(`resumeiq_ats_${versionId}`);
      return null;
    }
  }

  severityLabel(severity: FindingSeverity): string {
    return SEVERITY_LABEL[severity];
  }

  scoreBand(score: number): 'good' | 'ok' | 'poor' {
    if (score >= 80) {
      return 'good';
    }
    if (score >= 60) {
      return 'ok';
    }
    return 'poor';
  }

  private signature(content: ResumeContent, templateId: string): string {
    return `${templateId}|${JSON.stringify(content)}`;
  }
}

function describeError(err: unknown): string {
  if (err instanceof ApiError && err.status === 401) {
    return 'Your session has expired. Sign in again to run the analysis.';
  }
  return err instanceof Error ? err.message : 'Something went wrong. Try again.';
}
