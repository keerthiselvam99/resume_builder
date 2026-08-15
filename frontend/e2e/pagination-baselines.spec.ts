import { expect, test } from '@playwright/test';
import { renderResumeHtml } from '../src/app/core/templates/resume-template-renderer';
import { buildDefinitions } from '../src/app/core/templates/template-catalogue';
import { longContent } from '../scripts/shared/sample-content';

const FAMILIES = ['executive-banner', 'creative-portfolio'];

test.use({ viewport: { width: 816, height: 1056 } });

test.describe('pagination baselines — long-content page stacks', () => {
  for (const family of FAMILIES) {
    test(`pagination stack — ${family} (long)`, async ({ page }) => {
      const def = buildDefinitions().find((d) => d.id === `t-${family}-navy`);
      if (!def) {
        throw new Error(`Missing definition t-${family}-navy`);
      }
      await page.setContent(renderResumeHtml(longContent, def), { waitUntil: 'networkidle' });
      await page.waitForSelector('#resume-pages');
      await page.waitForFunction(
        () => (window as unknown as { __paginationReport?: unknown }).__paginationReport !== undefined,
      );
      const report = await page.evaluate(
        () => (window as unknown as { __paginationReport: Record<string, number> }).__paginationReport,
      );
      expect(report['overflowingPages']).toBe(0);
      expect(report['orphanedHeadings']).toBe(0);
      expect(report['clippedBlocks']).toBe(0);
      expect(report['missingSections']).toBe(0);
      await expect(page).toHaveScreenshot(`pagination-${family}-navy-long.png`, {
        animations: 'disabled',
        fullPage: true,
        maxDiffPixelRatio: 0.02,
      });
    });
  }
});
