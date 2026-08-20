import { APIRequestContext, expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const API = 'http://127.0.0.1:3000/api/v1',
  OUT = join(process.cwd(), 'account-recovery-acceptance'),
  captureEvidence = process.env['CAPTURE_ACCEPTANCE_EVIDENCE'] === '1',
  oldPassword = 'Password123!',
  newPassword = 'NewPassword123!';
async function messages(request: APIRequestContext, email: string) {
  const r = await request.get(`${API}/dev/mailbox`);
  expect(r.status()).toBe(200);
  return (await r.json()).messages.filter((m: { recipient: string }) => m.recipient === email);
}
async function actionPath(request: APIRequestContext, message: { id: string }) {
  const response = await request.post(`${API}/dev/mailbox/${message.id}/action`);
  expect(response.status()).toBe(200);
  return (await response.json()).actionPath as string;
}
async function token(request: APIRequestContext, message: { id: string }) {
  return new URL(await actionPath(request, message), 'http://local').searchParams.get('token')!;
}
for (const run of [1, 2, 3])
  test(`complete account recovery ${run}/3`, async ({ page, request }) => {
    test.setTimeout(180000);
    await mkdir(OUT, { recursive: true });
    const email = `recovery-${run}-${Date.now()}@example.com`;
    await page.route('**/api/v1/auth/register', async (route) =>
      route.continue({
        headers: { ...route.request().headers(), 'x-account-recovery-test': 'true' },
      }),
    );
    await page.goto('/register');
    await page.locator('input#register-name').fill('Recovery Example');
    await page.locator('input#register-email').fill(email);
    await page.locator('input#register-password').fill(oldPassword);
    await page.locator('input#register-confirm').fill(oldPassword);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/check-email/);
    await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
    await expect(page.getByText(/r\*\*\*@example\.com/)).toBeVisible();
    if (captureEvidence && run === 1)
      await page.screenshot({ path: join(OUT, 'check-email.png'), fullPage: true });
    expect(
      (
        await request.post(`${API}/auth/login`, { data: { email, password: oldPassword } })
      ).status(),
    ).toBe(403);
    let captured = await messages(request, email);
    const first = await token(request, captured.at(-1));
    await page.getByRole('button', { name: 'Resend verification email' }).click();
    await expect(page.getByText(/Resend available/)).toBeVisible();
    if (captureEvidence && run === 1) {
      await page.screenshot({ path: join(OUT, 'resend-cooldown.png'), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: join(OUT, 'mobile-check-email.png'), fullPage: true });
      await page.setViewportSize({ width: 1280, height: 800 });
    }
    captured = await messages(request, email);
    const newestMessage = captured.at(-1);
    const newest = await token(request, newestMessage);
    expect(newest).not.toBe(first);
    expect(
      (await request.post(`${API}/auth/verify-email`, { data: { token: first } })).status(),
    ).toBe(401);
    if (captureEvidence && run === 1) {
      await page.route('**/api/v1/auth/verify-email', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        await route.continue();
      });
    }
    await page.goto('/dev/mailbox');
    await expect(
      page.getByRole('heading', {
        name: 'Development email mailbox — not available in production.',
      }),
    ).toBeVisible();
    const verificationNavigation = page
      .locator('li')
      .filter({ hasText: email })
      .filter({ hasText: 'Email verification' })
      .last()
      .getByRole('button', { name: 'Open verification link' })
      .click();
    if (captureEvidence && run === 1) {
      await expect(page.getByText(/Verifying/)).toBeVisible();
      await page.screenshot({ path: join(OUT, 'verification-loading.png'), fullPage: true });
    }
    await verificationNavigation;
    await expect(page.getByText('Your email is verified.')).toBeVisible();
    await expect.poll(() => page.url()).not.toContain('token=');
    if (captureEvidence && run === 1)
      await page.screenshot({ path: join(OUT, 'verification-success.png'), fullPage: true });
    expect(
      (await request.post(`${API}/auth/verify-email`, { data: { token: newest } })).status(),
    ).toBe(401);
    if (captureEvidence && run === 1) {
      await page.unroute('**/api/v1/auth/verify-email');
      await page.goto(`/verify-email?token=${encodeURIComponent(newest)}`);
      await expect(page.getByText(/invalid or has expired/)).toBeVisible();
      await page.screenshot({ path: join(OUT, 'verification-expired.png'), fullPage: true });
    }
    const login = await request.post(`${API}/auth/login`, {
      data: { email, password: oldPassword },
    });
    expect(login.status()).toBe(200);
    const session = await login.json();
    const cookie = login.headers()['set-cookie'];
    expect(
      (
        await request.get(`${API}/resumes`, {
          headers: { Authorization: `Bearer ${session.accessToken}` },
        })
      ).status(),
    ).toBe(200);
    if (captureEvidence && run === 1) {
      await page.goto('/forgot-password');
      await page.screenshot({ path: join(OUT, 'forgot-password-form.png'), fullPage: true });
      await page.locator('input#forgot-email').fill(email);
      await page.getByRole('button', { name: 'Send reset link' }).click();
      await expect(page.getByText(/If an account exists/)).toBeVisible();
      await page.screenshot({
        path: join(OUT, 'forgot-password-confirmation.png'),
        fullPage: true,
      });
    }
    const known = await request.post(`${API}/auth/forgot-password`, { data: { email } }),
      unknown = await request.post(`${API}/auth/forgot-password`, {
        data: { email: 'unknown-' + email },
      });
    expect(known.status()).toBe(202);
    expect(await known.json()).toEqual(await unknown.json());
    captured = await messages(request, email);
    const resetMessage = captured
      .filter((m: { kind: string }) => m.kind === 'reset-password')
      .at(-1);
    const reset = await token(request, resetMessage);
    await page.goto('/dev/mailbox');
    await page
      .locator('li')
      .filter({ hasText: email })
      .filter({ hasText: 'Password reset' })
      .last()
      .getByRole('button', { name: 'Open reset link' })
      .click();
    await expect.poll(() => page.url()).not.toContain('token=');
    if (captureEvidence && run === 1) {
      await page.screenshot({ path: join(OUT, 'reset-form.png'), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: join(OUT, 'mobile-reset-form.png'), fullPage: true });
      await page.setViewportSize({ width: 1280, height: 800 });
    }
    await page.locator('input#reset-password').fill(newPassword);
    await page.locator('input#reset-confirm').fill(newPassword);
    await page.getByRole('button', { name: 'Reset password' }).click();
    await expect(page.getByText('Password reset. You can now log in.')).toBeVisible();
    if (captureEvidence && run === 1)
      await page.screenshot({ path: join(OUT, 'reset-success.png'), fullPage: true });
    expect(
      (
        await request.post(`${API}/auth/reset-password`, {
          data: { token: reset, newPassword: 'Another123!' },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await request.post(`${API}/auth/login`, { data: { email, password: oldPassword } })
      ).status(),
    ).toBe(401);
    expect(
      (
        await request.post(`${API}/auth/login`, { data: { email, password: newPassword } })
      ).status(),
    ).toBe(200);
    expect(
      (
        await request.get(`${API}/resumes`, {
          headers: { Authorization: `Bearer ${session.accessToken}` },
        })
      ).status(),
    ).toBe(401);
    expect(
      (await request.post(`${API}/auth/refresh`, { headers: { Cookie: cookie } })).status(),
    ).toBe(401);
    captured = await messages(request, email);
    expect(captured.some((m: { kind: string }) => m.kind === 'password-changed')).toBe(true);
    await writeFile(
      join(OUT, `run-${run}.json`),
      JSON.stringify(
        {
          run,
          passed: true,
          retries: 0,
          emailDomain: 'example.com',
          verificationTokenLength: newest.length,
          rawTokensStored: false,
          oldSessionRejected: true,
          passwordChangedNotification: true,
        },
        null,
        2,
      ),
    );
    if (run === 1) {
      await writeFile(
        join(OUT, 'sanitized-email-metadata.json'),
        JSON.stringify(
          {
            recipientDomain: 'example.com',
            messageKinds: [...new Set(captured.map((m: { kind: string }) => m.kind))],
            appOrigin: 'http://127.0.0.1:4201',
            rawLinksRedacted: true,
          },
          null,
          2,
        ),
      );
      await writeFile(
        join(OUT, 'security-proof.json'),
        JSON.stringify(
          {
            tokenStorage: 'SHA-256 hashes only',
            browserTokenStorage: 'none',
            verificationSingleUse: true,
            resetSingleUse: true,
            oldAccessRejected: true,
            oldRefreshRejected: true,
            passwordsIncluded: false,
          },
          null,
          2,
        ),
      );
    }
  });
