import { expect, test } from '@playwright/test';
import {
  createResumeFromGallery,
  extractVersionIds,
  HTTP_BASE,
  registerUser,
  readAccessToken,
  uniqueEmail,
} from './support/http-flow';

const NEW_SUMMARY = 'HTTP-persistence summary saved through the real backend.';

test('http autosave: summary persists via real PATCH and across reload in the same session', async ({
  page,
  context,
}) => {
  await registerUser(page, uniqueEmail('happy'));

  const editorUrl = await createResumeFromGallery(page, 'HTTP Persistence Resume');

  // Autosave after editing must flush through the real backend as PATCH 200.
  const summaryTextarea = page.locator('app-editor-summary-form textarea');
  const autosavePromise = page.waitForResponse(
    (r) =>
      r.request().method() === 'PATCH' &&
      /\/api\/v1\/versions\/[^/]+\/content$/.test(new URL(r.url()).pathname) &&
      r.status() === 200,
  );
  await summaryTextarea.fill(NEW_SUMMARY);
  const autosave = await autosavePromise;
  expect(autosave.status()).toBe(200);
  expect(autosave.request().headers()['authorization']).toContain('Bearer ');
  await expect(page.locator('.editor__save-label')).toHaveText('Draft saved', {
    timeout: 10_000,
  });

  // Reload persistence, verified in a new page of the SAME authenticated
  // context (localStorage session restored, backend still owns the version).
  const page2 = await context.newPage();
  await page2.goto(editorUrl);
  await expect(page2).toHaveTitle(/Resume Editor/i);
  await expect(page2.locator('app-editor-summary-form textarea')).toHaveValue(NEW_SUMMARY, {
    timeout: 10_000,
  });
  await expect(page2.locator('.editor__save-label')).toHaveText('Draft saved', {
    timeout: 10_000,
  });
});

test('http isolation: another user is denied access to the resume and version', async ({
  browser,
}) => {
  const ctxA = await browser.newContext();
  const pageA = await ctxA.newPage();
  await registerUser(pageA, uniqueEmail('owner'));

  const editorUrl = await createResumeFromGallery(pageA, 'Isolation Target Resume');
  const { resumeId, versionId } = extractVersionIds(editorUrl);

  // A second, unrelated user registers in its own context.
  const ctxB = await browser.newContext();
  const pageB = await ctxB.newPage();
  await registerUser(pageB, uniqueEmail('intruder'));
  const token = await readAccessToken(ctxB);

  // The backend documents cross-user access as 404 (NotFoundError); also
  // accept 403 in case the security posture changes.
  const resumeRes = await ctxB.request.get(`${HTTP_BASE}/api/v1/resumes/${resumeId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect([403, 404]).toContain(resumeRes.status());

  const versionRes = await ctxB.request.get(`${HTTP_BASE}/api/v1/versions/${versionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect([403, 404]).toContain(versionRes.status());

  await ctxB.close();
  await ctxA.close();
});
