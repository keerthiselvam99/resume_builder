import { expect, test, Page } from '@playwright/test';
import { LAYOUT_ORDER } from '../src/app/core/templates/template-catalogue';

const DEMO_EMAIL = 'arun@example.com';
const DEMO_PASSWORD = 'Password123!';

test.use({ viewport: { width: 1440, height: 900 } });

async function doLogin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.locator('app-input input').fill(DEMO_EMAIL);
  await page.locator('app-password-input input').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/resumes');
}

async function openTemplatePreview(page: Page, templateId: string): Promise<void> {
  await page.goto(`/templates/${templateId}`);
  await waitForIframeContent(page, 'iframe.preview-frame__iframe');
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

async function waitForImages(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const viewport = window.innerHeight;
    return Array.from(document.images).every((img) => {
      const rect = img.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > viewport) {
        return true;
      }
      return img.complete && img.naturalWidth > 0;
    });
  });
}

test.describe('visual regression baselines — approved views', () => {
  test('gallery', async ({ page }) => {
    await doLogin(page);
    await page.getByRole('link', { name: 'Templates' }).click();
    await page.waitForURL('/templates');
    await page.getByRole('heading', { name: /Templates/i }).waitFor();
    await waitForImages(page);
    await expect(page).toHaveScreenshot('1-gallery.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });

  test('template preview — burgundy', async ({ page }) => {
    await doLogin(page);
    await page.goto('/templates/t-executive-banner-burgundy');
    await page.getByRole('button', { name: 'Burgundy', exact: true }).click();
    await waitForIframeContent(page, 'iframe.preview-frame__iframe');
    await expect(page).toHaveScreenshot('3-template-preview-burgundy.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });

  test('create resume', async ({ page }) => {
    await doLogin(page);
    await page.goto('/resumes/new?templateId=t-executive-banner-burgundy');
    await waitForIframeContent(page, 'iframe.preview-frame__iframe');
    await expect(page).toHaveScreenshot('4-create-resume.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });

  test('editor empty state', async ({ page }) => {
    await doLogin(page);
    await page.goto('/resumes/new?templateId=t-executive-banner-burgundy');
    await page.locator('#resume-name').fill('Portfolio Resume');
    await page.locator('app-button', { hasText: /Create and edit/i }).click();
    await page.waitForURL(/\/resumes\/[^/]+\/versions\/[^/]+\/edit/);
    await page
      .getByRole('heading', { name: 'Start entering your details' })
      .waitFor({ timeout: 15000 });
    await page.getByRole('button', { name: 'Change template' }).waitFor();
    await expect(page).toHaveScreenshot('5-editor-empty-state.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });

  test('my resumes', async ({ page }) => {
    await doLogin(page);
    await page.getByLabel('Primary').getByRole('link', { name: 'My Resumes' }).click();
    await page.waitForURL('**/resumes');
    await page.getByRole('heading', { name: 'My Resumes' }).waitFor();
    await waitForImages(page);
    await expect(page).toHaveScreenshot('7-my-resumes.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });

  test('editor after template change', async ({ page }) => {
    // This multi-step journey (list -> open seeded resume -> template change ->
    // apply new template) exceeds the 30s default on a cold mock server, so it
    // used to die on a timeout instead of reaching the screenshot comparison.
    test.setTimeout(120_000);
    await doLogin(page);
    await page.getByLabel('Primary').getByRole('link', { name: 'My Resumes' }).click();
    await page.waitForURL('**/resumes');
    const masterCard = page.locator('article.card', { hasText: 'Master Resume' }).first();
    await masterCard.getByRole('button', { name: 'Open' }).click();
    await page.waitForURL(/\/resumes\/[^/]+\/versions\/[^/]+\/edit/);
    await waitForIframeContent(page, 'iframe.preview__iframe');

    await page.getByRole('button', { name: 'Change template' }).click();
    await page.waitForURL(/\/templates\?mode=change/);
    await page.getByRole('heading', { name: /Choose a new template for Master Resume/ }).waitFor();
    await page
      .locator('article.card', { hasText: 'Premium Sidebar' })
      .getByRole('button', { name: 'Preview & customise' })
      .click();
    await page.waitForURL(/\/templates\/t-premium-sidebar-navy\?mode=change/);
    await page.getByRole('button', { name: 'Apply this template' }).click();
    await page.waitForURL(/\/resumes\/[^/]+\/versions\/[^/]+\/edit/);
    await waitForIframeContent(page, 'iframe.preview__iframe');

    await expect(page).toHaveScreenshot('6-editor-after-template-change.png', {
      animations: 'disabled',
      maxDiffPixelRatio: 0.02,
    });
  });
});

test.describe('template preview baselines — Navy per family', () => {
  for (const family of LAYOUT_ORDER) {
    test(`preview — ${family} (navy)`, async ({ page }) => {
      await doLogin(page);
      await openTemplatePreview(page, `t-${family}-navy`);
      await expect(page).toHaveScreenshot(`preview-${family}-navy.png`, {
        animations: 'disabled',
        maxDiffPixelRatio: 0.02,
      });
    });
  }
});
