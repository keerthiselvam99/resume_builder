import { expect, test, Page } from '@playwright/test';

const DEMO_EMAIL = 'arun@example.com';
const DEMO_PASSWORD = 'Password123!';

async function doLogin(page: Page): Promise<void> {
  await page.locator('app-input input').fill(DEMO_EMAIL);
  await page.locator('app-password-input input').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
}

test('authenticated journey: login -> My Resumes -> "+ New resume" opens the templates gallery', async ({
  page,
}) => {
  await page.goto('/login');

  await doLogin(page);

  // Lands on My Resumes with the seeded resume.
  await expect(page).toHaveTitle(/My Resumes/i);
  await expect(page.getByRole('heading', { name: /My Resumes/i })).toBeVisible();
  await expect(page.getByText('Master Resume')).toBeVisible();

  // "+ New resume" must open the template gallery, never silently create a resume.
  await page.getByRole('button', { name: '+ New resume' }).click();
  await expect(page).toHaveURL('/templates');
  await expect(page.getByRole('heading', { name: /Templates/i })).toBeVisible();
});

test('empty state: "Create your first resume" opens the templates gallery', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('resumeiq_resumes', '[]');
  });

  await page.goto('/login');
  await doLogin(page);

  await expect(page).toHaveTitle(/My Resumes/i);
  await expect(page.getByRole('heading', { name: /No saved resumes yet/i })).toBeVisible();

  await page.getByRole('button', { name: 'Create your first resume' }).click();
  await expect(page).toHaveURL('/templates');
  await expect(page.getByRole('heading', { name: /Templates/i })).toBeVisible();
});
