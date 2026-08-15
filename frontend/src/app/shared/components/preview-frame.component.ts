import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ResumeContent } from '../../core/models/resume.model';
import { TemplateRegistry } from '../../core/templates/template-registry';
import { renderResumeHtml } from '../../core/templates/resume-template-renderer';
import { toNativeElement } from '../utils/dom.util';

/** A4 portrait document size in preview CSS pixels. */
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

/**
 * Shared A4 resume preview stage used by Template Preview and Create Resume.
 * Both pages render the exact same resume markup through `renderResumeHtml`
 * at A4 portrait dimensions and scale it with the same Fit calculation:
 *
 *   scale = Math.min(availableWidth / A4_WIDTH_PX, availableHeight / A4_HEIGHT_PX)
 *
 * The complete A4 page stays visible inside the light-gray stage without any
 * internal scrollbar, and the white resume surface always keeps its portrait
 * 210:297 ratio. The component is the single source of truth for preview
 * scaling across the two pages.
 */
@Component({
  selector: 'app-preview-frame',
  template: `
    <div class="preview-frame" #stage>
      <div
        class="preview-frame__canvas"
        [style.width.px]="canvasWidth()"
        [style.height.px]="canvasHeight()"
      >
        <iframe
          #frame
          class="preview-frame__iframe"
          [srcdoc]="renderedHtml()"
          [title]="title()"
          [style.width.px]="iframeWidth()"
          [style.height.px]="iframeHeight()"
          [style.transform]="'scale(' + scale() + ')'"
          sandbox="allow-same-origin allow-scripts"
          loading="lazy"
          (load)="onIframeLoad()"
        ></iframe>
      </div>
    </div>
  `,
  styles: `
    .preview-frame {
      position: relative;
      background: var(--color-surface-alt);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      box-sizing: border-box;
      overflow: auto;
      max-height: calc(100vh - var(--header-height) - var(--space-8));
      width: 100%;
    }
    .preview-frame__canvas {
      margin: 0 auto;
      position: relative;
      flex-shrink: 0;
    }
    .preview-frame__iframe {
      width: 794px;
      height: 1123px;
      border: 0;
      display: block;
      background: #ffffff;
      transform-origin: 0 0;
      transition: transform 0.15s ease;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
})
export class PreviewFrameComponent {
  private readonly registry = inject(TemplateRegistry);
  private readonly sanitizer = inject(DomSanitizer);

  readonly content = input<ResumeContent | null>(null);
  readonly templateId = input<string | null>(null);
  readonly title = input('Resume preview');
  readonly fitEnabled = input(true);
  readonly zoom = input(1);

  readonly scaleChange = output<number>();

  readonly stage = viewChild<HTMLElement>('stage');
  readonly frame = viewChild<HTMLIFrameElement>('frame');

  readonly fitScale = signal(1);
  readonly iframeHeight = signal(A4_HEIGHT_PX);

  readonly iframeWidth = computed(() => A4_WIDTH_PX);

  readonly scale = computed(() => {
    if (this.fitEnabled() && this.fitScale() > 0) {
      return this.fitScale();
    }
    return this.zoom();
  });

  readonly canvasWidth = computed(() => this.iframeWidth() * this.scale());
  readonly canvasHeight = computed(() => this.iframeHeight() * this.scale());

  readonly renderedHtml = computed<SafeHtml>(() => {
    const c = this.content();
    if (!c) {
      return '';
    }
    const id = this.templateId() ?? 't-classic-ats-navy';
    const def = this.registry.get(id);
    return this.sanitizer.bypassSecurityTrustHtml(renderResumeHtml(c, def, {}));
  });

  constructor() {
    effect(() => {
      const el = toNativeElement(this.stage());
      if (!el || typeof ResizeObserver === 'undefined') {
        return;
      }
      const observer = new ResizeObserver(() => this.measure(el));
      observer.observe(el);
      this.measure(el);
      return () => observer.disconnect();
    });
    effect(() => {
      this.renderedHtml();
      this.scrollToTop();
    });
    effect(() => {
      this.scaleChange.emit(this.scale());
    });
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
      const el = toNativeElement(this.stage());
      if (el) {
        this.measure(el);
      }
    }
  }

  private measure(el: HTMLElement): void {
    const style = window.getComputedStyle(el);
    const paddingX = parseFloat(style.paddingLeft || '0') + parseFloat(style.paddingRight || '0');
    const paddingY = parseFloat(style.paddingTop || '0') + parseFloat(style.paddingBottom || '0');
    const availableWidth = el.clientWidth - paddingX;
    const availableHeight = el.clientHeight - paddingY;
    const contentHeight = this.iframeHeight();
    if (availableWidth > 0 && contentHeight > 0) {
      const widthScale = availableWidth / A4_WIDTH_PX;
      const heightScale = availableHeight / contentHeight;
      const scale = Math.min(2, Math.max(0.2, Math.min(widthScale, heightScale)));
      this.fitScale.set(scale);
    }
  }

  private scrollToTop(): void {
    const el = toNativeElement(this.stage());
    if (el) {
      el.scrollTop = 0;
      el.scrollLeft = 0;
    }
  }
}
