import { chromium, Browser, BrowserContext } from 'playwright-core';
import { PdfBusyError, PdfGenerationError, PdfValidationError } from './errors';
import { assertSafePdfHtml } from './html-validation';
import { assertValidResumeContent } from './content-validation';
import { buildPdfFilename } from './filename';
import { renderResumeHtml } from '../../../../frontend/src/app/core/templates/resume-template-renderer';
import type { TemplateDefinition } from '../../../../frontend/src/app/core/models/template-definition.model';
import { buildDefinitions } from '../../../../frontend/src/app/core/templates/template-catalogue';

/**
 * Report produced by the resume renderer's embedded pagination script
 * (`window.__paginationReport`). All counters must be zero for a clean export.
 */
export interface PdfPaginationReport {
  overflowingPages: number;
  orphanedHeadings: number;
  clippedBlocks: number;
  missingSections: number;
  pageCount: number;
}

export interface PdfLinkAnnotation {
  page: number;
  url: string;
}

export interface PdfExportResult {
  /** Generated PDF bytes. */
  buffer: Buffer;
  /** Sanitized download filename, including the `.pdf` extension. */
  filename: string;
  /** Verified page count of the generated PDF. */
  pageCount: number;
  /** Extracted selectable text of the whole document. */
  text: string;
  /** Selectable text per page (index aligned with page numbers). */
  pagesText: string[];
  /** Link annotations emitted by the PDF, all with safe schemes. */
  linkAnnotations: PdfLinkAnnotation[];
  /** Page size in PDF points (1 pt = 1/72 in). A4 ≈ 595 x 842. */
  pageSizePt: { width: number; height: number };
  /** Number of outbound requests the renderer attempted (all blocked). */
  networkAttempts: number;
}

export interface PdfExportServiceOptions {
  generationTimeoutMs?: number;
  maxHtmlBytes?: number;
  maxConcurrency?: number;
  maxQueue?: number;
  maxPages?: number;
}

/**
 * Print CSS injected after the resume renderer's own styles. It makes each
 * paginated `.resume-page` occupy exactly one A4 page with zero margins, no
 * browser headers/footers, and backgrounds forced on. `@page { size: A4 }`
 * combined with `preferCSSPageSize` aligns page boundaries with the 297mm
 * elements produced by the renderer's pagination script.
 */
const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 0; }
  html, body { margin: 0 !important; padding: 0 !important; overflow: visible !important; }
  #resume-pages .resume-page {
    width: 100%;
    height: 297mm;
    margin: 0 !important;
    box-sizing: border-box;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  #resume-pages .resume-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }
}
`;

/**
 * Content-Security-Policy for the pagination pre-pass. Only the canonical,
 * inline pagination script may run; every other capability is denied. The
 * network is additionally blocked at the route level (SSRF defence).
 */
const PREPASS_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src 'none'",
  "font-src 'none'",
  "connect-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/**
 * CSP for the print pass: JavaScript is fully disabled (`script-src 'none'`),
 * and nothing external can be fetched or embedded.
 */
const PRINT_CSP = [
  "default-src 'none'",
  "script-src 'none'",
  "style-src 'unsafe-inline'",
  "img-src 'none'",
  "font-src 'none'",
  "connect-src 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

const TEMPLATE_DEFINITIONS: TemplateDefinition[] = buildDefinitions();

export class PdfExportService {
  private readonly generationTimeoutMs: number;
  private readonly maxHtmlBytes: number;
  private readonly maxConcurrency: number;
  private readonly maxQueue: number;
  private readonly maxPages: number;
  private browserPromise: Promise<Browser> | null = null;

  /** Counting semaphore guarding the single shared Chromium instance. */
  private available: number;
  private readonly waiting: Array<() => void> = [];

  constructor(options: PdfExportServiceOptions = {}) {
    this.generationTimeoutMs = options.generationTimeoutMs ?? 60_000;
    this.maxHtmlBytes = options.maxHtmlBytes ?? 2 * 1024 * 1024;
    this.maxConcurrency = options.maxConcurrency ?? 2;
    this.maxQueue = options.maxQueue ?? 4;
    this.maxPages = options.maxPages ?? 200;
    this.available = this.maxConcurrency;
  }

  /**
   * Exports a structured resume payload through the shared canonical renderer.
   * The backend owns the only code path that turns data into printable HTML.
   */
  async export(
    content: unknown,
    templateDefinitionId: string,
    rawFilename?: string
  ): Promise<PdfExportResult> {
    const validated = assertValidResumeContent(content);
    const definition = resolveTemplateDefinition(templateDefinitionId);
    const html = renderResumeHtml(validated, definition);
    return this.exportRenderedHtml(html, rawFilename ?? 'resume');
  }

  /**
   * Server-internal low-level entry point that renders already-generated resume
   * HTML. Never called with caller-controlled HTML from the HTTP boundary —
   * only `export()` feeds it the canonical renderer's output. Exposed for
   * tests that probe the worker's security properties directly.
   */
  async exportRenderedHtml(rawHtml: unknown, rawFilename: string): Promise<PdfExportResult> {
    const html = assertSafePdfHtml(rawHtml, this.maxHtmlBytes);
    const filename = buildPdfFilename(rawFilename);

    return this.withSlot(async () => {
      const browser = await this.getBrowser();
      let prepassContext: BrowserContext | undefined;
      let printContext: BrowserContext | undefined;
      let networkAttempts = 0;
      try {
        const report = await this.runPrepass(browser, html, () => {
          networkAttempts += 1;
        });

        printContext = await browser.newContext({ javaScriptEnabled: false });
        await blockNetwork(printContext, () => {
          networkAttempts += 1;
        });
        const printPage = await printContext.newPage();
        printPage.setDefaultTimeout(this.generationTimeoutMs);

        const printHtml = buildPrintHtml(report.staticDoc.styles, report.staticDoc.body);
        await printPage.setContent(printHtml, { waitUntil: 'load' });

        const buffer = await this.withTimeout(
          printPage.pdf({
            format: 'A4',
            printBackground: true,
            displayHeaderFooter: false,
            preferCSSPageSize: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 },
          }),
          this.generationTimeoutMs
        );

        return await this.verifyPdf(
          Buffer.from(buffer),
          report.pageCount,
          filename,
          networkAttempts
        );
      } catch (err) {
        if (
          err instanceof PdfValidationError ||
          err instanceof PdfGenerationError ||
          err instanceof PdfBusyError
        ) {
          throw err;
        }
        throw new PdfGenerationError(
          err instanceof Error ? `PDF generation failed: ${err.message}` : 'PDF generation failed.'
        );
      } finally {
        await prepassContext?.close().catch(() => undefined);
        await printContext?.close().catch(() => undefined);
      }
    });
  }

  /**
   * Ensures the shared Chromium instance is launched. A warm-up path (server
   * bootstrap or a readiness caller) absorbs the cold browser-launch cost so
   * the caller's first export never pays for it inside the generation budget.
   * Idempotent: every caller shares the same in-flight launch promise, and a
   * failed launch clears the cache so the next warm-up or export retries.
   *
   * Resolving does not mean a PDF has been generated — it only guarantees the
   * browser is available for the request that accepts the next export.
   */
  async prepare(timeoutMs = 45_000): Promise<void> {
    try {
      await this.withTimeout(this.getBrowser(), timeoutMs);
    } catch (err) {
      throw new Error(
        `PDF worker warm-up failed: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Readiness probe: resolves true only once the shared Chromium instance is
   * fully launched. Deliberately passive — it never triggers a launch — so the
   * probe can be polled freely without causing work on the server.
   */
  async browserReady(): Promise<boolean> {
    const pending = this.browserPromise;
    if (!pending) {
      return false;
    }
    try {
      await pending;
      return true;
    } catch {
      return false;
    }
  }

  /** Releases the shared Chromium instance. Safe to call multiple times. */
  async close(): Promise<void> {
    const pending = this.browserPromise;
    this.browserPromise = null;
    if (pending) {
      const browser = await pending.catch(() => null);
      if (browser) {
        await browser.close().catch(() => undefined);
      }
    }
  }

  /**
   * Pagination pre-pass. Loads the resume with JavaScript enabled (the trusted
   * inline pagination script must run), but every outbound request is aborted
   * and the page runs under a locked CSP. It returns the fully reflowed,
   * static document skeleton — never any script — for the print pass.
   */
  private async runPrepass(
    browser: Browser,
    html: string,
    onNetworkAttempt: () => void
  ): Promise<{
    report: PdfPaginationReport;
    pageCount: number;
    staticDoc: { styles: string; body: string };
  }> {
    const context = await browser.newContext({ javaScriptEnabled: true, locale: 'en-US' });
    try {
      await blockNetwork(context, onNetworkAttempt);
      const page = await context.newPage();
      page.setDefaultTimeout(this.generationTimeoutMs);
      await page.setContent(injectCspMeta(html, PREPASS_CSP), { waitUntil: 'load' });

      await page.waitForFunction(
        () =>
          (globalThis as unknown as { __paginationReport?: unknown }).__paginationReport !==
          undefined,
        { timeout: this.generationTimeoutMs }
      );
      const report = await page.evaluate(
        () =>
          (globalThis as unknown as { __paginationReport: PdfPaginationReport }).__paginationReport
      );
      this.assertCleanPagination(report);

      const staticDoc = await page.evaluate(() => {
        const styles = Array.from(document.querySelectorAll('style'))
          .map((s) => s.textContent ?? '')
          .join('\n');
        const pages = document.getElementById('resume-pages');
        return { styles, body: pages ? pages.outerHTML : document.body.innerHTML };
      });

      return { report, pageCount: report.pageCount, staticDoc };
    } finally {
      await context.close().catch(() => undefined);
    }
  }

  private assertCleanPagination(report: PdfPaginationReport): void {
    if (!report || typeof report.pageCount !== 'number' || report.pageCount < 1) {
      throw new PdfGenerationError('Resume produced no pages.');
    }
    if (report.pageCount > this.maxPages) {
      throw new PdfGenerationError(`Unreasonable page count: ${report.pageCount}.`);
    }
    const broken: string[] = [];
    if (report.overflowingPages > 0) broken.push(`${report.overflowingPages} overflowing page(s)`);
    if (report.orphanedHeadings > 0) broken.push(`${report.orphanedHeadings} orphaned heading(s)`);
    if (report.clippedBlocks > 0) broken.push(`${report.clippedBlocks} clipped block(s)`);
    if (report.missingSections > 0) broken.push(`${report.missingSections} missing section(s)`);
    if (broken.length > 0) {
      throw new PdfGenerationError(`Pagination invariants violated: ${broken.join(', ')}.`);
    }
  }

  /**
   * Parses the generated PDF with pdf.js and verifies, programmatically:
   *  - the PDF page count matches the preview's pagination report,
   *  - every page is A4 and has selectable text,
   *  - every link annotation uses a safe scheme.
   */
  private async verifyPdf(
    buffer: Buffer,
    expectedPageCount: number,
    filename: string,
    networkAttempts: number
  ): Promise<PdfExportResult> {
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const task = getDocument({ data: new Uint8Array(buffer), isEvalSupported: false });
    const doc = await task.promise;
    try {
      if (doc.numPages !== expectedPageCount) {
        throw new PdfGenerationError(
          `PDF page count (${doc.numPages}) does not match preview (${expectedPageCount}).`
        );
      }

      const pages = await Promise.all(
        Array.from({ length: doc.numPages }, (_, i) => doc.getPage(i + 1))
      );
      const pagesText: string[] = [];
      const linkAnnotations: PdfLinkAnnotation[] = [];

      for (let i = 0; i < pages.length; i += 1) {
        const { width, height } = pages[i].getViewport({ scale: 1 });
        if (width < 580 || width > 615 || height < 830 || height > 855) {
          throw new PdfGenerationError(
            `PDF page ${i + 1} is not A4 (got ${width.toFixed(1)} x ${height.toFixed(1)} pt).`
          );
        }

        const content = await pages[i].getTextContent();
        pagesText.push(
          content.items
            .map((item) => item.str)
            .join(' ')
            .trim()
        );

        const annotations = await pages[i].getAnnotations();
        for (const annotation of annotations) {
          const url = annotation.url;
          if (annotation.subtype === 'Link' && typeof url === 'string' && url) {
            linkAnnotations.push({ page: i + 1, url });
          }
        }
      }

      if (pagesText.some((text) => text.length === 0)) {
        throw new PdfGenerationError('Generated PDF contains pages without selectable text.');
      }

      const unsafe = linkAnnotations.filter((annotation) =>
        /^(javascript|data|vbscript|file):/i.test(annotation.url)
      );
      if (unsafe.length > 0) {
        throw new PdfGenerationError(
          `PDF contains unsafe link annotations: ${unsafe.map((a) => a.url).join(', ')}`
        );
      }

      const { width, height } = pages[0].getViewport({ scale: 1 });
      return {
        buffer,
        filename,
        pageCount: doc.numPages,
        text: pagesText.join('\n'),
        pagesText,
        linkAnnotations,
        pageSizePt: { width, height },
        networkAttempts,
      };
    } finally {
      await task.destroy().catch(() => undefined);
    }
  }

  private getBrowser(): Promise<Browser> {
    if (!this.browserPromise) {
      this.browserPromise = chromium
        .launch({
          args: [
            '--force-color-profile=srgb',
            '--disable-dev-shm-usage',
            '--disable-extensions',
            '--disable-background-networking',
            '--disable-component-update',
            '--disable-sync',
            '--disable-default-apps',
            '--no-first-run',
            '--no-default-browser-check',
          ],
        })
        .catch((err: unknown) => {
          this.browserPromise = null;
          throw err;
        });
    }
    return this.browserPromise;
  }

  /**
   * Counting semaphore: enforces the concurrency limit on the shared browser.
   * When the queue is full a PdfBusyError is raised immediately so callers can
   * surface a 503 and the client can retry.
   */
  private async withSlot<T>(fn: () => Promise<T>): Promise<T> {
    if (this.available > 0) {
      this.available -= 1;
    } else {
      if (this.waiting.length >= this.maxQueue) {
        throw new PdfBusyError('PDF export is busy. Please try again in a moment.');
      }
      await new Promise<void>((resolve) => {
        this.waiting.push(resolve);
      });
    }
    try {
      return await fn();
    } finally {
      this.available += 1;
      this.pump();
    }
  }

  private pump(): void {
    while (this.available > 0 && this.waiting.length > 0) {
      this.available -= 1;
      const next = this.waiting.shift();
      next?.();
    }
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new PdfGenerationError('PDF generation timed out.')), ms);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }
}

function resolveTemplateDefinition(templateDefinitionId: string): TemplateDefinition {
  const definition = TEMPLATE_DEFINITIONS.find((d) => d.id === templateDefinitionId);
  if (!definition) {
    throw new PdfValidationError(`Unknown template definition: ${templateDefinitionId}`);
  }
  return definition;
}

async function blockNetwork(context: BrowserContext, onAttempt: () => void): Promise<void> {
  await context.route('**/*', (route) => {
    onAttempt();
    route.abort();
  });
}

function injectCspMeta(html: string, csp: string): string {
  return html.replace(
    '<head>',
    `<head><meta http-equiv="Content-Security-Policy" content="${csp}">`
  );
}

function buildPrintHtml(styles: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${PRINT_CSP}"><style>${styles}</style><style>${PRINT_CSS}</style></head><body>${body}</body></html>`;
}

export const pdfExportService = new PdfExportService();
