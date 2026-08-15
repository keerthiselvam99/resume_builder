import { expect, test, Page } from '@playwright/test';

const DEMO_EMAIL = 'arun@example.com';
const DEMO_PASSWORD = 'Password123!';

const NEW_SUMMARY = 'Persistence-check summary edited during the editor journey.';
const UNIQUE_SKILL = 'Playwright E2E';

async function doLogin(page: Page): Promise<void> {
  await page.locator('app-input input').fill(DEMO_EMAIL);
  await page.locator('app-password-input input').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
}

test('editor persistence: edit summary + add skill, save, reload, changes remain', async ({
  page,
}) => {
  // Clear localStorage once, at test initialization, so persistence through
  // reload can be verified deterministically against the seeded mock data.
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await doLogin(page);

  // Open the seeded resume in the editor.
  await expect(page.getByRole('heading', { name: /My Resumes/i })).toBeVisible();
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page).toHaveTitle(/Resume Editor/i);
  await expect(page.locator('#editor-section-contact')).toBeVisible();

  // Edit the summary -> the preview updates immediately.
  const summaryTextarea = page.locator('app-editor-summary-form textarea');
  const previewFrame = page.locator('iframe.preview__iframe');

  await summaryTextarea.fill(NEW_SUMMARY);

  // Verify preview iframe srcdoc contains the new summary
  const srcdoc = await previewFrame.getAttribute('srcdoc');
  expect(srcdoc).toContain(NEW_SUMMARY);

  // Add a unique skill via the skills form (Enter to add).
  const skillInput = page.locator('app-editor-skills-form app-input input');
  await skillInput.fill(UNIQUE_SKILL);
  await skillInput.press('Enter');
  await expect(
    page.locator('app-editor-skills-form .chip').filter({ hasText: UNIQUE_SKILL }),
  ).toBeVisible();

  // Wait for autosave to report Saved.
  await expect(page.locator('.editor__save-label')).toHaveText('Saved');

  // Reload -> the edit and skill must persist.
  await page.reload();
  await expect(page).toHaveTitle(/Resume Editor/i);

  await expect(summaryTextarea).toHaveValue(NEW_SUMMARY);
  await expect(
    page.locator('app-editor-skills-form .chip').filter({ hasText: UNIQUE_SKILL }),
  ).toBeVisible();
  await expect(page.locator('.editor__save-label')).toHaveText('Saved');
});
