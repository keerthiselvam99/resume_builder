import { chromium, Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const BASE = 'http://127.0.0.1:4200';
const OUT_DIR = path.join(__dirname, '..', 'fix-evidence');

const notes: string[] = [];

async function login(page: Page): Promise<void> {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('app-input input').fill('arun@example.com');
  await page.locator('app-password-input input').fill('Password123!');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForFunction(() => location.pathname !== '/login', undefined, { timeout: 30_000 });
}

async function waitImages(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const viewport = window.innerHeight;
    return Array.from(document.images).every((img) => {
      const rect = img.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > viewport) return true;
      return img.complete && img.naturalWidth > 0;
    });
  });
}

async function waitForPreviewFrame(page: Page): Promise<void> {
  await page.waitForSelector('app-preview-frame iframe', { state: 'attached', timeout: 20_000 });
  await page.waitForFunction(
    () => {
      const f = document.querySelector('app-preview-frame iframe') as HTMLIFrameElement | null;
      if (!f || !f.contentDocument) return false;
      return !!f.contentDocument.querySelector('.resume-page');
    },
    undefined,
    { timeout: 20_000 },
  );
  await page.waitForTimeout(500);
}

async function measureFrame(page: Page): Promise<Record<string, unknown>> {
  const source = `(() => {
    const frame = document.querySelector('app-preview-frame iframe');
    const stage = document.querySelector('.preview-frame');
    const canvas = document.querySelector('.preview-frame__canvas');
    const doc = frame ? frame.contentDocument : null;
    const resume = doc ? doc.querySelector('.resume-page') : null;
    const h1 = doc ? doc.querySelector('h1') : null;
    const round = (n) => Math.round(n * 10) / 10;
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: round(r.x), y: round(r.y), width: round(r.width), height: round(r.height) };
    };
    const m = /matrix\\(([^,]+),/.exec(getComputedStyle(frame).transform);
    const scale = m ? parseFloat(m[1]) : 0;
    const h1Box = h1 ? h1.getBoundingClientRect() : null;
    const h1FontPx = h1 ? parseFloat(getComputedStyle(h1).fontSize) : 0;
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      stage: box(stage),
      canvas: box(canvas),
      frameRect: box(frame),
      iframeTransformScale: round(scale),
      iframeInternalDoc: doc
        ? {
            clientWidth: doc.documentElement.clientWidth,
            clientHeight: doc.documentElement.clientHeight,
            scrollWidth: doc.documentElement.scrollWidth,
            scrollHeight: doc.documentElement.scrollHeight,
          }
        : null,
      resumePage: box(resume),
      pageRatio: resume ? round(resume.getBoundingClientRect().width / resume.getBoundingClientRect().height) : 0,
      h1FontPx: round(h1FontPx),
      h1BoxHeightPx: h1Box ? round(h1Box.height) : 0,
      h1OnScreenPx: h1Box ? round(h1Box.height * scale) : 0,
    };
  })()`;
  return (await page.evaluate(source)) as Record<string, unknown>;
}

async function record(title: string, body: string): Promise<void> {
  notes.push(`## ${title}\n\n${body.trim()}\n`);
}

async function bodyExcerpt(page: Page): Promise<string> {
  const text = await page.locator('body').innerText();
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 24)
    .join(' · ');
}

async function editorHeaderEvidence(page: Page): Promise<string> {
  return page.evaluate(() => {
    const buttons = Array.from(
      document.querySelectorAll('.editor__bar .app-button, .editor__bar button'),
    ).map((b) => {
      const r = b.getBoundingClientRect();
      return {
        text: (b.textContent ?? '').trim(),
        width: Math.round(r.width),
        height: Math.round(r.height),
        disabled: b.hasAttribute('disabled'),
      };
    });
    const bar = document.querySelector('.editor__bar');
    const barRect = bar?.getBoundingClientRect();
    return JSON.stringify(
      {
        buttons,
        statusBadgeVisible: !!document.querySelector('.editor__status'),
        saveLabel: document.querySelector('.editor__save-label')?.textContent?.trim() ?? '',
        barRect: barRect
          ? { width: Math.round(barRect.width), height: Math.round(barRect.height) }
          : null,
      },
      null,
      2,
    );
  });
}

async function createResumeView(page: Page, width: number, height: number, name: string): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto(`${BASE}/resumes/new?templateId=t-executive-banner-burgundy`, {
    waitUntil: 'domcontentloaded',
  });
  await waitForPreviewFrame(page);
  await waitImages(page);
  const m = await measureFrame(page);
  await page.screenshot({ path: path.join(OUT_DIR, `${name}.png`), fullPage: false });
  await record(
    `${name}`,
    `URL /resumes/new?templateId=t-executive-banner-burgundy at ${width}×${height}
${JSON.stringify(m, null, 2)}

Screen text: ${await bodyExcerpt(page)}`,
  );
}

async function templatePreviewView(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${BASE}/templates/t-executive-banner-burgundy`, {
    waitUntil: 'domcontentloaded',
  });
  await waitForPreviewFrame(page);
  await waitImages(page);
  const m = await measureFrame(page);
  await page.screenshot({ path: path.join(OUT_DIR, 'template-preview-same-frame-comparison.png') });
  await record(
    'template-preview-same-frame-comparison',
    `URL /templates/t-executive-banner-burgundy at 1920×1080 (Template Preview, shared PreviewFrameComponent)
${JSON.stringify(m, null, 2)}

Comparison note: same app-preview-frame, same A4 794×1123 portrait document, same Fit formula
(scale = min(availW/794, availH/pageHeight)) as the Create Resume page.`,
  );
}

async function editorDraftView(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto(`${BASE}/templates/t-executive-banner-burgundy`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Use this template' }).click();
  await page.waitForFunction(() => location.pathname === '/resumes/new', undefined, { timeout: 20_000 });
  await page.locator('#resume-name').fill('Draft Evidence Resume');
  await page.getByRole('button', { name: 'Create and edit' }).click();
  await page.waitForSelector('.editor__bar', { timeout: 20_000 });
  await page.waitForSelector('#editor-section-contact', { timeout: 20_000 });
  await page.waitForFunction(
    () =>
      document
        .querySelector('.editor__save-label')
        ?.textContent?.trim() === 'Draft saved',
    undefined,
    { timeout: 20_000 },
  );
  await page.waitForTimeout(300);
  const evidence = await editorHeaderEvidence(page);
  await page.locator('.editor__bar').screenshot({
    path: path.join(OUT_DIR, 'editor-header-draft-simplified.png'),
  });
  await record(
    'editor-header-draft-simplified',
    `Draft resume editor (freshly created, auto-saved, template Executive Banner – Burgundy) at 1920×1080.
Header cropped; other editor sections excluded.

${evidence}`,
  );
}

async function editorSavedView(page: Page, name: string, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto(`${BASE}/resumes`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Open' }).first().click();
  await page.waitForSelector('.editor__bar', { timeout: 20_000 });
  await page.waitForSelector('#editor-section-contact', { timeout: 20_000 });
  await page.waitForFunction(
    () =>
      document
        .querySelector('.editor__save-label')
        ?.textContent?.trim() === 'Saved',
    undefined,
    { timeout: 20_000 },
  );
  await page.waitForTimeout(300);
  const evidence = await editorHeaderEvidence(page);
  await page.locator('.editor__bar').screenshot({ path: path.join(OUT_DIR, `${name}.png`) });
  await record(
    name,
    `Saved resume editor (Master Resume) at ${width}×${height}. Header cropped; other editor sections excluded.

${evidence}`,
  );
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await login(page);

  await createResumeView(page, 1920, 1080, 'create-resume-readable-a4-desktop');
  await createResumeView(page, 768, 1024, 'create-resume-readable-a4-tablet');
  await createResumeView(page, 393, 852, 'create-resume-readable-a4-mobile');
  await templatePreviewView(page);
  await editorDraftView(page);
  await editorSavedView(page, 'editor-header-saved-simplified', 1920, 1080);
  await editorSavedView(page, 'editor-header-mobile-simplified', 390, 844);

  await browser.close();

  const report = [
    '# Fix verification evidence',
    '',
    'Screenshots captured from the built app served by `ng serve` (in-browser mock repositories).',
    '',
    ...notes,
    '',
  ].join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'verification-notes.md'), report);
  console.log(`Screenshots and notes written to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
