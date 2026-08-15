import { Component, computed, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ResumeContent } from '../models/resume.model';
import { TemplateDefinition } from '../models/template-definition.model';
import { renderResumeHtml } from './resume-template-renderer';

@Component({
  selector: 'app-template-renderer',
  template: `<iframe
    [srcdoc]="renderedHtml()"
    title="Resume preview"
    sandbox="allow-same-origin"
    class="renderer-frame"
  ></iframe>`,
  styles: `
    .renderer-frame {
      width: 100%;
      height: 600px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
    }
  `,
  standalone: true,
})
export class TemplateRendererComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly content = input<ResumeContent>();
  readonly definition = input<TemplateDefinition>();

  readonly renderedHtml = computed<SafeHtml>(() => {
    const def = this.definition();
    const content = this.content();
    if (!def || !content) {
      return '';
    }
    return this.sanitizer.bypassSecurityTrustHtml(renderResumeHtml(content, def));
  });
}
