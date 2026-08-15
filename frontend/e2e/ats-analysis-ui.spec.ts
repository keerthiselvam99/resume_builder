import { expect, test, Page } from '@playwright/test';

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

async function createBlankResume(page: Page): Promise<void> {
  await page.getByRole('link', { name: 'Templates' }).click();
  await expect(page).toHaveURL('/templates');
  await page.waitForLoadState('networkidle');

  const classicCard = page.locator('article.card', { hasText: 'Classic ATS' });
  await classicCard.getByRole('button', { name: 'Preview & customise' }).click();
  await expect(page).toHaveURL(/\/templates\/t-classic-ats-navy/);
  await page.locator('app-button', { hasText: 'Use this template' }).click();
  await expect(page).toHaveURL(/\/resumes\/new\?templateId=t-classic-ats-navy/);

  await page.locator('input[type="text"]').fill('Blank Resume');
  await page.locator('app-button', { hasText: /Create and edit/i }).click();
  await expect(page).toHaveURL(/\/resumes\/[^/]+\/versions\/[^/]+\/edit/);
}

test.describe('Mock ATS analysis panel', () => {
  test('a blank resume gets a low score and offers a "Focus first issue" action', async ({
    page,
  }) => {
    await doLogin(page);
    await createBlankResume(page);

    const panel = page.locator('.ats-panel');
    await panel.getByRole('button', { name: 'Run analysis' }).click();

    const score = panel.locator('.ats-score');
    await expect(score).toBeVisible();
    await expect(score).toHaveAttribute('aria-valuenow', '42');

    // The improve call to action appears together with the low score.
    const improveCta = panel.getByRole('button', { name: 'Focus first issue' });
    await expect(improveCta).toBeVisible();

    // Clicking it scrolls the top finding's section (Work experience — the
    // largest points loss on a blank resume) into view and focuses its first
    // actionable control: the "Add experience" button.
    await improveCta.click();
    const experienceSection = page.locator('#editor-section-experience');
    await expect(experienceSection.locator('button').first()).toBeFocused();
    await expect
      .poll(() =>
        experienceSection.evaluate((el) => {
          const rect = el.getBoundingClientRect();
          return rect.top >= 0 && rect.top < window.innerHeight && rect.bottom > 0;
        }),
      )
      .toBe(true);
  });

  test('a populated resume keeps its high score and hides the improve action', async ({
    page,
  }) => {
    await doLogin(page);

    await page.goto('/resumes');
    await page.locator('article.card', { hasText: 'Master Resume' }).getByRole('button', { name: 'Open' }).click();
    await expect(page).toHaveURL(/\/resumes\/[^/]+\/versions\/[^/]+\/edit/);

    const panel = page.locator('.ats-panel');
    await panel.getByRole('button', { name: 'Run analysis' }).click();

    const score = panel.locator('.ats-score');
    await expect(score).toBeVisible();
    await expect(score).toHaveAttribute('aria-valuenow', '94');
    await expect(panel.getByRole('button', { name: 'Focus first issue' })).toHaveCount(0);
  });
});