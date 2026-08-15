import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
  effect,
  inject,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ResumeContent } from '../../core/models/resume.model';
import { TemplateRegistry } from '../../core/templates/template-registry';
import { renderResumeHtml } from '../../core/templates/resume-template-renderer';
import { TemplateDefinition } from '../../core/models/template-definition.model';
import { AppButton } from '../../shared/components/app-button.component';
import { toNativeElement } from '../../shared/utils/dom.util';

const DEFAULT_TEMPLATE_ID = 't-classic-ats-navy';
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

function isContentEmpty(c: ResumeContent | null): boolean {
  if (!c) {
    return true;
  }
  const contacts = c.contacts;
  return !(
    (contacts?.fullName ?? '').trim() ||
    (contacts?.title ?? '').trim() ||
    (contacts?.email ?? '').trim() ||
    (contacts?.phone ?? '').trim() ||
    (contacts?.location ?? '').trim() ||
    (contacts?.linkedinUrl ?? '').trim() ||
    (contacts?.githubUrl ?? '').trim() ||
    (contacts?.portfolioUrl ?? '').trim() ||
    (c.summary ?? '').trim() ||
    c.skills.length ||
    c.experiences.length ||
    c.projects.length ||
    c.education.length ||
    c.certifications.length ||
    c.awards.length ||
    c.achievements.length ||
    c.languages.length ||
    c.customSections.length
  );
}

@Component({
  selector: 'app-resume-preview',
  template: `
    <section class="preview" aria-label="Resume preview">
      <div class="preview__toolbar">
        <span class="preview__zoom text-muted" role="status" aria-live="polite"
          >Zoom: {{ zoomPercent() }}%{{ fitMode() ? ' · Fit' : '' }}</span
        >
        <div class="preview__zoom-controls" role="group" aria-label="Preview zoom">
          <app-button
            variant="ghost"
            ariaLabel="Zoom out"
            (click)="zoomOut()"
            [disabled]="zoom() <= MIN_ZOOM"
            >−</app-button
          >
          <app-button
            variant="ghost"
            ariaLabel="Fit to panel"
            [class.is-active]="fitMode()"
            (click)="fitToPanel()"
            >Fit</app-button
          >
          <app-button variant="ghost" ariaLabel="Reset zoom to 100%" (click)="zoomReset()"
            >100%</app-button
          >
          <app-button
            variant="ghost"
            ariaLabel="Zoom in"
            (click)="zoomIn()"
            [disabled]="zoom() >= MAX_ZOOM"
            >+</app-button
          >
        </div>
      </div>

      <div class="preview__viewport" #viewport>
        @if (empty()) {
          <div class="preview__empty" role="status">
            <div class="preview__empty-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                width="40"
                height="40"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <rect x="6" y="3" width="12" height="18" rx="2" />
                <path d="M9 8h6M9 12h6M9 16h4" />
              </svg>
            </div>
            <h3>Start entering your details</h3>
            <p>Your resume preview appears here as you fill it in.</p>
          </div>
        } @else {
          <div
            class="preview__canvas"
            [style.width.px]="canvasWidth()"
            [style.height.px]="canvasHeight()"
          >
            <iframe
              #frame
              class="preview__iframe"
              [srcdoc]="renderedHtml()"
              title="Resume preview"
              [style.transform]="'scale(' + scale() + ')'"
              [style.height.px]="iframeHeight()"
              sandbox="allow-same-origin allow-scripts"
              loading="lazy"
              (load)="onIframeLoad()"
            ></iframe>
          </div>
        }
      </div>
    </section>
  `,
  styles: `
    .preview {
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
    }
    .preview__toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: var(--space-2);
    }
    .preview__zoom {
      font-size: var(--fs-sm);
      font-weight: 700;
    }
    .preview__zoom-controls {
      display: flex;
      gap: var(--space-1);
      :host ::ng-deep app-button.is-active .app-button {
        background: var(--color-primary-soft);
        color: var(--color-primary);
      }
    }
    .preview__viewport {
      background: var(--color-surface-alt);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: var(--space-4);
      overflow: auto;
      max-height: calc(100vh - var(--header-height) - 9rem);
      position: relative;
      box-sizing: border-box;
    }
    .preview__canvas {
      margin: 0 auto;
      position: relative;
    }
    .preview__iframe {
      width: 794px;
      height: 1123px;
      border: none;
      display: block;
      background: #ffffff;
      transform-origin: 0 0;
      transition: transform 0.15s ease;
    }
    .preview__empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: var(--space-2);
      min-height: 400px;
      color: var(--color-text-muted);
      text-align: center;
      padding: var(--space-6);
      h3 {
        margin: 0;
        color: var(--color-text);
        font-size: var(--fs-md);
      }
      p {
        margin: 0;
        font-size: var(--fs-sm);
      }
    }
    .preview__empty-icon {
      color: var(--color-text-muted);
      opacity: 0.6;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppButton],
})
export class ResumePreviewComponent {
  private readonly registry = inject(TemplateRegistry);
  private readonly sanitizer = inject(DomSanitizer);

  readonly content = input<ResumeContent | null>(null);
  readonly templateId = input<string | null>(null);

  readonly viewport = viewChild<HTMLElement>('viewport');
  readonly frame = viewChild<HTMLIFrameElement>('frame');

  readonly zoom = signal(1);
  readonly fitMode = signal(true);
  readonly fitScale = signal(1);
  readonly iframeHeight = signal(A4_HEIGHT_PX);
  readonly MIN_ZOOM = 0.6;
  readonly MAX_ZOOM = 1.4;
  readonly ZOOM_STEP = 0.1;

  readonly scale = computed(() => {
    if (this.fitMode() && this.fitScale() > 0) {
      return this.fitScale();
    }
    return this.zoom();
  });

  readonly zoomPercent = computed(() => Math.round(this.scale() * 100));
  readonly canvasWidth = computed(() => A4_WIDTH_PX * this.scale());
  readonly canvasHeight = computed(() => this.iframeHeight() * this.scale());

  readonly empty = computed(() => isContentEmpty(this.content()));

  readonly renderedHtml = computed<SafeHtml>(() => {
    const c = this.content();
    if (!c || isContentEmpty(c)) {
      return '';
    }
    const id = this.templateId() ?? DEFAULT_TEMPLATE_ID;
    const def: TemplateDefinition = this.registry.get(id);
    return this.sanitizer.bypassSecurityTrustHtml(renderResumeHtml(c, def));
  });

  constructor() {
    effect(() => {
      const el = toNativeElement(this.viewport());
      if (!el || typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver(() => this.measureFit(el));
      observer.observe(el);
      this.measureFit(el);
      return () => observer.disconnect();
    });
    effect(() => {
      this.renderedHtml();
      this.scrollToTop();
    });
  }

  zoomIn(): void {
    this.fitMode.set(false);
    this.zoom.update((z) => Math.min(this.MAX_ZOOM, Math.round((z + this.ZOOM_STEP) * 10) / 10));
  }

  zoomOut(): void {
    this.fitMode.set(false);
    this.zoom.update((z) => Math.max(this.MIN_ZOOM, Math.round((z - this.ZOOM_STEP) * 10) / 10));
  }

  zoomReset(): void {
    this.fitMode.set(false);
    this.zoom.set(1);
  }

  fitToPanel(): void {
    this.fitMode.set(true);
    this.scrollToTop();
  }

  onIframeLoad(): void {
    const win = this.frame()?.contentWindow;
    const doc = win?.document;
    if (!doc) {
      return;
    }
    const htmlH = doc.documentElement?.scrollHeight ?? 0;
    const bodyH = doc.body?.scrollHeight ?? 0;
    const h = Math.max(htmlH, bodyH);
    if (h > 0) {
      this.iframeHeight.set(h);
    }
  }

  private measureFit(el: HTMLElement): void {
    const style = window.getComputedStyle(el);
    const paddingX = parseFloat(style.paddingLeft || '0') + parseFloat(style.paddingRight || '0');
    const available = el.clientWidth - paddingX;
    if (available > 0) {
      this.fitScale.set(Math.min(1.5, Math.max(0.2, available / A4_WIDTH_PX)));
    }
  }

  private scrollToTop(): void {
    const el = toNativeElement(this.viewport());
    if (el) {
      el.scrollTop = 0;
      el.scrollLeft = 0;
    }
  }
}
