import { expect, Page, BrowserContext } from '@playwright/test';

export const PASSWORD = 'E2ePassw0rd!';

export const HTTP_BASE = 'http://127.0.0.1:4201';

export function uniqueEmail(seed: string): string {
  return `e2e-http-${seed}-${Date.now()}@example.com`;
}

export async function registerUser(page: Page, email: string): Promise<void> {
  await page.goto('/register');
  await page.locator('input#register-name').fill('E2E HTTP User');
  await page.locator('input#register-email').fill(email);
  await page.locator('input#register-password').fill(PASSWORD);
  await page.locator('input#register-confirm').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/resumes/);
  await expect(page.getByRole('heading', { name: 'No saved resumes yet' })).toBeVisible();
}

export async function createResumeFromGallery(page: Page, name: string): Promise<string> {
  await page.goto('/templates');
  await expect(page.getByRole('heading', { name: /Templates/i })).toBeVisible();

  const card = page.locator('article.card', { hasText: 'Executive Banner' });
  await card.getByRole('button', { name: 'Preview & customise' }).click();
  await expect(page).toHaveURL(/\/templates\/t-executive-banner-navy/);

  await page.locator('app-button', { hasText: 'Use this template' }).click();
  await expect(page).toHaveURL(/\/resumes\/new\?templateId=/);

  await page.locator('input[type="text"]').fill(name);
  await page.locator('app-button', { hasText: /Create and edit/i }).click();

  await expect(page).toHaveURL(/\/resumes\/[^/]+\/versions\/[^/]+\/edit/);
  await expect(page).toHaveTitle(/Resume Editor/i);
  await expect(page.locator('.editor__save-label')).toHaveText('Draft saved', {
    timeout: 10_000,
  });
  return page.url();
}

export interface VersionIds {
  resumeId: string;
  versionId: string;
}

export async function fillEditorSummary(page: Page, summary: string): Promise<void> {
  const textarea = page.locator('app-editor-summary-form textarea');
  await textarea.fill(summary);
  await expect(page.locator('.editor__save-label')).toHaveText('Draft saved', {
    timeout: 10_000,
  });
}

export function extractVersionIds(editorUrl: string): VersionIds {
  const match = editorUrl.match(/\/resumes\/([^/]+)\/versions\/([^/]+)\/edit/);
  if (!match) {
    throw new Error(`Editor URL does not match the expected shape: ${editorUrl}`);
  }
  return { resumeId: match[1], versionId: match[2] };
}

export async function readAccessToken(context: BrowserContext): Promise<string> {
  const page = context.pages()[0];
  const token = await page.evaluate(() => {
    const raw = localStorage.getItem('resumeiq_session');
    const session = raw ? (JSON.parse(raw) as { accessToken?: string }) : null;
    return session?.accessToken ?? null;
  });
  if (!token) {
    throw new Error('Could not read the access token from resumeiq_session.');
  }
  return token;
}
