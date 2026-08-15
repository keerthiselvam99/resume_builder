import { expect, test, Page } from '@playwright/test';

const DEMO_EMAIL = 'arun@example.com';
const DEMO_PASSWORD = 'Password123!';

// Rendered (whitespace-normalized) inside .editor__actions in demo mode.
const DEMO_MESSAGE =
  'PDF download requires the local backend. Start the full application to export your resume.';

test('pdf export (mock UI): Download PDF is disabled with a pointer to the full app', async ({
  page,
}) => {
  await doLogin(page);
  await openEditor(page);

  // Demo mode must not fire a network export request at all: a real request
  // would go through the dev-server proxy to a backend that is not running.
  await page.route('**/api/v1/versions/*/pdf', (route) =>
    route.fulfill({ status: 500, body: 'must not be reached in demo mode' }),
  );

  const button = page.getByRole('button', { name: 'Download PDF' });
  await expect(button).toBeVisible();
  await expect(button).toBeDisabled();

  // The explanatory hint is visible (not just sr-only) and the status area is
  // idle — no failed download attempt happens.
  await expect(page.locator('.editor__pdf-label')).toHaveText(DEMO_MESSAGE);
  await expect(page.locator('.editor__pdf-label--error')).toHaveCount(0);
});

async function doLogin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('app-input input').fill(DEMO_EMAIL);
  await page.locator('app-password-input input').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
}

async function openEditor(page: Page): Promise<void> {
  await expect(page.getByRole('heading', { name: /My Resumes/i })).toBeVisible();
  await page.getByRole('button', { name: 'Open' }).click();
  await expect(page).toHaveTitle(/Resume Editor/i);
  await expect(page.locator('#editor-section-contact')).toBeVisible();
  await expect(page.locator('.editor__save-label')).toHaveText('Saved');
}
