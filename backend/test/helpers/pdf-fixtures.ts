import { PdfPaginationReport } from '../../src/services/pdf/pdf-export.service';

export interface ResumeHtmlOptions {
  pageCount?: number;
  report?: Partial<Omit<PdfPaginationReport, 'pageCount'>>;
  unsafeLinks?: string;
  extraBody?: string;
}

/**
 * Builds a minimal self-contained resume document that mirrors the structure
 * the frontend renderer produces: stacked A4 `.resume-page` elements plus a
 * script that reports `window.__paginationReport`. Lets the backend PDF tests
 * exercise the real export pipeline without importing the Angular renderer.
 */
export function buildResumeHtml(options: ResumeHtmlOptions = {}): string {
  const pageCount = options.pageCount ?? 2;
  const report: PdfPaginationReport = {
    pageCount,
    overflowingPages: 0,
    orphanedHeadings: 0,
    clippedBlocks: 0,
    missingSections: 0,
    ...options.report,
  };

  const pages = Array.from(
    { length: pageCount },
    (_, i) =>
      `<div class="resume-page"><h1>Page ${i + 1}</h1><p>Resume content line ${i + 1}.</p></div>`
  ).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    html, body { margin: 0; padding: 0; }
    .resume-page { width: 210mm; min-height: 297mm; box-sizing: border-box; padding: 14mm 16mm; background: #ffffff; }
  </style></head><body>${pages}${options.extraBody ?? ''}${options.unsafeLinks ?? ''}<script>
  (function () {
    globalThis.__paginationReport = ${JSON.stringify(report)};
  })();
  </script></body></html>`;
}
