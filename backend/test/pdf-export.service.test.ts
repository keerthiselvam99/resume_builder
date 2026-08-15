import { it, describe, expect, afterAll } from 'vitest';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { PdfExportService } from '../src/services/pdf/pdf-export.service';
import { PdfGenerationError, PdfValidationError, PdfBusyError } from '../src/services/pdf/errors';
import { buildResumeHtml } from './helpers/pdf-fixtures';
import { sampleContent } from '../../frontend/scripts/shared/sample-content';

const service = new PdfExportService({ generationTimeoutMs: 30_000 });
const NAVY = 't-classic-ats-navy';
const BANNER = 't-executive-banner-navy';

afterAll(async () => {
  await service.close();
});

describe('PdfExportService.export (structured content)', () => {
  it('renders structured content into a verified A4 PDF', async () => {
    const result = await service.export(sampleContent, NAVY, 'Arun Kumar Master Resume');

    expect(result.buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(result.filename).toBe('arun-kumar-master-resume.pdf');
    expect(result.pageCount).toBeGreaterThanOrEqual(1);
    expect(result.text).toContain('Jane Doe');
    expect(result.text).toContain('Senior Software Engineer');
    expect(result.pagesText.length).toBe(result.pageCount);
    expect(result.pageSizePt.width).toBeGreaterThan(580);
    expect(result.pageSizePt.width).toBeLessThan(615);
    expect(result.pageSizePt.height).toBeGreaterThan(830);
    expect(result.pageSizePt.height).toBeLessThan(855);
  });

  it('renders the banner template too', async () => {
    const result = await service.export(sampleContent, BANNER, 'banner');
    expect(result.buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(result.text).toContain('Jane Doe');
  });

  it('rejects unknown template definitions', async () => {
    await expect(service.export(sampleContent, 't-does-not-exist', 'x')).rejects.toThrow(
      PdfValidationError
    );
  });

  it('rejects invalid content shapes', async () => {
    await expect(service.export({ contacts: {} }, NAVY, 'x')).rejects.toThrow(PdfValidationError);
    await expect(
      service.export({ html: '<script>x</script>', content: sampleContent }, NAVY, 'x')
    ).rejects.toThrow(PdfValidationError);
  });

  it('emits only safe link annotations for safe content', async () => {
    const result = await service.export(sampleContent, NAVY, 'links');
    const urls = result.linkAnnotations.map((a) => a.url);
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(/^(https?|mailto|tel):/i.test(url)).toBe(true);
    }
  });

  it('never emits unsafe annotations from hostile URLs', async () => {
    const hostile = structuredClone(sampleContent);
    hostile.contacts.linkedinUrl = 'javascript:alert(1)';
    hostile.contacts.portfolioUrl = 'data:text/html,<script>x</script>';
    hostile.projects[0].link = 'file:///etc/passwd';

    const result = await service.export(hostile, NAVY, 'hostile');
    expect(result.buffer.subarray(0, 4).toString()).toBe('%PDF');
    for (const annotation of result.linkAnnotations) {
      expect(/^(javascript|data|vbscript|file):/i.test(annotation.url)).toBe(false);
    }
  });
});

describe('PdfExportService.exportRenderedHtml (worker security)', () => {
  it('rejects HTML containing unsafe link schemes', async () => {
    const html = buildResumeHtml({
      pageCount: 1,
      unsafeLinks: '<a href="javascript:alert(1)">x</a>',
    });
    await expect(service.exportRenderedHtml(html, 'unsafe')).rejects.toThrow(PdfValidationError);
  });

  it('rejects empty HTML payloads', async () => {
    await expect(service.exportRenderedHtml('   ', 'empty')).rejects.toThrow(PdfValidationError);
  });

  it('rejects a resume whose pagination report reports broken invariants', async () => {
    const html = buildResumeHtml({ pageCount: 1, report: { overflowingPages: 1 } });
    await expect(service.exportRenderedHtml(html, 'broken')).rejects.toThrow(PdfGenerationError);
  });

  it('rejects a report that never arrives', async () => {
    const fast = new PdfExportService({ generationTimeoutMs: 1500 });
    const html = '<!DOCTYPE html><html><body><h1>no report</h1></body></html>';
    await expect(fast.exportRenderedHtml(html, 'noreport')).rejects.toThrow(PdfGenerationError);
    await fast.close();
  });

  it('blocks external resources and scripts (SSRF/network defence)', async () => {
    const hits: string[] = [];
    const server = createServer((_req, res) => {
      hits.push('hit');
      res.writeHead(200);
      res.end('x');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;

    try {
      const hostile = buildResumeHtml({
        pageCount: 1,
        extraBody: `
          <img src="http://127.0.0.1:${port}/x.png" style="display:none">
          <link rel="stylesheet" href="http://127.0.0.1:${port}/x.css">
          <iframe src="http://127.0.0.1:${port}/frame" style="display:none"></iframe>
          <div style="display:none;background-image:url('http://127.0.0.1:${port}/bg.png')"></div>
          <script>try { fetch('http://127.0.0.1:${port}/fetch') } catch (e) {}</script>
        `,
      });

      const result = await service.exportRenderedHtml(hostile, 'external-resources');
      expect(result.buffer.subarray(0, 4).toString()).toBe('%PDF');
      expect(result.text).toContain('Page 1');
      expect(hits).toEqual([]);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('enforces the concurrency limit with a busy error', async () => {
    const single = new PdfExportService({
      maxConcurrency: 1,
      maxQueue: 0,
      generationTimeoutMs: 30_000,
    });
    try {
      const first = single.export(sampleContent, NAVY, 'first');
      await expect(single.export(sampleContent, NAVY, 'second')).rejects.toThrow(PdfBusyError);
      const result = await first;
      expect(result.pageCount).toBeGreaterThanOrEqual(1);
    } finally {
      await single.close();
    }
  });
});
