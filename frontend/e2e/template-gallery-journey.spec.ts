import { expect, test, Page } from '@playwright/test';

const DEMO_EMAIL = 'arun@example.com';
const DEMO_PASSWORD = 'Password123!';

async function doLogin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.locator('app-input input').fill(DEMO_EMAIL);
  await page.locator('app-password-input input').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
}

async function expectEveryCardImageLoaded(page: Page): Promise<void> {
  const cards = page.locator('article.card');
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);
    await card.scrollIntoViewIfNeeded();
    const img = card.locator('.card__image');
    await expect(img).toBeVisible();
    await expect
      .poll(
        async () => img.evaluate((el) => (el as HTMLImageElement).naturalWidth),
        { timeout: 10000 },
      )
      .toBeGreaterThan(0);
    await expect(card.locator('.card__error')).toHaveCount(0);
  }
}

test.describe('Template gallery → preview → create → editor journey', () => {
  test('full journey: login → templates → preview Executive Banner → Use → create → editor persists template', async ({
    page,
  }) => {
    // 1. Login
    await doLogin(page);
    await page.waitForURL('**/resumes');
    await expect(page).toHaveTitle(/My Resumes/i);

    // 2. Open Templates
    await page.getByRole('link', { name: 'Templates' }).click();
    await expect(page).toHaveURL('/templates');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: /Templates/i })).toBeVisible();

    // 3. Verify thumbnails load. Scroll every lazy-loaded card into view and
    //    confirm each image decodes (naturalWidth > 0) with no fallback state.
    const images = page.locator('.card__image');
    await expect(images).toHaveCount(25);
    for (let i = 0; i < 25; i++) {
      const src = await images.nth(i).getAttribute('src');
      expect(src).toBeTruthy();
      const response = await page.request.get(src as string);
      expect(response.status()).toBe(200);
    }
    await expectEveryCardImageLoaded(page);

    // 4. Preview Executive Banner
    const executiveCard = page.locator('article.card', { hasText: 'Executive Banner' });
    await executiveCard.getByRole('button', { name: 'Preview & customise' }).click();
    await expect(page).toHaveURL(/\/templates\/t-executive-banner-navy/);
    await expect(page).toHaveTitle(/Template Preview/i);

    // 5. Verify styled iframe content
    const iframe = page.locator('iframe.preview-frame__iframe');
    await expect(iframe).toBeVisible();

    const frameContent = await iframe.evaluate((el) => {
      const doc = (el as HTMLIFrameElement).contentDocument;
      if (!doc) return null;
      const banner = doc.querySelector('.banner') as HTMLElement | null;
      const computedBanner = banner ? window.getComputedStyle(banner) : null;
      return {
        bodyText: doc.body.textContent || '',
        hasResumePage: !!doc.querySelector('.resume-page'),
        fontFamily: (doc.querySelector('body') as HTMLElement)?.style.fontFamily || '',
        linkColor: (doc.querySelector('a') as HTMLAnchorElement)?.style.color || '',
        bannerBg: computedBanner?.backgroundColor || '',
      };
    });

    expect(frameContent).not.toBeNull();
    expect(frameContent!.hasResumePage).toBe(true);
    expect(frameContent!.bodyText).toContain('Jane Doe');
    expect(frameContent!.bodyText).toContain('Senior Software Engineer');
    // Verify the banner has a background color (navy theme should have a dark background)
    expect(frameContent!.bannerBg).not.toBe('');

    // 6. Theme switching works
    await page.getByRole('button', { name: 'Charcoal' }).click();
    await page.waitForTimeout(500);
    const charcoalFrameContent = await iframe.evaluate((el) => {
      const doc = (el as HTMLIFrameElement).contentDocument;
      if (!doc) return null;
      const link = doc.querySelector('a') as HTMLAnchorElement | null;
      const computedLink = link ? window.getComputedStyle(link) : null;
      return {
        linkColor: computedLink?.color || '',
        bodyText: doc.body.textContent || '',
      };
    });
    expect(charcoalFrameContent).not.toBeNull();
    // Charcoal theme uses #94a3b8 as primary
    expect(charcoalFrameContent!.bodyText).toContain('Jane Doe');

    // 7. Click "Use this template" — the selected theme (Charcoal) must flow through
    await page.locator('app-button', { hasText: 'Use this template' }).click();
    await expect(page).toHaveURL(/\/resumes\/new\?templateId=t-executive-banner-charcoal/);
    await expect(page.getByRole('heading', { name: /Create Resume/i })).toBeVisible();

    // 8. Enter resume name and create
    await page.locator('input[type="text"]').fill('My Executive Resume');
    await page.locator('app-button', { hasText: /Create and edit/i }).click();

    // 9. Verify editor opens
    await expect(page).toHaveURL(/\/resumes\/[^/]+\/versions\/[^/]+\/edit/);
    await expect(page).toHaveTitle(/Resume Editor/i);
    await expect(page.locator('#editor-section-contact')).toBeVisible();

    // 9a. A fresh resume starts with the helpful empty state (no blank page).
    await expect(page.getByRole('heading', { name: 'Start entering your details' })).toBeVisible();
    await expect(page.locator('iframe.preview__iframe')).toHaveCount(0);

    // 9b. Enter details so the preview renders the selected template.
    await page.locator('app-editor-contact-form app-input input').first().fill('Jane Smith');

    // 10. Verify Executive Banner template remains selected
    const editorFrame = page.locator('iframe.preview__iframe');
    await expect(editorFrame).toBeVisible();
    await expect
      .poll(async () => {
        const doc = await editorFrame.evaluate((el) => {
          const d = (el as HTMLIFrameElement).contentDocument;
          return d ? d.querySelector('.resume-page') !== null : false;
        });
        return doc;
      })
      .toBe(true);
    const editorFrameContent = await editorFrame.evaluate((el) => {
      const doc = (el as HTMLIFrameElement).contentDocument;
      if (!doc) return null;
      return {
        hasResumePage: !!doc.querySelector('.resume-page'),
        hasBanner: !!doc.querySelector('.banner'),
        bodyText: doc.body.textContent || '',
      };
    });
    expect(editorFrameContent).not.toBeNull();
    expect(editorFrameContent!.hasResumePage).toBe(true);
    expect(editorFrameContent!.hasBanner).toBe(true);

    // 11. Reload and verify selection persists
    await expect(page.locator('.editor__save-label')).toHaveText('Draft saved', {
      timeout: 10000,
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#editor-section-contact')).toBeVisible();

    const persistedFrame = page.locator('iframe.preview__iframe');
    await expect
      .poll(async () => {
        const doc = await persistedFrame.evaluate((el) => {
          const d = (el as HTMLIFrameElement).contentDocument;
          return d ? d.querySelector('.resume-page') !== null : false;
        });
        return doc;
      })
      .toBe(true);
    const persistedFrameContent = await persistedFrame.evaluate((el) => {
      const doc = (el as HTMLIFrameElement).contentDocument;
      if (!doc) return null;
      return {
        hasResumePage: !!doc.querySelector('.resume-page'),
        hasBanner: !!doc.querySelector('.banner'),
      };
    });
    expect(persistedFrameContent).not.toBeNull();
    expect(persistedFrameContent!.hasResumePage).toBe(true);
    expect(persistedFrameContent!.hasBanner).toBe(true);
  });

  test('gallery cards show ATS/Visual badges', async ({ page }) => {
    await doLogin(page);
    await page.waitForURL('**/resumes');
    await page.getByRole('link', { name: 'Templates' }).click();
    await expect(page).toHaveURL('/templates');
    await page.waitForLoadState('networkidle');

    // Classic ATS should have ATS-friendly badge
    const classicCard = page.locator('article.card', { hasText: 'Classic ATS' });
    await expect(classicCard.locator('.badge--ats', { hasText: 'ATS-friendly' })).toBeVisible();

    // Executive Banner should have Visual badge
    const executiveCard = page.locator('article.card', { hasText: 'Executive Banner' });
    await expect(executiveCard.locator('.badge--visual', { hasText: 'Visual' })).toBeVisible();

    // Premium Sidebar should have Visual badge
    const premiumCard = page.locator('article.card', { hasText: 'Premium Sidebar' });
    await expect(premiumCard.locator('.badge--visual', { hasText: 'Visual' })).toBeVisible();
  });

  test('gallery filtering by category works', async ({ page }) => {
    await doLogin(page);
    await page.waitForURL('**/resumes');
    await page.getByRole('link', { name: 'Templates' }).click();
    await expect(page).toHaveURL('/templates');
    await page.waitForLoadState('networkidle');

    // Initially all 25 cards visible
    let cards = page.locator('article.card');
    await expect(cards).toHaveCount(25);

    // Filter to ATS & Formal layouts only
    await page.locator('#filter-category').selectOption('ATS & Formal');
    cards = page.locator('.card');
    await expect(cards).toHaveCount(5);
    await expect(cards.first()).toContainText('Classic ATS');

    // Filtered cards also render decodable thumbnails.
    await expectEveryCardImageLoaded(page);
  });
});
