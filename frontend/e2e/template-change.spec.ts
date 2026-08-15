import { expect, test, Page } from '@playwright/test';

const DEMO_EMAIL = 'arun@example.com';
const DEMO_PASSWORD = 'Password123!';
const EDITOR_URL = '/resumes/r-master/versions/v-master/edit';
const NEW_SUMMARY = 'Summary edited before changing template.';

async function doLogin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('app-input input').fill(DEMO_EMAIL);
  await page.locator('app-password-input input').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/resumes');
}

async function openSeededResume(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: /My Resumes/i })).toBeVisible();
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page).toHaveURL(EDITOR_URL);
  await expect(page.locator('#editor-section-contact')).toBeVisible();
}

async function previewHasBanner(page: Page): Promise<boolean> {
  const frame = page.locator('iframe.preview__iframe');
  return frame.evaluate((el) => {
    const doc = (el as HTMLIFrameElement).contentDocument;
    return doc ? doc.querySelector('.banner') !== null : false;
  });
}

test.describe('Change template from the editor', () => {
  test('applies a new template, keeps content, and persists after reload', async ({ page }) => {
    await doLogin(page);
    await openSeededResume(page);

    // Seeded resume starts on Classic ATS (no banner).
    await expect.poll(() => page.locator('iframe.preview__iframe').count()).toBeGreaterThan(0);
    expect(await previewHasBanner(page)).toBe(false);

    // 1. Open the gallery in change mode from the editor.
    await page.getByRole('button', { name: 'Change template' }).click();
    await expect(page).toHaveURL(/\/templates\?mode=change/);
    await expect(page).toHaveURL(/resumeId=r-master/);
    await expect(page).toHaveURL(/versionId=v-master/);
    await expect(page).toHaveURL(/returnUrl=%2Fresumes%2Fr-master%2Fversions%2Fv-master%2Fedit/);
    await expect(
      page.getByRole('heading', { name: 'Choose a new template for Master Resume' }),
    ).toBeVisible();

    // 2. Pick the Executive Banner layout.
    const executiveCard = page.locator('article.card', { hasText: 'Executive Banner' });
    await executiveCard.getByRole('button', { name: 'Preview & customise' }).click();
    await expect(page).toHaveURL(/\/templates\/t-executive-banner-navy/);

    // 3. Apply instead of creating a new resume.
    await expect(page.locator('app-button', { hasText: 'Apply this template' })).toBeVisible();
    await page.locator('app-button', { hasText: 'Apply this template' }).click();

    // 4. Return to the SAME editor URL with the new template applied.
    await expect(page).toHaveURL(EDITOR_URL);
    await expect.poll(() => previewHasBanner(page)).toBe(true);

    // 5. Resume content is unchanged.
    const srcdoc = await page.locator('iframe.preview__iframe').getAttribute('srcdoc');
    expect(srcdoc).toContain('Full-stack developer with 5 years of experience');

    // 6. The selected template persists after reload.
    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#editor-section-contact')).toBeVisible();
    await expect.poll(() => previewHasBanner(page)).toBe(true);
  });

  test('flushes unsaved edits before navigating to Templates', async ({ page }) => {
    await doLogin(page);
    await openSeededResume(page);

    // Make an unsaved edit.
    const summary = page.locator('app-editor-summary-form textarea');
    await summary.fill(NEW_SUMMARY);
    await expect(page.locator('.editor__save-label')).toHaveText('Unsaved changes');

    // Leave via Change template — edits must be flushed and persisted first.
    await page.getByRole('button', { name: 'Change template' }).click();
    await expect(page).toHaveURL(/\/templates\?mode=change/);
    await expect(
      page.getByRole('heading', { name: 'Choose a new template for Master Resume' }),
    ).toBeVisible();

    // The flushed edit is already persisted to the store.
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('resumeiq_versions');
      if (!raw) return null;
      const versions = JSON.parse(raw) as { id: string; content: { summary: string } }[];
      return versions.find((v) => v.id === 'v-master') ?? null;
    });
    expect(stored?.content.summary).toBe(NEW_SUMMARY);

    // Returning to the editor shows the saved summary as the current value.
    await page.goto(EDITOR_URL);
    await expect(page.locator('app-editor-summary-form textarea')).toHaveValue(NEW_SUMMARY);
    await expect(page.locator('.editor__save-label')).toHaveText('Saved');
  });
});
