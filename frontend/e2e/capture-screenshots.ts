import { chromium, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:4200';
const OUT = path.resolve('screenshots');
const DEMO_EMAIL = 'arun@example.com';
const DEMO_PASSWORD = 'Password123!';

async function doLogin(page: Page): Promise<void> {
  await page.goto(`${BASE}/login`);
  await page.locator('app-input input').fill(DEMO_EMAIL);
  await page.locator('app-password-input input').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/resumes');
}

async function waitForReady(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addStyleTag({
    content:
      '*, *::before, *::after { animation-duration: 0.001s !important; transition-duration: 0.001s !important; }',
  });
  await page.waitForLoadState('load');
  await page.waitForFunction(() => {
    const images = Array.from(document.images);
    return images.every((img) => img.complete);
  });
  await page.waitForTimeout(500);
}

async function waitForIframeContent(page: Page, selector: string): Promise<void> {
  await page
    .locator(selector)
    .evaluate((el) => (el as HTMLIFrameElement).contentDocument?.readyState === 'complete');
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel) as HTMLIFrameElement | null;
      if (!el || !el.contentDocument) return false;
      return el.contentDocument.querySelector('.resume-page') !== null;
    },
    selector,
    { timeout: 15000 },
  );
}

async function shoot(page: Page, name: string): Promise<void> {
  await waitForReady(page);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  console.log(`saved screenshots/${name}.png`);
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  await doLogin(page);

  // 1. Gallery (swatches + badges)
  await page.getByRole('link', { name: 'Templates' }).click();
  await page.waitForURL(`${BASE}/templates`);
  await page.getByRole('heading', { name: /Templates/i }).waitFor();
  await shoot(page, '1-gallery');

  // 2. Template preview (Navy default) + sticky controls
  const executiveCard = page.locator('article.card', { hasText: 'Executive Banner' });
  await executiveCard.getByRole('button', { name: 'Preview & customise' }).click();
  await page.waitForURL(/\/templates\/t-executive-banner-navy/);
  await shoot(page, '2-template-preview-navy');

  // 3. Burgundy preview (white paper, burgundy banner, fit mode)
  await page.getByRole('button', { name: 'Burgundy', exact: true }).click();
  await waitForIframeContent(page, 'iframe.preview-frame__iframe');
  await shoot(page, '3-template-preview-burgundy');

  // 4. Create Resume shows selected template context (Executive Banner — Burgundy)
  await page.getByRole('button', { name: 'Use this template' }).click();
  await page.waitForURL(/\/resumes\/new\?templateId=t-executive-banner-burgundy/);
  await shoot(page, '4-create-resume');

  // 5. Editor empty state, fully loaded (forms + Change template + empty preview)
  await page.locator('#resume-name').fill('Portfolio Resume');
  await page.locator('app-button', { hasText: /Create and edit/i }).click();
  await page.waitForURL(/\/resumes\/[^/]+\/versions\/[^/]+\/edit/);
  await page
    .getByRole('heading', { name: 'Start entering your details' })
    .waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'Change template' }).waitFor();
  await shoot(page, '5-editor-empty-state');

  // 6. Change template on the populated seeded resume, revealing the layout
  await page.getByLabel('Primary').getByRole('link', { name: 'My Resumes' }).click();
  await page.waitForURL(/\/resumes$/);
  const masterCard = page.locator('article.card', { hasText: 'Master Resume' }).first();
  await masterCard.getByRole('button', { name: 'Open' }).click();
  await page.waitForURL(/\/resumes\/[^/]+\/versions\/[^/]+\/edit/);
  await waitForIframeContent(page, 'iframe.preview__iframe');
  await page.getByText('Classic ATS — Navy', { exact: true }).waitFor();

  await page.getByRole('button', { name: 'Change template' }).click();
  await page.waitForURL(/\/templates\?mode=change/);
  await page.getByRole('heading', { name: /Choose a new template for Master Resume/ }).waitFor();

  const premiumCard = page.locator('article.card', { hasText: 'Premium Sidebar' });
  await premiumCard.getByRole('button', { name: 'Preview & customise' }).click();
  await page.waitForURL(/\/templates\/t-premium-sidebar-navy\?mode=change/);
  await page.getByRole('button', { name: 'Apply this template' }).click();
  await page.waitForURL(/\/resumes\/[^/]+\/versions\/[^/]+\/edit/);
  await waitForIframeContent(page, 'iframe.preview__iframe');
  await page.getByText('Premium Sidebar — Navy', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Change template' }).waitFor();
  await shoot(page, '6-editor-after-template-change');

  // 7. My Resumes (populated state, actions visible)
  await page.getByLabel('Primary').getByRole('link', { name: 'My Resumes' }).click();
  await page.waitForURL(/\/resumes$/);
  await page.getByRole('heading', { name: 'My Resumes' }).waitFor();
  await shoot(page, '7-my-resumes');

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
