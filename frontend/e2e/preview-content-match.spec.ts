import { expect, test, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const DEMO_EMAIL = 'arun@example.com';
const DEMO_PASSWORD = 'Password123!';
const TEMPLATE_ID = 't-academic-cv-navy';
const SHOT_DIR = path.resolve(__dirname, '..', 'screenshots');
const EVIDENCE = path.resolve(
  __dirname,
  '..',
  'fix-evidence',
  'create-resume-right-side-metrics-1440.json',
);

test.use({ viewport: { width: 1440, height: 900 } });

async function doLogin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('app-input input').fill(DEMO_EMAIL);
  await page.locator('app-password-input input').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/resumes');
}

async function waitForResumePage(page: Page, iframeSelector: string): Promise<void> {
  const iframe = page.locator(iframeSelector);
  await iframe.waitFor({ state: 'visible' });
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel) as HTMLIFrameElement | null;
      if (!el || !el.contentDocument) return false;
      return el.contentDocument.querySelector('.resume-page') !== null;
    },
    iframeSelector,
    { timeout: 15000 },
  );
}

async function openTemplatePreview(page: Page): Promise<void> {
  await page.goto(`/templates/${TEMPLATE_ID}`);
  await waitForResumePage(page, 'iframe.preview-frame__iframe');
}

async function openCreateResume(page: Page): Promise<void> {
  await page.goto(`/resumes/new?templateId=${TEMPLATE_ID}`);
  await waitForResumePage(page, 'iframe.preview-frame__iframe');
}

function headerOrder(srcdoc: string): string[] {
  const headings: string[] = [];
  const re = /<h2>([^<]*)<\/h2>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(srcdoc)) !== null) {
    headings.push(m[1].replace(/&amp;/g, '&'));
  }
  return headings;
}

test.describe('Template Preview vs Create Resume — Academic CV — Navy content match', () => {
  test('renders byte-identical resume HTML on both pages', async ({ page }) => {
    await doLogin(page);
    await openTemplatePreview(page);

    const srcdocAttr = 'iframe.preview-frame__iframe';
    const previewSrcdoc = await page.locator(srcdocAttr).getAttribute('srcdoc');
    expect(previewSrcdoc).toBeTruthy();

    await openCreateResume(page);
    const createSrcdoc = await page.locator(srcdocAttr).getAttribute('srcdoc');
    expect(createSrcdoc).toBeTruthy();

    // Same renderer + same template + same theme + same canonical sample → same HTML.
    expect(createSrcdoc).toBe(previewSrcdoc);
  });

  test('normalized body HTML, section order and visible text match on both pages', async ({
    page,
  }) => {
    await doLogin(page);

    await openTemplatePreview(page);
    const tmplSrcdoc = await page.locator('iframe.preview-frame__iframe').getAttribute('srcdoc');
    const tmplBody = await page.locator('iframe.preview-frame__iframe').evaluate((el) => {
      const doc = (el as HTMLIFrameElement).contentDocument;
      if (!doc) return null;
      const clone = doc.body.cloneNode(true) as HTMLBodyElement;
      clone.querySelectorAll('script').forEach((s) => s.remove());
      return clone.innerHTML;
    });

    await openCreateResume(page);
    const createSrcdoc = await page.locator('iframe.preview-frame__iframe').getAttribute('srcdoc');
    const createBody = await page.locator('iframe.preview-frame__iframe').evaluate((el) => {
      const doc = (el as HTMLIFrameElement).contentDocument;
      if (!doc) return null;
      const clone = doc.body.cloneNode(true) as HTMLBodyElement;
      clone.querySelectorAll('script').forEach((s) => s.remove());
      return clone.innerHTML;
    });

    expect(createBody).toBe(tmplBody);

    // Section headings and their order are identical.
    const expectedOrder = [
      'Education',
      'Experience',
      'Projects',
      'Awards & Achievements',
      'Certifications',
      'Languages',
      'Open Source',
      'Summary',
    ];
    expect(headerOrder(tmplSrcdoc!)).toEqual(expectedOrder);
    expect(headerOrder(createSrcdoc!)).toEqual(expectedOrder);

    // Visible text content is identical.
    const visibleText = (doc: string | null | undefined) =>
      (doc ?? '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&mdash;/g, '—')
        .replace(/\s+/g, ' ')
        .trim();
    expect(visibleText(createSrcdoc)).toBe(visibleText(tmplSrcdoc));

    // The canonical sample sections are all present on Create Resume.
    for (const marker of [
      'Jane Doe',
      'Enterprise Dashboard',
      'AWS Solutions Architect',
      'Employee of the Year',
      'English',
      'Spanish',
      'Open Source',
      'University of Washington',
    ]) {
      expect(createSrcdoc).toContain(marker);
    }
  });

  test('template CSS, A4 page frame and Fit behavior match on both pages', async ({ page }) => {
    await doLogin(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addStyleTag({
      content: '*, *::before, *::after { transition-duration: 0.001s !important; }',
    });

    const capture = async () => {
      // Let the Fit-measuring ResizeObserver settle before measuring.
      await page.waitForTimeout(400);
      const data = await page.locator('iframe.preview-frame__iframe').evaluate((el) => {
        const doc = (el as HTMLIFrameElement).contentDocument;
        if (!doc) return null;
        const resume = doc.querySelector('.resume-page') as HTMLElement | null;
        const rect = resume?.getBoundingClientRect();
        const styleEl = doc.querySelector('style') as HTMLStyleElement | null;
        return {
          css: styleEl?.textContent ?? '',
          font: doc.body && window.getComputedStyle(doc.body as unknown as Element).fontFamily,
          pageRect: rect
            ? { w: rect.width, h: rect.height, ratio: +(rect.width / rect.height).toFixed(4) }
            : null,
        };
      });
      const frame = await page.locator('iframe.preview-frame__iframe').evaluate((el) => {
        const transform = window.getComputedStyle(el).transform;
        const match = /matrix\(([^,]+),/.exec(transform);
        const scale = match ? parseFloat(match[1]) : 1;
        return { width: el.offsetWidth, height: el.offsetHeight, scale };
      });
      const canvas = await page.locator('.preview-frame__canvas').evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { w: +r.width.toFixed(2), h: +r.height.toFixed(2) };
      });
      return { ...data!, frame, canvas };
    };

    await openTemplatePreview(page);
    const tmpl = await capture();

    await openCreateResume(page);
    const create = await capture();

    expect(create.css).toBe(tmpl.css);
    expect(create.font).toBe(tmpl.font);
    // A4 resume body (unscaled, inside the iframe) is identical on both pages.
    expect(create.pageRect).toEqual(tmpl.pageRect);
    // The A4 portrait ratio is preserved on both pages.
    expect(create.pageRect?.ratio).toBeCloseTo(794 / 1123, 3);
    expect(tmpl.pageRect?.ratio).toBeCloseTo(794 / 1123, 3);
    // The underlying frame is always A4 portrait (794px wide) on both pages.
    expect(create.frame.width).toBe(794);
    expect(tmpl.frame.width).toBe(794);
    // Fit behavior: canvas = A4 frame scaled by the Fit scale, ratio preserved.
    // (Canvas size differs between pages only because each grid gives the frame
    // different available space — the A4 frame and Fit formula are the same.)
    for (const c of [tmpl, create]) {
      expect(c.frame.scale).toBeGreaterThan(0);
      expect(c.canvas.w).toBeCloseTo(c.frame.width * c.frame.scale, 1);
      expect(c.canvas.h / c.canvas.w).toBeCloseTo(1123 / 794, 3);
    }
  });

  test('Create Resume right side is unchanged vs the recorded baseline', async ({ page }) => {
    await doLogin(page);
    await openCreateResume(page);

    const metrics = await page.evaluate(() => {
      const box = (el: Element | null) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          x: +r.x.toFixed(1),
          y: +r.y.toFixed(1),
          w: +r.width.toFixed(1),
          h: +r.height.toFixed(1),
        };
      };
      const buttonText = (t: string) => {
        const host = Array.from(document.querySelectorAll('app-button')).find((b) =>
          (b.textContent ?? '').includes(t),
        );
        return host ? (host.querySelector('button') as HTMLButtonElement | null) : null;
      };
      const layout = document.querySelector('.layout');
      return {
        layout: box(layout),
        leftCol: box(layout?.querySelector('.template-card') ?? null),
        rightCol: box(layout?.children[1] ?? null),
        previewFrame: box(layout?.querySelector('.preview-frame') ?? null),
        formCard: box(layout?.querySelector('.card') ?? null),
        heading: box(layout?.querySelector('.card h2') ?? null),
        description: box(layout?.querySelector('.card .text-muted') ?? null),
        input: box(document.querySelector('#resume-name')),
        createBtn: box(buttonText('Create and edit')),
        cancelBtn: box(buttonText('Cancel')),
        metaName: box(layout?.querySelector('.template-card__name') ?? null),
        badges: box(layout?.querySelector('.template-card__badges') ?? null),
        changeLink: box(layout?.querySelector('.change-link') ?? null),
      };
    });

    const baseline = JSON.parse(fs.readFileSync(EVIDENCE, 'utf8')) as Record<
      string,
      { x: number; y: number; w: number; h: number }
    >;

    for (const [key, baselineVal] of Object.entries(baseline)) {
      const current = metrics[key as keyof typeof metrics];
      expect(current, `right-side element "${key}" should exist`).not.toBeNull();
      for (const prop of ['x', 'y', 'w', 'h'] as const) {
        expect(
          Math.abs(current![prop] - baselineVal[prop]),
          `${key}.${prop} drifted from baseline (${current![prop]} vs ${baselineVal[prop]})`,
        ).toBeLessThanOrEqual(2.5);
      }
    }

    // Right-side copy also unchanged.
    const text = await page.locator('body').innerText();
    expect(text).toContain('Create a new resume');
    expect(text).toContain('Create and edit');
    expect(text).toContain('Cancel');
    expect(text).toContain('Change template');
    expect(text).toContain('ATS-friendly');
  });
});

test.describe('Academic CV — Navy preview screenshots', () => {
  test('captures reference and matching preview plus a side-by-side comparison', async ({
    page,
  }) => {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    await doLogin(page);

    await openTemplatePreview(page);
    const reference = path.join(SHOT_DIR, 'academic-cv-template-preview-reference.png');
    await page.locator('.preview-frame').screenshot({ path: reference });

    await openCreateResume(page);
    const matching = path.join(SHOT_DIR, 'academic-cv-create-resume-matching-preview.png');
    await page.locator('.preview-frame').screenshot({ path: matching });

    // Side-by-side comparison composed from the two preview element shots.
    const toDataUrl = (file: string) =>
      `data:image/png;base64,${fs.readFileSync(file).toString('base64')}`;
    const left = toDataUrl(reference);
    const right = toDataUrl(matching);

    await page.setContent(
      `<!doctype html><html><body style="margin:0;padding:16px;background:#0f172a;font-family:Inter,sans-serif;">
        <div style="display:flex;gap:16px;justify-content:center;align-items:flex-start;">
          <div><p style="color:#fff;text-align:center;font-size:18px;margin:0 0 8px;">Template Preview</p><img src="${left}" style="display:block;box-shadow:0 8px 24px rgba(0,0,0,.4);"/></div>
          <div><p style="color:#fff;text-align:center;font-size:18px;margin:0 0 8px;">Create Resume</p><img src="${right}" style="display:block;box-shadow:0 8px 24px rgba(0,0,0,.4);"/></div>
        </div>
      </body></html>`,
    );
    const comparison = path.join(SHOT_DIR, 'academic-cv-preview-content-comparison.png');
    await page.screenshot({ path: comparison });

    expect(fs.existsSync(reference)).toBe(true);
    expect(fs.existsSync(matching)).toBe(true);
    expect(fs.existsSync(comparison)).toBe(true);
  });
});
