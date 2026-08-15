import { expect, test, Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { waitForPreviewReady } from './support/preview-ready';

const DEMO_EMAIL = 'arun@example.com';
const DEMO_PASSWORD = 'Password123!';

const NAVY = 'rgb(10, 28, 76)';
const WHITE = 'rgb(255, 255, 255)';
const ACCENT = 'rgb(14, 165, 233)';

const A4_PAGE_H_PX = 1123;
const STABILIZATION = join(process.cwd(), 'job-matcher-acceptance', 'stabilization');

interface PaginationReport {
  overflowingPages: number;
  orphanedHeadings: number;
  clippedBlocks: number;
  missingSections: number;
  pageCount: number;
}

async function doLogin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('app-input input').fill(DEMO_EMAIL);
  await page.locator('app-password-input input').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/resumes');
  await page.getByRole('heading', { name: 'My Resumes' }).waitFor();
}

async function waitForIframeResume(page: Page, selector: string): Promise<void> {
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

async function visibleText(page: Page): Promise<string> {
  return page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const parts: string[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      const el = node.parentElement;
      if (!el) continue;
      if (el.closest('.sr-only')) continue;
      const s = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      if (s.display === 'none' || s.visibility === 'hidden') continue;
      if (r.width === 0 && r.height === 0) continue;
      const t = node.textContent?.trim();
      if (t) parts.push(t);
    }
    return parts.join(' ');
  });
}

async function a4FrameMetrics(page: Page): Promise<{
  stage: { w: number; h: number };
  canvas: { w: number; h: number } | null;
  iframe: { w: number; h: number; x: number; y: number; ratio: number } | null;
  transform: string;
  stageOverflow: number;
  doc: { sw: number; cw: number; sh: number; ch: number } | null;
  pages: { top: number; height: number }[] | null;
  report: PaginationReport | null;
}> {
  return page.locator('.preview-frame').evaluate((stage) => {
    const canvas = stage.querySelector('.preview-frame__canvas') as HTMLElement | null;
    const frame = stage.querySelector('iframe') as HTMLIFrameElement | null;
    const fr = frame?.getBoundingClientRect();
    const doc = frame?.contentDocument;
    const cs = getComputedStyle(frame as Element);
    const win = frame?.contentWindow;
    const pages = doc
      ? Array.from(doc.querySelectorAll('#resume-pages .resume-page')).map((p) => {
          const origin = doc.querySelector('#resume-pages')?.getBoundingClientRect().top ?? 0;
          const r = (p as HTMLElement).getBoundingClientRect();
          return { top: Math.round(r.top - origin), height: Math.round(r.height) };
        })
      : null;
    return {
      stage: (() => {
        const r = stage.getBoundingClientRect();
        return { w: r.width, h: r.height };
      })(),
      canvas: canvas
        ? (() => {
            const r = canvas.getBoundingClientRect();
            return { w: r.width, h: r.height };
          })()
        : null,
      iframe: fr
        ? {
            w: fr.width,
            h: fr.height,
            x: fr.x,
            y: fr.y,
            ratio: fr.width ? fr.height / fr.width : 0,
          }
        : null,
      transform: cs.transform,
      stageOverflow: stage.scrollWidth - stage.clientWidth,
      doc: doc
        ? {
            sw: doc.documentElement.scrollWidth,
            cw: doc.documentElement.clientWidth,
            sh: doc.documentElement.scrollHeight,
            ch: doc.documentElement.clientHeight,
          }
        : null,
      pages,
      report: win
        ? ((win as unknown as { __paginationReport: PaginationReport | null }).__paginationReport ??
          null)
        : null,
    };
  });
}

async function resumePageHeadings(page: Page): Promise<string[][]> {
  return page.locator('iframe.preview-frame__iframe').evaluate((frame) => {
    const doc = (frame as HTMLIFrameElement).contentDocument;
    if (!doc) {
      return [];
    }
    return Array.from(doc.querySelectorAll('#resume-pages .resume-page')).map((p) =>
      Array.from(p.querySelectorAll('h2, .section__title')).map((h) => h.textContent?.trim() ?? ''),
    );
  });
}

test.describe('Dashboard tabs: contrast and focus', () => {
  test('active tab uses the navy background with white text and aria-current', async ({ page }) => {
    await doLogin(page);

    const activeTab = page.locator('.tabs__tab[aria-current="page"]');
    await expect(activeTab).toHaveText('My Resumes');
    const bg = await activeTab.evaluate((el) => getComputedStyle(el).backgroundColor);
    const color = await activeTab.evaluate((el) => getComputedStyle(el).color);
    expect(bg).toBe(NAVY);
    expect(color).toBe(WHITE);
  });

  test('hovering a tab shows the navy background with white text', async ({ page }) => {
    await doLogin(page);

    const draftsTab = page.getByRole('link', { name: 'Drafts' });
    await draftsTab.hover();
    const bg = await draftsTab.evaluate((el) => getComputedStyle(el).backgroundColor);
    const color = await draftsTab.evaluate((el) => getComputedStyle(el).color);
    expect(bg).toBe(NAVY);
    expect(color).toBe(WHITE);
  });

  test('a focused tab shows a visible outline', async ({ page }) => {
    await doLogin(page);

    const draftsTab = page.getByRole('link', { name: 'Drafts' });
    await page.locator('.head h1').click();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      const isActive = await draftsTab.evaluate((el) => el === document.activeElement);
      if (isActive) {
        break;
      }
    }

    const focused = await draftsTab.evaluate((el) => ({
      isActive: el === document.activeElement,
      visible: el.matches(':focus-visible'),
      style: getComputedStyle(el).outlineStyle,
      width: getComputedStyle(el).outlineWidth,
      color: getComputedStyle(el).outlineColor,
    }));
    expect(focused.isActive).toBe(true);
    expect(focused.visible).toBe(true);
    expect(focused.style).toBe('solid');
    expect(focused.width).toBe('2px');
    expect(focused.color).toBe(ACCENT);
  });

  test('Drafts tab navigates to the drafts list', async ({ page }) => {
    await doLogin(page);

    await page.getByRole('link', { name: 'Drafts' }).click();
    await page.waitForURL('**/resumes/drafts');
    await expect(page).toHaveTitle(/Drafts/i);
    await expect(page.getByRole('heading', { name: 'Drafts' })).toBeVisible();
  });
});

test.describe('Navigation bar', () => {
  test('the navbar exposes no Drafts item while the dashboard keeps it as a tab', async ({
    page,
  }) => {
    await doLogin(page);

    const nav = page.locator('.shell-nav');
    await expect(nav.getByRole('link', { name: 'My Resumes' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Templates' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Job Matcher' })).toBeVisible();
    expect(await nav.getByRole('link', { name: 'Drafts' }).count()).toBe(0);

    await page.goto('/resumes');
    await expect(page.locator('.tabs__tab', { hasText: 'Drafts' })).toBeVisible();
  });
});

test.describe('Create Resume A4 preview', () => {
  test('in Fit mode the preview shows one complete A4 page at a time, paginated without clipping or horizontal overflow', async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await doLogin(page);
    await page.goto('/resumes/new?templateId=t-executive-banner-burgundy');
    await waitForIframeResume(page, 'iframe.preview-frame__iframe');

    await mkdir(STABILIZATION, { recursive: true });
    const beforeDetailed = await page.locator('.preview-frame').evaluate((stage) => {
      const frame = stage.querySelector('iframe') as HTMLIFrameElement;
      const canvas = stage.querySelector('.preview-frame__canvas') as HTMLElement;
      const documentElement = frame.contentDocument!.documentElement;
      const box = (element: Element | null) => {
        if (!element) return null;
        const value = element.getBoundingClientRect();
        return { x: value.x, y: value.y, width: value.width, height: value.height };
      };
      return {
        viewport: { width: innerWidth, height: innerHeight },
        body: { clientWidth: document.body.clientWidth, scrollWidth: document.body.scrollWidth },
        document: {
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        },
        editorLayout: box(document.querySelector('.create-layout')),
        previewColumn: box(document.querySelector('.create-layout__preview')),
        frame: box(stage),
        stage: {
          clientWidth: stage.clientWidth,
          scrollWidth: stage.scrollWidth,
          overflow: stage.scrollWidth - stage.clientWidth,
        },
        canvas: { ...box(canvas), overflow: getComputedStyle(canvas).overflow },
        iframe: { ...box(frame), transform: getComputedStyle(frame).transform },
        iframeDocument: {
          clientWidth: documentElement.clientWidth,
          scrollWidth: documentElement.scrollWidth,
        },
        scrollbarWidth: innerWidth - document.documentElement.clientWidth,
      };
    });
    await writeFile(
      join(STABILIZATION, 'a4-before-measurements.json'),
      JSON.stringify(beforeDetailed, null, 2),
    );
    await page.screenshot({ path: join(STABILIZATION, 'a4-overflow-before.png'), fullPage: true });
    await waitForPreviewReady(page);
    const detailed = await page.locator('.preview-frame').evaluate((stage) => {
      const rect = (selector: string) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const value = element.getBoundingClientRect();
        return { x: value.x, y: value.y, width: value.width, height: value.height };
      };
      const frame = stage.querySelector('iframe') as HTMLIFrameElement;
      const canvas = stage.querySelector('.preview-frame__canvas') as HTMLElement;
      const documentElement = frame.contentDocument!.documentElement;
      return {
        viewport: { width: innerWidth, height: innerHeight },
        body: { clientWidth: document.body.clientWidth, scrollWidth: document.body.scrollWidth },
        document: {
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        },
        editorLayout: rect('.create-layout'),
        previewColumn: rect('.create-layout__preview'),
        frame: rect('.preview-frame'),
        stage: {
          clientWidth: stage.clientWidth,
          scrollWidth: stage.scrollWidth,
          overflow: stage.scrollWidth - stage.clientWidth,
        },
        canvas: {
          ...rect('.preview-frame__canvas'),
          overflow: getComputedStyle(canvas).overflow,
        },
        iframe: {
          ...rect('iframe.preview-frame__iframe'),
          transform: getComputedStyle(frame).transform,
        },
        iframeDocument: {
          clientWidth: documentElement.clientWidth,
          scrollWidth: documentElement.scrollWidth,
        },
        scrollbarWidth: window.innerWidth - document.documentElement.clientWidth,
      };
    });
    await writeFile(
      join(STABILIZATION, 'a4-after-measurements.json'),
      JSON.stringify(detailed, null, 2),
    );
    await page.screenshot({ path: join(STABILIZATION, 'a4-fit-after.png'), fullPage: true });

    const m = await a4FrameMetrics(page);
    expect(m.iframe).not.toBeNull();

    // The canonical sample spans multiple A4 pages, and the pagination script
    // reports a clean split: no overflowed pages, orphaned headings, clipped
    // blocks or missing sections.
    expect(m.report).not.toBeNull();
    expect(m.report!.pageCount).toBeGreaterThanOrEqual(2);
    expect(m.report!.overflowingPages).toBe(0);
    expect(m.report!.orphanedHeadings).toBe(0);
    expect(m.report!.clippedBlocks).toBe(0);
    expect(m.report!.missingSections).toBe(0);

    // Portrait A4 at a desktop size, fit-scaled (never a 900:600 thumbnail).
    expect(m.iframe!.w).toBeGreaterThan(400);
    expect(m.iframe!.w).toBeLessThan(720);
    expect(m.iframe!.ratio).toBeGreaterThan(1.38);
    expect(m.iframe!.ratio).toBeLessThan(1.45);
    // The fit transform scales the full A4 page (not a landscape thumbnail).
    expect(m.transform).toMatch(/^matrix\(0\.[1-9]/);

    // One complete A4 page fits in the viewport at a time: the canvas fits the
    // stage and the preview's document viewport is exactly one A4 sheet tall.
    expect(m.canvas!.w).toBeLessThanOrEqual(m.stage.w + 1);
    expect(m.canvas!.h).toBeLessThanOrEqual(m.stage.h + 1);
    expect(m.doc!.ch).toBe(A4_PAGE_H_PX);

    // Pagination is preserved: pages stack as full A4 sheets with a constant
    // gutter, and the only vertical scroll is the paginated flow between them,
    // so the whole resume is reachable one page at a time.
    expect(m.pages).not.toBeNull();
    expect(m.pages!).toHaveLength(m.report!.pageCount);
    for (const p of m.pages!) {
      expect(p.height).toBeGreaterThanOrEqual(A4_PAGE_H_PX - 1);
      expect(p.height).toBeLessThanOrEqual(A4_PAGE_H_PX + 1);
    }
    for (let i = 1; i < m.pages!.length; i += 1) {
      const gap = m.pages![i].top - m.pages![i - 1].top - m.pages![i - 1].height;
      expect(gap).toBeGreaterThan(0);
      expect(gap).toBeLessThan(30); // 6mm page gutters, not reflowed overflow
    }
    const lastPageBottom = m.pages![m.pages!.length - 1].top + m.pages![m.pages!.length - 1].height;
    expect(m.doc!.sh).toBeGreaterThanOrEqual(lastPageBottom - 1);
    expect(m.doc!.sh - m.doc!.ch).toBeGreaterThanOrEqual(A4_PAGE_H_PX - 2);
    expect(m.doc!.sh - m.doc!.ch).toBeLessThanOrEqual(lastPageBottom - m.doc!.ch + 2);

    // No horizontal stage scrollbar and no horizontal overflow in the resume.
    expect(m.stageOverflow).toBeLessThanOrEqual(1);
    expect(m.doc!.sw - m.doc!.cw).toBeLessThanOrEqual(1);
    await writeFile(
      join(STABILIZATION, `a4-run-${testInfo.repeatEachIndex + 1}.json`),
      JSON.stringify(
        {
          run: testInfo.repeatEachIndex + 1,
          retries: testInfo.retry,
          beforeOverflow: beforeDetailed.stage.overflow,
          afterOverflow: detailed.stage.overflow,
          iframeDocumentOverflow: m.doc!.sw - m.doc!.cw,
          pageCount: m.report!.pageCount,
        },
        null,
        2,
      ),
    );
  });

  test('Template Preview and Create Resume use the same shared A4 frame', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await doLogin(page);

    await page.goto('/templates/t-executive-banner-burgundy');
    await page.getByRole('button', { name: 'Burgundy', exact: true }).click();
    await waitForIframeResume(page, 'iframe.preview-frame__iframe');
    const tp = await a4FrameMetrics(page);
    const tpPages = await resumePageHeadings(page);

    await page.getByRole('button', { name: 'Use this template' }).click();
    await page.waitForURL(/\/resumes\/new\?templateId=/);
    await waitForIframeResume(page, 'iframe.preview-frame__iframe');
    const cr = await a4FrameMetrics(page);
    const crPages = await resumePageHeadings(page);

    // Both pages render the identical white A4 portrait surface via the same
    // component; Template Preview drives it with the same Fit calculation.
    for (const m of [tp, cr]) {
      expect(m.iframe).not.toBeNull();
      expect(m.iframe!.ratio).toBeGreaterThan(1.38);
      expect(m.iframe!.ratio).toBeLessThan(1.45);
      expect(m.doc!.sw - m.doc!.cw).toBeLessThanOrEqual(1);
    }

    // Page-for-page identity: same number of A4 pages, same section headings
    // on every page, and the same clean pagination report on both pages.
    expect(tp.report).not.toBeNull();
    expect(cr.report).not.toBeNull();
    expect(tp.report).toEqual(cr.report);
    expect(tpPages).toEqual(crPages);
  });

  test('on mobile the preview stacks above the form and recomputes Fit', async ({ page }) => {
    await page.setViewportSize({ width: 600, height: 900 });
    await doLogin(page);
    await page.goto('/resumes/new?templateId=t-executive-banner-burgundy');
    await waitForPreviewReady(page);

    const previewBox = await page.locator('.template-card').boundingBox();
    const formBox = await page.locator('.card:has(#resume-name)').boundingBox();
    expect(previewBox!.y).toBeLessThan(formBox!.y);

    const m = await a4FrameMetrics(page);
    expect(m.iframe!.w).toBeGreaterThan(300);
    expect(m.iframe!.ratio).toBeGreaterThan(1.38);
    expect(m.iframe!.ratio).toBeLessThan(1.45);
    expect(m.stageOverflow).toBeLessThanOrEqual(1);
  });
});

test.describe('Template preview stage', () => {
  test('fit mode contains the full A4 sheet without horizontal overflow', async ({ page }) => {
    await doLogin(page);
    await page.goto('/templates/t-executive-banner-burgundy');
    await page.getByRole('button', { name: 'Burgundy', exact: true }).click();
    await waitForPreviewReady(page);

    const metrics = await page.locator('.preview-frame').evaluate((stage) => {
      const canvas = stage.querySelector('.preview-frame__canvas') as HTMLElement | null;
      const stageRect = stage.getBoundingClientRect();
      const canvasRect = canvas?.getBoundingClientRect() ?? null;
      return {
        scrollW: stage.scrollWidth,
        clientW: stage.clientWidth,
        stageW: stageRect.width,
        stageH: stageRect.height,
        canvasW: canvasRect?.width ?? 0,
        canvasH: canvasRect?.height ?? 0,
      };
    });
    expect(metrics.scrollW - metrics.clientW).toBeLessThanOrEqual(1);
    expect(metrics.canvasW).toBeGreaterThan(0);
    expect(metrics.canvasW).toBeLessThanOrEqual(metrics.stageW);
    expect(metrics.canvasH).toBeLessThanOrEqual(metrics.stageH);
  });

  test('the header actions and zoom controls are visible within the viewport', async ({ page }) => {
    await doLogin(page);
    await page.goto('/templates/t-executive-banner-burgundy');
    await waitForIframeResume(page, 'iframe.preview-frame__iframe');

    const useButton = page.getByRole('button', { name: 'Use this template' });
    const box = await useButton.boundingBox();
    const viewport = page.viewportSize()!;
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    await expect(useButton).toBeVisible();
  });
});

test.describe('Editor toolbar', () => {
  test('controls share equal heights, consistent gaps, and a back link on the left', async ({
    page,
  }) => {
    await doLogin(page);
    await page.getByRole('button', { name: 'Open' }).click();
    await expect(page).toHaveTitle(/Resume Editor/i);
    await expect(page.locator('#editor-section-contact')).toBeVisible();
    await expect(page.locator('.editor__save-label')).toHaveText('Saved');

    await expect(page.locator('.editor__bar .back-link')).toHaveText('← My Resumes');
    await expect(page.locator('.editor__bar .back-link')).toHaveAttribute('href', '/resumes');

    const metrics = await page.locator('.editor__actions').evaluate((el) => {
      const buttons = Array.from(el.querySelectorAll<HTMLElement>('button.app-button'));
      const heights = buttons.map((b) => Math.round(b.getBoundingClientRect().height));
      return {
        count: buttons.length,
        heights,
        gap: getComputedStyle(el).gap,
      };
    });
    expect(metrics.count).toBeGreaterThanOrEqual(2);
    expect(Math.max(...metrics.heights) - Math.min(...metrics.heights)).toBeLessThanOrEqual(1);
    expect(metrics.gap).toBe('12px');
  });

  test('the saved editor keeps only the actions: no metadata, badge or visible status text', async ({
    page,
  }) => {
    await doLogin(page);
    await page.getByRole('button', { name: 'Open' }).click();
    await expect(page).toHaveTitle(/Resume Editor/i);

    // Wait for the editor to render rather than reading the actions mid-load.
    await expect(page.locator('#editor-section-contact')).toBeVisible();
    await expect(page.locator('.editor__save-label.sr-only')).toHaveText('Saved', {
      timeout: 10_000,
    });

    await expect(page.locator('.editor__context')).toHaveCount(0);
    await expect(page.locator('.editor__template')).toHaveCount(0);
    await expect(page.locator('.editor__status')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save resume' })).toHaveCount(0);

    const actions = await page
      .locator('.editor__bar .editor__actions button.app-button')
      .allTextContents();
    expect(actions.join(' ')).toContain('Change template');
    expect(actions.join(' ')).toContain('Download PDF');

    // The autosave status lives only in the visually hidden live region.
    await expect(page.locator('.editor__save-label.sr-only')).toHaveText('Saved');

    const visible = await visibleText(page);
    for (const gone of ['Master Resume', 'Master version', 'Classic ATS — Navy', 'Saved']) {
      expect(visible).not.toContain(gone);
    }
  });

  test('a fresh draft shows Save resume, no visible Draft badge, and a disabled PDF export', async ({
    page,
  }) => {
    await doLogin(page);
    await page.goto('/templates');
    await expect(page.getByRole('heading', { name: /Templates/i })).toBeVisible();

    const card = page.locator('article.card', { hasText: 'Classic ATS' });
    await card.getByRole('button', { name: 'Preview & customise' }).click();
    await expect(page).toHaveURL(/\/templates\/t-classic-ats-navy/);
    await page.locator('app-button', { hasText: 'Use this template' }).click();
    await expect(page).toHaveURL(/\/resumes\/new\?templateId=t-classic-ats-navy/);

    await page.locator('input[type="text"]').fill('Regression Draft');
    await page.locator('app-button', { hasText: /Create and edit/i }).click();
    await expect(page).toHaveURL(/\/resumes\/[^/]+\/versions\/[^/]+\/edit/);

    // No visible Draft/status chip in the simplified header.
    await expect(page.locator('.editor__status')).toHaveCount(0);
    const visible = await visibleText(page);
    expect(visible).not.toContain('Draft');

    await expect(page.locator('.editor__save-label.sr-only')).toHaveText('Draft saved', {
      timeout: 10_000,
    });
    await expect(page.getByRole('button', { name: 'Save resume' })).toBeVisible();

    const pdfIsDisabled = await page.getByRole('button', { name: 'Download PDF' }).isDisabled();
    expect(pdfIsDisabled).toBe(true);

    // Explicit promotion hides Save resume without replacing it with a badge.
    await page.getByRole('button', { name: 'Save resume' }).click();
    await expect(page.getByRole('button', { name: 'Save resume' })).toHaveCount(0);
    await expect(page.locator('.editor__status')).toHaveCount(0);
    await expect(page.locator('.editor__save-label.sr-only')).toHaveText('Saved', {
      timeout: 10_000,
    });
    await expect(page.getByRole('button', { name: 'Change template' })).toBeVisible();
    // Content is still empty after promotion, so PDF export stays content-gated.
    await expect(page.getByRole('button', { name: 'Download PDF' })).toBeDisabled();
  });
});
