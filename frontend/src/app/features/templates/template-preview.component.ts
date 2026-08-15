import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  OnInit,
  computed,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TemplateRegistry } from '../../core/templates/template-registry';
import { LAYOUT_META } from '../../core/templates/template-catalogue';
import { ResumeContent } from '../../core/models/resume.model';
import {
  ColorThemeId,
  LayoutFamilyId,
  TemplateDefinition,
} from '../../core/models/template-definition.model';
import { AppButton } from '../../shared/components/app-button.component';
import { RESUME_REPOSITORY } from '../../core/repositories/repository.providers';
import { PreviewFrameComponent } from '../../shared/components/preview-frame.component';
import { templatePreviewSampleContent } from '../../core/templates/template-preview-content';

const THEMES: { id: ColorThemeId; label: string }[] = [
  { id: ColorThemeId.Navy, label: 'Navy' },
  { id: ColorThemeId.Charcoal, label: 'Charcoal' },
  { id: ColorThemeId.Teal, label: 'Teal' },
  { id: ColorThemeId.Burgundy, label: 'Burgundy' },
];

const ZOOM_PRESETS = [80, 100, 120];

@Component({
  selector: 'app-template-preview',
  template: `
    <div class="container">
      <header class="head">
        <div class="head__left">
          <a
            class="back-link"
            [routerLink]="changeMode() ? (returnUrl() ?? '/resumes') : '/templates'"
          >
            ← {{ changeMode() ? 'Back to editor' : 'Back to gallery' }}
          </a>
          <h1>{{ changeMode() ? 'Change template' : 'Template Preview' }}</h1>
        </div>
        @if (!loading() && !errorMessage()) {
          <div class="head__actions">
            <app-button variant="primary" (click)="primaryAction()" [loading]="working()">
              {{ primaryActionLabel() }}
            </app-button>
            <app-button variant="secondary" (click)="back()">
              {{ changeMode() ? 'Cancel' : 'Back to gallery' }}
            </app-button>
          </div>
        }
      </header>

      @if (loading()) {
        <div class="state" role="status">Loading template…</div>
      } @else if (errorMessage()) {
        <div class="state state--error" role="alert">{{ errorMessage() }}</div>
      } @else {
        <div class="layout">
          <div class="main">
            <app-preview-frame
              #frame
              [content]="sampleContent"
              [templateId]="selectedDefinition()?.id ?? null"
              [title]="frameTitle()"
              mode="fit"
              [fitEnabled]="fitMode()"
              [zoom]="zoom() / 100"
              (scaleChange)="displayScale.set($event)"
            />
          </div>

          <aside class="controls">
            <div class="control-group">
              <h2 class="control-title">Theme</h2>
              <div class="theme-grid">
                @for (theme of themes; track theme.id) {
                  <button
                    type="button"
                    class="theme-chip"
                    [class.theme-chip--active]="selectedTheme() === theme.id"
                    [style.--theme-swatch]="themeColor(theme.id)"
                    [attr.aria-pressed]="selectedTheme() === theme.id"
                    (click)="selectTheme(theme.id)"
                  >
                    <span class="swatch" [style.background]="themeColor(theme.id)"></span>
                    {{ theme.label }}
                  </button>
                }
              </div>
            </div>

            <div class="control-group">
              <h2 class="control-title">Zoom</h2>
              <div class="zoom-presets" role="group" aria-label="Zoom presets">
                <button
                  type="button"
                  class="zoom-preset"
                  [class.zoom-preset--active]="fitMode()"
                  aria-label="Fit width"
                  (click)="setFit()"
                >
                  Fit
                </button>
                @for (preset of zoomPresets; track preset) {
                  <button
                    type="button"
                    class="zoom-preset"
                    [class.zoom-preset--active]="!fitMode() && zoom() === preset"
                    (click)="setZoom(preset)"
                  >
                    {{ preset }}%
                  </button>
                }
              </div>
              <div class="zoom-row" role="group" aria-label="Preview zoom">
                <app-button
                  variant="ghost"
                  ariaLabel="Zoom out"
                  (click)="zoomOut()"
                  [disabled]="zoom() <= MIN_ZOOM"
                  >−</app-button
                >
                <span class="zoom-label">{{ zoomPercent() }}%</span>
                <app-button
                  variant="ghost"
                  ariaLabel="Zoom in"
                  (click)="zoomIn()"
                  [disabled]="zoom() >= MAX_ZOOM"
                  >+</app-button
                >
                <app-button variant="ghost" ariaLabel="Reset view" (click)="resetView()"
                  >Reset</app-button
                >
              </div>
            </div>

            <div class="control-group">
              <h2 class="control-title">Details</h2>
              <dl class="details">
                <dt>Layout</dt>
                <dd>{{ layoutName() }}</dd>
                <dt>Badge</dt>
                <dd>
                  @if (selectedDefinition()?.isAtsFriendly) {
                    <span class="badge badge--ats">ATS-friendly</span>
                  }
                  @if (selectedDefinition()?.isVisual) {
                    <span class="badge badge--visual">Visual</span>
                  }
                </dd>
              </dl>
            </div>
          </aside>
        </div>
      }
    </div>
  `,
  styles: `
    .head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--space-4);
      margin: var(--space-6) 0 var(--space-4);
      flex-wrap: wrap;
    }
    .head__left {
      display: flex;
      flex-direction: column;
      gap: var(--space-1);
      h1 {
        font-size: var(--fs-2xl);
      }
    }
    .head__actions {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      flex-wrap: wrap;
    }
    .back-link {
      color: var(--color-primary);
      text-decoration: none;
      font-weight: 600;
      font-size: var(--fs-sm);
      width: fit-content;
      &:hover {
        text-decoration: underline;
      }
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
      gap: var(--space-6);
      align-items: start;
      min-height: 600px;
    }
    @media (max-width: 900px) {
      .layout {
        grid-template-columns: 1fr;
      }
    }
    .main {
      display: flex;
      justify-content: center;
      width: 100%;
      min-width: 0;
    }
    .controls {
      display: flex;
      flex-direction: column;
      gap: var(--space-5);
    }
    .control-group {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: var(--space-4);
    }
    .control-title {
      font-size: var(--fs-sm);
      font-weight: 600;
      margin: 0 0 var(--space-3);
      color: var(--color-text-muted);
    }
    .theme-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: var(--space-2);
    }
    .theme-chip {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: 0.5rem 0.75rem;
      border: 1.5px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-text);
      font-size: var(--fs-sm);
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      &--active {
        border-color: var(--color-primary);
        background: var(--color-primary-soft);
        color: var(--color-primary);
      }
      .swatch {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        display: inline-block;
      }
    }
    .zoom-presets {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1);
      margin-bottom: var(--space-3);
    }
    .zoom-preset {
      flex: 1;
      min-width: 52px;
      padding: 0.4rem 0.5rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-text);
      font-size: var(--fs-sm);
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s ease;
      &--active {
        border-color: var(--color-primary);
        background: var(--color-primary);
        color: var(--color-text-on-primary);
      }
      &:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 1px;
      }
    }
    .zoom-row {
      display: flex;
      align-items: center;
      gap: var(--space-2);
    }
    .zoom-label {
      font-weight: 700;
      font-size: var(--fs-sm);
      min-width: 52px;
      text-align: center;
    }
    .details {
      dt {
        font-size: var(--fs-xs);
        font-weight: 600;
        color: var(--color-text-muted);
        margin-top: var(--space-2);
      }
      dd {
        margin: 0 0 var(--space-1);
        font-size: var(--fs-sm);
      }
    }
    .badge {
      display: inline-block;
      border-radius: 999px;
      padding: 0.15rem 0.5rem;
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
    .state {
      background: var(--color-surface);
      border: 1px dashed var(--color-border-strong);
      border-radius: var(--radius-lg);
      padding: var(--space-12) var(--space-6);
      text-align: center;
      margin: var(--space-8) 0;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppButton, RouterLink, PreviewFrameComponent],
})
export class TemplatePreviewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly registry = inject(TemplateRegistry);
  private readonly repository = inject(RESUME_REPOSITORY);

  readonly themes = THEMES;
  readonly zoomPresets = ZOOM_PRESETS;
  readonly MIN_ZOOM = 60;
  readonly MAX_ZOOM = 140;
  readonly ZOOM_STEP = 10;

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly working = signal(false);
  readonly zoom = signal(100);
  readonly fitMode = signal(true);
  readonly displayScale = signal(1);
  readonly selectedTheme = signal<ColorThemeId>(ColorThemeId.Navy);

  readonly changeMode = signal(false);
  readonly versionId = signal<string | null>(null);
  readonly returnUrl = signal<string | null>(null);

  private layoutFamily: LayoutFamilyId | null = null;

  readonly selectedDefinition = computed(() => {
    if (!this.layoutFamily) {
      return null;
    }
    return this.registry.getByLayoutAndTheme(this.layoutFamily, this.selectedTheme());
  });

  readonly zoomPercent = computed(() => Math.round(this.displayScale() * 100));

  readonly primaryActionLabel = computed(() =>
    this.changeMode() ? 'Apply this template' : 'Use this template',
  );

  ngOnInit(): void {
    this.loading.set(true);
    try {
      const id = this.route.snapshot.paramMap.get('id');
      if (!id) {
        this.errorMessage.set('No template ID specified.');
        return;
      }
      const query = this.route.snapshot.queryParamMap;
      if (query.get('mode') === 'change' && query.get('versionId')) {
        this.changeMode.set(true);
        this.versionId.set(query.get('versionId'));
        this.returnUrl.set(query.get('returnUrl'));
      }
      const def = this.registry.get(id);
      this.layoutFamily = def.layoutFamily;
      this.selectedTheme.set(def.colorTheme);
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Failed to load template.');
    } finally {
      this.loading.set(false);
    }
  }

  readonly sampleContent: ResumeContent = templatePreviewSampleContent;

  frameTitle(): string {
    return `Preview of ${this.selectedDefinition()?.name ?? 'template'}`;
  }

  themeColor(theme: ColorThemeId): string {
    const def = this.registry.getByLayoutAndTheme(
      this.layoutFamily ?? LayoutFamilyId.ClassicAts,
      theme,
    );
    return def ? defStyle(def) : '#64748a';
  }

  selectTheme(theme: ColorThemeId): void {
    this.selectedTheme.set(theme);
  }

  readonly layoutName = computed(() => {
    const def = this.selectedDefinition();
    if (!def) {
      return '';
    }
    return LAYOUT_META[def.layoutFamily]?.name ?? def.layoutFamily;
  });

  setZoom(preset: number): void {
    this.fitMode.set(false);
    this.zoom.set(preset);
  }

  setFit(): void {
    this.fitMode.set(true);
  }

  zoomIn(): void {
    const base = this.fitMode() ? 100 : this.zoom();
    this.fitMode.set(false);
    this.zoom.set(Math.min(this.MAX_ZOOM, base + this.ZOOM_STEP));
  }

  zoomOut(): void {
    const base = this.fitMode() ? 100 : this.zoom();
    this.fitMode.set(false);
    this.zoom.set(Math.max(this.MIN_ZOOM, base - this.ZOOM_STEP));
  }

  resetView(): void {
    this.fitMode.set(true);
    this.zoom.set(100);
  }

  primaryAction(): void {
    const def = this.selectedDefinition();
    if (!def) {
      return;
    }
    if (this.changeMode()) {
      this.applyTemplate(def);
      return;
    }
    this.working.set(true);
    this.router.navigate(['/resumes/new'], {
      queryParams: { templateId: def.id },
    });
  }

  private applyTemplate(def: TemplateDefinition): void {
    const versionId = this.versionId();
    if (!versionId) {
      return;
    }
    this.working.set(true);
    this.repository.updateTemplate(versionId, def.id).subscribe({
      next: () => {
        this.working.set(false);
        this.router.navigateByUrl(this.returnUrl() ?? '/resumes');
      },
      error: () => {
        this.working.set(false);
        this.errorMessage.set('Could not apply this template. Please try again.');
      },
    });
  }

  back(): void {
    if (this.changeMode()) {
      this.router.navigateByUrl(this.returnUrl() ?? '/resumes');
      return;
    }
    this.router.navigate(['/templates']);
  }
}

function defStyle(def: TemplateDefinition): string {
  const theme = def.colorTheme;
  if (theme === 'navy') return '#0a1c4c';
  if (theme === 'charcoal') return '#94a3b8';
  if (theme === 'teal') return '#0d9488';
  if (theme === 'burgundy') return '#7f1d1d';
  return '#64748a';
}
