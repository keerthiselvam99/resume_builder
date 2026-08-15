import { chromium, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'http://127.0.0.1:4200';
const OUT = path.resolve('fresh-screenshots');
const NOTES = path.join(OUT, 'view-notes.md');
const DEMO_EMAIL = 'arun@example.com';
const DEMO_PASSWORD = 'Password123!';

const notes: string[] = [];

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
  await page
    .waitForFunction(
      () => {
        const images = Array.from(document.images);
        return images.every((img) => img.complete);
      },
      { timeout: 4000 },
    )
    .catch(() => undefined);
  await page.waitForTimeout(500);
}

async function waitForIframeContent(page: Page, selector: string): Promise<void> {
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

function styleLines(page: Page, selector: string, props: string[]): Promise<string[]> {
  return page
    .locator(selector)
    .first()
    .evaluate((el, p) => {
      const s = getComputedStyle(el);
      return p.map((prop) => `${prop}: ${s.getPropertyValue(prop)}`);
    }, props)
    .catch(() => ['(element not found)']);
}

function textOf(page: Page, selector: string): Promise<string> {
  return page
    .locator(selector)
    .first()
    .innerText()
    .catch(() => '(element not found)');
}

async function note(
  page: Page,
  name: string,
  opts: { body?: boolean; styles?: [string, string[]][]; texts?: Record<string, string> },
): Promise<void> {
  await waitForReady(page);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  notes.push(`## ${name}`);
  if (opts.body) {
    const body = await page.locator('body').innerText();
    const excerpt = body
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 80);
    notes.push(`- bodyText: ${JSON.stringify(excerpt)}`);
  }
  if (opts.texts) {
    for (const [key, sel] of Object.entries(opts.texts)) {
      notes.push(`- ${key}: ${(await textOf(page, sel)) || '(empty)'}`);
    }
  }
  if (opts.styles) {
    for (const [selector, props] of opts.styles) {
      const lines = await styleLines(page, selector, props);
      notes.push(`- ${selector}: ${lines.join('; ')}`);
    }
  }
  console.log(`saved fresh-screenshots/${name}.png`);
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT, { recursive: true });
  notes.push(`# UI verification — fresh screenshots`, `Generated ${new Date().toISOString()}`, '');

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // 1. Login page
  await page.goto(`${BASE}/login`);
  await page.getByRole('button', { name: 'Log in' }).waitFor();
  await note(page, '01-login', { body: true });

  // 2. Dashboard (My Resumes + Drafts tabs)
  await doLogin(page);
  await note(page, '02-dashboard', {
    body: true,
    texts: {
      navLinks: '.shell-nav',
      activeTab: '.tabs__tab--active',
    },
    styles: [
      ['.shell-nav__link', ['color', 'font-size']],
      ['.tabs__tab--active', ['background-color', 'color', 'font-weight']],
      ['.tabs__tab', ['color']],
    ],
  });

  // 3. Template gallery
  await page.getByRole('link', { name: 'Templates' }).click();
  await page.waitForURL(`${BASE}/templates`);
  await page.getByRole('heading', { name: /Templates/i }).waitFor();
  await note(page, '03-template-gallery', { body: true });

  // 4. Template preview (fit mode)
  const executiveCard = page.locator('article.card', { hasText: 'Executive Banner' });
  await executiveCard.getByRole('button', { name: 'Preview & customise' }).click();
  await page.waitForURL(/\/templates\/t-executive-banner-navy/);
  await waitForIframeContent(page, 'iframe.preview-frame__iframe');
  await note(page, '04-template-preview', {
    body: true,
    texts: { header: '.templates__header' },
    styles: [['iframe.preview-frame__iframe', ['transform', 'transform-origin']]],
  });

  // 5. Create resume (thumbnail preview)
  await page.getByRole('button', { name: 'Use this template' }).click();
  await page.waitForURL(/\/resumes\/new\?templateId=/);
  await waitForIframeContent(page, 'iframe.preview-frame__iframe');
  await note(page, '05-create-resume', {
    body: true,
    styles: [
      ['iframe.preview-frame__iframe', ['width', 'height', 'transform', 'transform-origin']],
    ],
  });

  // 6. Editor with draft toolbar (new empty resume -> PDF disabled)
  await page.locator('#resume-name').fill('Fresh Draft Resume');
  await page.locator('app-button', { hasText: /Create and edit/i }).click();
  await page.waitForURL(/\/resumes\/[^/]+\/versions\/[^/]+\/edit/);
  await page.getByRole('button', { name: 'Change template' }).waitFor();
  await note(page, '06-editor-draft-toolbar', {
    body: true,
    texts: { status: '.editor__status', saveLabel: '.editor__save-label' },
    styles: [
      ['.editor__status', ['display', 'background-color', 'color']],
      ['.editor__back-link', ['display', 'color']],
    ],
  });

  // 7. Editor with content (seeded Master Resume -> PDF enabled)
  await page.getByLabel('Primary').getByRole('link', { name: 'My Resumes' }).click();
  await page.waitForURL(/\/resumes$/);
  const masterCard = page.locator('article.card', { hasText: 'Master Resume' }).first();
  await masterCard.getByRole('button', { name: 'Open' }).click();
  await page.waitForURL(/\/resumes\/[^/]+\/versions\/[^/]+\/edit/);
  await waitForIframeContent(page, 'iframe.preview__iframe');
  await note(page, '07-editor-content', {
    body: true,
    texts: { status: '.editor__status' },
    styles: [['.editor__status', ['display', 'background-color', 'color']]],
  });

  // 8. My resumes list
  await page.getByLabel('Primary').getByRole('link', { name: 'My Resumes' }).click();
  await page.waitForURL(/\/resumes$/);
  await note(page, '08-my-resumes', {
    body: true,
    texts: { activeTab: '.tabs__tab--active' },
  });

  fs.writeFileSync(NOTES, notes.join('\n'), 'utf8');
  console.log(`notes written to ${NOTES}`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
