import { expect, test, Page } from '@playwright/test';

const DEMO_EMAIL = 'arun@example.com';
const DEMO_PASSWORD = 'Password123!';

async function doLogin(page: Page): Promise<void> {
  await page.goto('/login');
  await page.locator('app-input input').fill(DEMO_EMAIL);
  await page.locator('app-password-input input').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/resumes');
}

test.describe('My Resumes page', () => {
  test('shows the full resume management screen, not Coming soon', async ({ page }) => {
    await doLogin(page);

    await page.getByLabel('Primary').getByRole('link', { name: 'My Resumes' }).click();
    await page.waitForURL('**/resumes');
    await expect(page).toHaveTitle(/My Resumes/i);
    await expect(page.getByRole('heading', { name: 'My Resumes' })).toBeVisible();

    const body = await page.locator('body').innerText();
    expect(body).not.toContain('Coming soon');

    // Populated state: seeded resume card with all management actions
    await expect(page.locator('article.card', { hasText: 'Master Resume' })).toBeVisible();
    const masterCard = page.locator('article.card', { hasText: 'Master Resume' });
    await expect(masterCard.getByRole('button', { name: 'Open' })).toBeVisible();
    await expect(masterCard.getByRole('button', { name: 'Clone' })).toBeVisible();
    await expect(masterCard.getByRole('button', { name: 'Rename' })).toBeVisible();
    await expect(masterCard.getByRole('button', { name: 'Delete' })).toBeVisible();

    // Create CTA leads to the templates gallery
    await page.getByRole('button', { name: '+ New resume' }).click();
    await expect(page).toHaveURL('/templates');
  });

  test('shows the empty state with a create CTA when no resumes exist', async ({ page }) => {
    await doLogin(page);

    await page.evaluate(() => localStorage.setItem('resumeiq_resumes', '[]'));
    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.getByLabel('Primary').getByRole('link', { name: 'My Resumes' }).click();
    await page.waitForURL('**/resumes');
    await expect(page.getByRole('heading', { name: 'No saved resumes yet' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create your first resume' })).toBeVisible();
  });

  test('opens the master version of a resume from the list', async ({ page }) => {
    await doLogin(page);

    await page.getByLabel('Primary').getByRole('link', { name: 'My Resumes' }).click();
    await page.waitForURL('**/resumes');

    const masterCard = page.locator('article.card', { hasText: 'Master Resume' });
    await masterCard.getByRole('button', { name: 'Open' }).click();
    await expect(page).toHaveURL(/\/resumes\/[^/]+\/versions\/[^/]+\/edit/);
    await expect(page.locator('#editor-section-contact')).toBeVisible();
  });
});
