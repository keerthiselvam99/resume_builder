import { expect, test, Page } from '@playwright/test';
import { waitForPreviewReady } from './support/preview-ready';

const DEMO_EMAIL = 'arun@example.com';
const DEMO_PASSWORD = 'Password123!';

async function doLogin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('app-input input').fill(DEMO_EMAIL);
  await page.locator('app-password-input input').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/resumes');
}

async function openTemplatePreview(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Templates' }).click();
  await expect(page).toHaveURL('/templates');
  await page.waitForLoadState('networkidle');
  const card = page.locator('article.card', { hasText: 'Executive Banner' });
  await card.getByRole('button', { name: 'Preview & customise' }).click();
  await expect(page).toHaveURL(/\/templates\/t-executive-banner-navy/);
  await expect(page.locator('iframe.preview-frame__iframe')).toBeVisible();
}

test.describe('Template preview controls', () => {
  test('theme changes keep the full A4 sheet contained without scrollbars', async ({ page }) => {
    await doLogin(page);
    await openTemplatePreview(page);

    await page.getByRole('button', { name: 'Teal' }).click();
    await waitForPreviewReady(page);

    const metrics = await page.locator('.preview-frame').evaluate((el) => {
      const canvas = el.querySelector('.preview-frame__canvas') as HTMLElement | null;
      const stageRect = el.getBoundingClientRect();
      const canvasRect = canvas?.getBoundingClientRect() ?? null;
      return {
        scrollW: el.scrollWidth,
        clientW: el.clientWidth,
        scrollH: el.scrollHeight,
        clientH: el.clientHeight,
        canvasW: canvasRect?.width ?? 0,
        canvasH: canvasRect?.height ?? 0,
        stageW: stageRect.width,
        stageH: stageRect.height,
      };
    });
    expect(metrics.scrollW - metrics.clientW).toBeLessThanOrEqual(1);
    expect(metrics.scrollH - metrics.clientH).toBeLessThanOrEqual(2);
    expect(metrics.canvasW).toBeGreaterThan(0);
    expect(metrics.canvasW).toBeLessThanOrEqual(metrics.stageW);
    expect(metrics.canvasH).toBeLessThanOrEqual(metrics.stageH);
  });

  test('fit mode produces no horizontal scrollbar in the template preview', async ({ page }) => {
    await doLogin(page);
    await openTemplatePreview(page);
    await waitForPreviewReady(page);

    const stage = page.locator('.preview-frame');
    const noHorizontalOverflow = await stage.evaluate((el) => {
      return el.scrollWidth - el.clientWidth <= 1;
    });
    expect(noHorizontalOverflow).toBe(true);
  });

  test('fit mode produces no horizontal scrollbar in the editor preview', async ({ page }) => {
    await doLogin(page);
    await expect(page.getByRole('heading', { name: /My Resumes/i })).toBeVisible();
    await page.getByRole('button', { name: 'Open' }).click();
    await expect(page).toHaveTitle(/Resume Editor/i);

    const viewport = page.locator('.preview__viewport');
    await expect(viewport).toBeVisible();
    const noHorizontalOverflow = await viewport.evaluate((el) => {
      return el.scrollWidth - el.clientWidth <= 1;
    });
    expect(noHorizontalOverflow).toBe(true);
  });
});

test.describe('Empty editor preview', () => {
  test('a fresh resume shows the helpful empty state, not a blank page', async ({ page }) => {
    await doLogin(page);
    await page.getByRole('link', { name: 'Templates' }).click();
    await expect(page).toHaveURL('/templates');
    await page.waitForLoadState('networkidle');

    const classicCard = page.locator('article.card', { hasText: 'Classic ATS' });
    await classicCard.getByRole('button', { name: 'Preview & customise' }).click();
    await expect(page).toHaveURL(/\/templates\/t-classic-ats-navy/);
    await page.locator('app-button', { hasText: 'Use this template' }).click();
    await expect(page).toHaveURL(/\/resumes\/new\?templateId=t-classic-ats-navy/);

    await page.locator('input[type="text"]').fill('Empty Resume');
    await page.locator('app-button', { hasText: /Create and edit/i }).click();
    await expect(page).toHaveURL(/\/resumes\/[^/]+\/versions\/[^/]+\/edit/);

    await expect(page.getByRole('heading', { name: 'Start entering your details' })).toBeVisible();
    await expect(page.locator('iframe.preview__iframe')).toHaveCount(0);
  });
});
