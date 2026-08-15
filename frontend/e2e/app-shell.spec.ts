import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.clear());
});

test('boots the app and shows the login screen to an anonymous visitor', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/Log in/i);
  await expect(page.locator('body')).toBeVisible();
});
