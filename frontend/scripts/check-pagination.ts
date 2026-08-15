import { chromium, Browser, Page } from 'playwright';
import { renderResumeHtml } from '../src/app/core/templates/resume-template-renderer';
import { buildDefinitions } from '../src/app/core/templates/template-catalogue';
import { longContent, sampleContent } from './shared/sample-content';
import { ResumeContent } from '../src/app/core/models/resume.model';

interface PaginationReport {
  overflowingPages: number;
  orphanedHeadings: number;
  clippedBlocks: number;
  missingSections: number;
  pageCount: number;
}

async function evaluateReport(page: Page): Promise<PaginationReport | null> {
  return page.evaluate(() => {
    const r = (window as unknown as { __paginationReport?: PaginationReport }).__paginationReport;
    return r ?? null;
  });
}

async function main(): Promise<void> {
  const contentArg = process.argv.indexOf('--content');
  const variant = contentArg >= 0 ? process.argv[contentArg + 1] ?? 'long' : 'long';
  const contentMap: Record<string, ResumeContent> = {
    long: longContent,
    sample: sampleContent,
  };
  const content = contentMap[variant];
  if (!content) {
    console.error(`Unknown --content value: ${variant} (expected long|sample)`);
    process.exit(1);
  }

  const definitions = buildDefinitions();
  const browser: Browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 794, height: 1123 }, deviceScaleFactor: 1 });

  let overflowingPages = 0;
  let orphanedHeadings = 0;
  let clippedBlocks = 0;
  let missingSections = 0;
  let unPaginated = 0;
  let minPages = Number.POSITIVE_INFINITY;
  let maxPages = 0;

  for (const def of definitions) {
    const html = renderResumeHtml(content, def);
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.waitForTimeout(120);

    const report = await evaluateReport(page);
    if (!report) {
      unPaginated += 1;
      console.log(`NO PAGINATION REPORT: ${def.id}`);
      await page.close();
      continue;
    }
    overflowingPages += report.overflowingPages;
    orphanedHeadings += report.orphanedHeadings;
    clippedBlocks += report.clippedBlocks;
    missingSections += report.missingSections;
    if (report.pageCount < minPages) {
      minPages = report.pageCount;
    }
    if (report.pageCount > maxPages) {
      maxPages = report.pageCount;
    }
    if (
      report.overflowingPages > 0 ||
      report.orphanedHeadings > 0 ||
      report.clippedBlocks > 0 ||
      report.missingSections > 0
    ) {
      console.log(
        `FAIL ${def.id}: overflow=${report.overflowingPages} orphan=${report.orphanedHeadings} clipped=${report.clippedBlocks} missing=${report.missingSections} pages=${report.pageCount}`,
      );
    }
    await page.close();
  }

  await browser.close();

  console.log(`\nPagination checks for ${definitions.length} templates (content: ${variant})`);
  console.log(`hidden overflowing pages: ${overflowingPages}`);
  console.log(`orphaned headings: ${orphanedHeadings}`);
  console.log(`clipped text blocks: ${clippedBlocks}`);
  console.log(`source sections missing from page stack: ${missingSections}`);
  console.log(
    `page counts: min=${minPages === Number.POSITIVE_INFINITY ? 'n/a' : minPages} max=${maxPages}`,
  );
  if (unPaginated > 0) {
    console.log(`templates with no pagination report: ${unPaginated}`);
  }

  const failed =
    overflowingPages > 0 || orphanedHeadings > 0 || clippedBlocks > 0 || missingSections > 0 || unPaginated > 0;
  if (failed) {
    console.error('\nPagination validation FAILED.');
    process.exit(1);
  }
  console.log('\nPagination validation passed.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
