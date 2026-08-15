import { chromium, Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';

const BASE = 'http://127.0.0.1:4200';
const OUT_DIR = path.join(__dirname, '..', 'fix-evidence');
const DEMO_EMAIL = 'arun@example.com';
const DEMO_PASSWORD = 'Password123!';

const report: string[] = [];

async function login(page: Page): Promise<void> {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('app-input input').fill(DEMO_EMAIL);
  await page.locator('app-password-input input').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/resumes');
}

async function waitForIframeResume(page: Page): Promise<void> {
  await page.waitForSelector('iframe.preview-frame__iframe', { state: 'attached', timeout: 20000 });
  await page.waitForFunction(
    () => {
      const el = document.querySelector('iframe.preview-frame__iframe') as HTMLIFrameElement | null;
      if (!el || !el.contentDocument) return false;
      return el.contentDocument.querySelector('.resume-page') !== null;
    },
    undefined,
    { timeout: 20000 },
  );
  await page.waitForTimeout(400);
}

const MEASURE_SRC = `(() => {
  const stage = document.querySelector('.preview-frame');
  const canvas = document.querySelector('.preview-frame__canvas');
  const frame = document.querySelector('iframe.preview-frame__iframe');
  const doc = frame ? frame.contentDocument : null;
  const round = (n) => Math.round(n * 10) / 10;
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: round(r.x), y: round(r.y), w: round(r.width), h: round(r.height) };
  };
  const sr = stage.getBoundingClientRect();
  const cr = canvas ? canvas.getBoundingClientRect() : null;
  const fr = frame ? frame.getBoundingClientRect() : null;
  const m = /matrix\\(([^,]+),/.exec(getComputedStyle(frame).transform);
  const scale = m ? parseFloat(m[1]) : 0;
  const resume = doc ? doc.querySelector('.resume-page') : null;
  const rr = resume ? resume.getBoundingClientRect() : null;
  return {
    stage: box(stage),
    canvas: box(canvas),
    iframe: box(frame),
    transformScale: round(scale),
    iframeRatio: fr ? round(fr.height / fr.width) : 0,
    page: rr ? { w: round(rr.width), h: round(rr.height) } : null,
    pageRatio: rr ? round(rr.width / rr.height) : 0,
    stageOverflowX: stage.scrollWidth - stage.clientWidth,
    stageOverflowY: stage.scrollHeight - stage.clientHeight,
    doc: doc
      ? {
          scrollWidth: doc.documentElement.scrollWidth,
          clientWidth: doc.documentElement.clientWidth,
          scrollHeight: doc.documentElement.scrollHeight,
          clientHeight: doc.documentElement.clientHeight,
        }
      : null,
    canvasInsideStage: cr ? cr.width <= sr.width + 1 && cr.height <= sr.height + 1 : false,
    pageInsideCanvas: rr && cr ? rr.width * scale <= cr.width + 1 && rr.height * scale <= cr.height + 1 : false,
  };
})()`;

async function createResumeMeasure(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto(`${BASE}/resumes/new?templateId=t-executive-banner-burgundy`, {
    waitUntil: 'domcontentloaded',
  });
  await waitForIframeResume(page);
  const m = await page.evaluate(MEASURE_SRC);
  report.push(`## create-resume at ${width} x ${height}
${JSON.stringify(m, null, 2)}`);
}

async function templatePreviewMeasure(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto(`${BASE}/templates/t-executive-banner-burgundy`, {
    waitUntil: 'domcontentloaded',
  });
  await page.getByRole('button', { name: 'Burgundy', exact: true }).click();
  await waitForIframeResume(page);
  const m = await page.evaluate(MEASURE_SRC);
  report.push(`## template-preview at ${width} x ${height}
${JSON.stringify(m, null, 2)}`);
}

const RIGHT_SIDE_SRC = `(() => {
  const round = (n) => Math.round(n * 10) / 10;
  const info = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return {
      x: round(r.x), y: round(r.y), w: round(r.width), h: round(r.height),
      display: s.display, position: s.position, flex: s.flex,
      font: s.fontSize + '/' + s.lineHeight + ' ' + s.fontFamily,
      color: s.color, bg: s.backgroundColor, border: s.borderTopStyle + ' ' + s.borderTopWidth + ' ' + s.borderTopColor,
      padding: s.padding, radius: s.borderRadius, gap: s.gap || null,
      gridTemplateColumns: el.closest('.layout') ? getComputedStyle(el.closest('.layout')).gridTemplateColumns : null,
    };
  };
  const layout = document.querySelector('.layout');
  const leftCol = layout ? layout.children[0] : null;
  const rightCol = layout ? layout.children[1] : null;
  const formCard = document.querySelector('.card:has(#resume-name)');
  const metaCard = document.querySelector('.card:has(.template-card__name)');
  const selectors = {
    heading: formCard ? formCard.querySelector('h2') : null,
    description: formCard ? formCard.querySelector('.text-muted') : null,
    input: document.getElementById('resume-name'),
    createBtn: formCard ? formCard.querySelector('button') : null,
    cancelBtn: (() => Array.from(document.querySelectorAll('.card button')).find((b) => /^Cancel/.test(b.textContent.trim())))() || null,
    metaName: document.querySelector('.template-card__name'),
    badges: document.querySelector('.template-card__badges'),
    changeLink: document.querySelector('a.change-link'),
  };
  const out = {
    layout: info(layout),
    leftCol: info(leftCol),
    rightCol: info(rightCol),
    previewFrame: info(document.querySelector('.preview-frame')),
    formCard: info(formCard),
  };
  for (const k of Object.keys(selectors)) {
    out[k] = info(selectors[k]);
  }
  return out;
})()`;

async function rightSideEvidence(page: Page, width: number, height: number): Promise<void> {
  await page.setViewportSize({ width, height });
  await page.goto(`${BASE}/resumes/new?templateId=t-executive-banner-burgundy`, {
    waitUntil: 'domcontentloaded',
  });
  await waitForIframeResume(page);
  const m = await page.evaluate(RIGHT_SIDE_SRC);
  report.push(`## right-side element metrics at ${width} x ${height}
${JSON.stringify(m, null, 2)}`);
  fs.writeFileSync(
    path.join(OUT_DIR, `create-resume-right-side-metrics-${width}.json`),
    JSON.stringify(m, null, 2),
  );
}

async function main(): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await login(page);

  await templatePreviewMeasure(page, 1440, 900);
  await createResumeMeasure(page, 1440, 900);
  await createResumeMeasure(page, 1920, 1080);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${BASE}/resumes/new?templateId=t-executive-banner-burgundy`, {
    waitUntil: 'domcontentloaded',
  });
  await waitForIframeResume(page);
  await page.waitForTimeout(200);
  await page.screenshot({
    fullPage: true,
    path: path.join(OUT_DIR, 'create-resume-left-preview-readable.png'),
  });
  report.push(
    `Screenshot captured: frontend/fix-evidence/create-resume-left-preview-readable.png (1440x900, full page, portrait A4 readable preview)`,
  );

  await rightSideEvidence(page, 1440, 900);
  await browser.close();

  fs.writeFileSync(
    path.join(OUT_DIR, 'create-resume-isolated-proof.md'),
    '# Create Resume isolated left-preview proof\n\n' + report.join('\n\n') + '\n',
  );
  console.log('OK ->', path.join(OUT_DIR, 'create-resume-isolated-proof.md'));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
