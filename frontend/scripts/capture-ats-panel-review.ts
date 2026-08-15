import { chromium, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:4300';
const OUT = path.resolve('screenshots', 'ats-review');
const DEMO_EMAIL = 'arun@example.com';
const DEMO_PASSWORD = 'Password123!';

function out(name: string): string {
  return path.join(OUT, name);
}

async function calm(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addStyleTag({
    content:
      '*, *::before, *::after { animation-duration: 0.001s !important; transition-duration: 0.001s !important; }',
  });
}

async function doLogin(page: Page): Promise<void> {
  await page.goto(`${BASE}/login`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('app-input input').fill(DEMO_EMAIL);
  await page.locator('app-password-input input').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/dashboard');
}

async function openEditor(page: Page): Promise<void> {
  // Open the seeded resume via the dashboard (mirrors the E2E journey).
  await page.getByRole('heading', { name: /My Resumes/i }).waitFor();
  await page.locator('article.card', { hasText: 'Master Resume' }).first().getByRole('button', { name: 'Open' }).click();
  await page.waitForURL(/\/resumes\/[^/]+\/versions\/[^/]+\/edit/);
  await page.getByRole('heading', { name: /Master Resume/i }).waitFor();
  await page.locator('aside.ats-panel').waitFor({ timeout: 15000 });
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await calm(page);

  await doLogin(page);
  await openEditor(page);

  const panel = page.locator('aside.ats-panel');
  await panel.scrollIntoViewIfNeeded();

  // 1) ATS panel before analysis (idle).
  await panel.getByText('Run the ATS check to see how this version scores', { exact: false }).waitFor();
  await panel.screenshot({ path: out('ats-1-idle.png') });
  console.log('saved ats-1-idle.png');

  // 2) Loading after clicking Run analysis. The mock repository answers after
  // ~300ms (rxjs delay schedules via setInterval/setTimeout), so scale short
  // page timers 8x to widen the loading window deterministically. The wrappers
  // preserve the zone.js-patched originals so change detection keeps working.
  const PATCH_TIMERS = `
    window.__rbOrigSetTimeout = window.setTimeout.bind(window);
    window.__rbOrigSetInterval = window.setInterval.bind(window);
    window.setTimeout = function (fn, ms) {
      return window.__rbOrigSetTimeout(fn, ms != null && ms > 0 && ms < 1000 ? ms * 8 : ms);
    };
    window.setInterval = function (fn, ms) {
      return window.__rbOrigSetInterval(fn, ms != null && ms > 0 && ms < 1000 ? ms * 8 : ms);
    };
  `;
  const RESTORE_TIMERS = `
    window.setTimeout = window.__rbOrigSetTimeout;
    window.setInterval = window.__rbOrigSetInterval;
  `;
  await page.addScriptTag({ content: PATCH_TIMERS });
  await panel.getByRole('button', { name: 'Run analysis' }).click();
  await page.locator('.ats-panel__state').filter({ hasText: 'Analysing' }).waitFor({ state: 'visible' });
  await panel.screenshot({ path: out('ats-2-loading.png') });
  console.log('saved ats-2-loading.png');
  await page.addScriptTag({ content: RESTORE_TIMERS });

  // 3) Score, categories, findings.
  await page.locator('.ats-score__value').waitFor({ state: 'visible', timeout: 20000 });
  await page.locator('.ats-panel__categories').waitFor();
  await page.locator('.ats-panel__findings, .ats-panel__clean').waitFor();
  await panel.screenshot({ path: out('ats-3-result.png') });
  console.log('saved ats-3-result.png');

  // 4) Panel inside the full editor (viewport shot with the panel in context).
  await panel.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: out('ats-4-full-editor.png') });
  console.log('saved ats-4-full-editor.png');

  // 5) Stale-result state after editing content.
  const summary = page.locator('app-editor-summary-form textarea');
  await summary.scrollIntoViewIfNeeded();
  await summary.fill('Edited summary text that invalidates the previous analysis.');
  await panel.scrollIntoViewIfNeeded();
  await page
    .getByText('Content changed since this analysis — run it again for fresh results.')
    .waitFor({ state: 'visible', timeout: 10000 });
  await panel.screenshot({ path: out('ats-5-stale.png') });
  console.log('saved ats-5-stale.png');

  await browser.close();
  console.log('DONE');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
