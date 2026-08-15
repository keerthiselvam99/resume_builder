import { expect, test } from '@playwright/test';
import {
  createResumeFromGallery,
  extractVersionIds,
  HTTP_BASE,
  registerUser,
  uniqueEmail,
} from './support/http-flow';

test('http ATS analysis: the editor panel runs the real engine and renders the report', async ({
  page,
}) => {
  await registerUser(page, uniqueEmail('ats'));

  await createResumeFromGallery(page, 'ATS Analysis Resume');

  const analysisPromise = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      /\/api\/v1\/versions\/[^/]+\/ats-analysis$/.test(new URL(r.url()).pathname) &&
      r.status() === 200,
  );
  await page.locator('.ats-panel').getByRole('button', { name: 'Run analysis' }).click();

  const analysis = await analysisPromise;
  const body = (await analysis.json()) as {
    rulesetVersion: string;
    overallScore: number;
    categories: unknown[];
    findings: { code: string; message: string }[];
  };
  expect(body.rulesetVersion).toBe('ats-rules-v1');
  expect(body.categories).toHaveLength(9);
  expect(Array.isArray(body.findings)).toBe(true);
  expect(Number.isInteger(body.overallScore)).toBe(true);
  expect(body.overallScore).toBeGreaterThanOrEqual(0);
  expect(body.overallScore).toBeLessThanOrEqual(100);

  const score = page.locator('.ats-score');
  await expect(score).toBeVisible();
  await expect(score).toHaveAttribute('aria-valuenow', String(body.overallScore));
  await expect(score).toHaveAttribute('role', 'progressbar');
  await expect(score).toHaveAttribute('aria-label', new RegExp('Overall ATS score'));

  await expect(page.locator('.ats-panel__categories')).toBeVisible();

  // The seeded gallery template is a visual (non-ATS) layout, so the real
  // engine must flag it as an error finding rendered with a text label.
  await expect(page.locator('.ats-panel__findings')).toContainText('not ATS-friendly');
  await expect(page.locator('.ats-finding__severity').first()).toHaveText('Error', {
    ignoreCase: true,
  });

  // Re-running returns the identical deterministic report.
  await page.locator('.ats-panel').getByRole('button', { name: 'Run analysis' }).click();
  await expect(score).toHaveAttribute('aria-valuenow', String(body.overallScore));
});

test('http ATS analysis: another user is denied on the real endpoint', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await registerUser(pageA, uniqueEmail('ats-owner'));

  const editorUrl = await createResumeFromGallery(pageA, 'ATS Isolation Resume');
  const { versionId } = extractVersionIds(editorUrl);

  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await registerUser(pageB, uniqueEmail('ats-intruder'));
  const token = await pageB.evaluate(() => {
    const raw = localStorage.getItem('resumeiq_session');
    const session = raw ? (JSON.parse(raw) as { accessToken?: string }) : null;
    return session?.accessToken ?? null;
  });
  if (!token) {
    throw new Error('Could not read the access token.');
  }

  const res = await ctxB.request.post(
    `${HTTP_BASE}/api/v1/versions/${versionId}/ats-analysis`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  expect([403, 404]).toContain(res.status());

  await ctxB.close();
  await ctxA.close();
});