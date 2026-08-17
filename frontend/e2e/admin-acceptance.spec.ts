import { APIRequestContext, APIResponse, expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
const API = 'http://127.0.0.1:3000/api/v1',
  OUT = join(process.cwd(), 'admin-acceptance');
const password = 'E2ePassw0rd!';
async function register(request: APIRequestContext, name: string, email: string) {
  const r = await request.post(`${API}/auth/register`, { data: { name, email, password } });
  expect(r.status()).toBe(201);
  return r.json();
}
async function ensureAdmin(request: APIRequestContext) {
  const login = await request.post(`${API}/auth/login`, {
    data: { email: 'admin.e2e@example.com', password },
  });
  return login.status() === 200
    ? login.json()
    : register(request, 'Admin Operator', 'admin.e2e@example.com');
}
for (const run of [1, 2, 3]) {
  test(`Admin full-stack acceptance ${run}/3`, async ({ page, request }) => {
    test.setTimeout(180000);
    await mkdir(OUT, { recursive: true });
    const admin = await ensureAdmin(request);
    const suffix = `${run}-${Date.now()}`;
    const a = await register(request, 'Casey Example', `casey-${suffix}@example.com`);
    const b = await register(request, 'Riley Example', `riley-${suffix}@example.com`);
    await page.goto('/login');
    await page.locator('input#login-email').fill('admin.e2e@example.com');
    await page.locator('app-password-input input').fill(password);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/resumes/);
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Admin console' })).toBeVisible();
    await expect(page.getByText('Total users')).toBeVisible();
    if (run === 1) await page.screenshot({ path: join(OUT, 'admin-summary.png'), fullPage: true });
    const search = page.getByLabel('Search');
    await search.fill(`casey-${suffix}`);
    await expect(page.getByText(`casey-${suffix}@example.com`)).toBeVisible();
    if (run === 1)
      await page.screenshot({ path: join(OUT, 'search-filter-results.png'), fullPage: true });
    await page.getByRole('button', { name: 'Promote to Admin' }).click();
    await expect(page.getByRole('heading', { name: 'Confirm account change' })).toBeVisible();
    if (run === 1)
      await page.screenshot({ path: join(OUT, 'confirmation-dialog.png'), fullPage: true });
    await page.getByRole('button', { name: 'Confirm change' }).click();
    await expect(page.getByText('Account updated successfully.')).toBeVisible();
    if (run === 1) await page.screenshot({ path: join(OUT, 'promoted-user.png'), fullPage: true });
    await search.fill(`riley-${suffix}`);
    await page.getByRole('button', { name: 'Disable account' }).click();
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes(`/admin/users/${b.user.id}/status`) &&
          response.request().method() === 'PATCH' &&
          response.status() === 200,
      ),
      page.getByRole('button', { name: 'Confirm change' }).click(),
    ]);
    await expect(page.getByText('Account updated successfully.')).toBeVisible();
    if (run === 1) await page.screenshot({ path: join(OUT, 'disabled-user.png'), fullPage: true });
    const loginDisabled = await request.post(`${API}/auth/login`, {
      data: { email: `riley-${suffix}@example.com`, password },
    });
    expect(loginDisabled.status()).toBe(401);
    await page.getByRole('button', { name: 'Enable account' }).click();
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes(`/admin/users/${b.user.id}/status`) &&
          response.request().method() === 'PATCH' &&
          response.status() === 200,
      ),
      page.getByRole('button', { name: 'Confirm change' }).click(),
    ]);
    expect(
      (
        await request.post(`${API}/auth/login`, {
          data: { email: `riley-${suffix}@example.com`, password },
        })
      ).status(),
    ).toBe(200);
    await search.fill('admin.e2e@example.com');
    await expect(page.getByRole('button', { name: 'Demote to User' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Disable account' })).toBeDisabled();
    await expect(page.getByText('admin.role-granted').first()).toBeVisible();
    if (run === 1) {
      await page.screenshot({ path: join(OUT, 'audit-events.png'), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: join(OUT, 'mobile-view.png'), fullPage: true });
      const responsive = [];
      for (const viewport of [
        { width: 1440, height: 900 },
        { width: 1280, height: 800 },
        { width: 768, height: 1024 },
        { width: 390, height: 844 },
      ]) {
        await page.setViewportSize(viewport);
        responsive.push(
          await page.evaluate(
            (v) => ({
              viewport: v,
              scrollWidth: document.documentElement.scrollWidth,
              clientWidth: document.documentElement.clientWidth,
              overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
              widest: [...document.querySelectorAll('*')]
                .map((element) => ({
                  tag: element.tagName,
                  className: (element as HTMLElement).className,
                  right: element.getBoundingClientRect().right,
                  width: element.getBoundingClientRect().width,
                }))
                .sort((a, b) => b.right - a.right)
                .slice(0, 5),
            }),
            viewport,
          ),
        );
      }
      await writeFile(
        join(OUT, 'responsive-measurements.json'),
        JSON.stringify(responsive, null, 2),
      );
      expect(responsive.every((x) => !x.overflow)).toBe(true);
      const summary = await request.get(`${API}/admin/summary`, {
        headers: { Authorization: `Bearer ${admin.accessToken}` },
      });
      await writeFile(join(OUT, 'api-summary.json'), JSON.stringify(await summary.json(), null, 2));
    }
    if ((await page.getByRole('button', { name: 'Toggle navigation' }).count()) > 0) {
      await page.getByRole('button', { name: 'Toggle navigation' }).click();
    }
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/login/);
    await writeFile(
      join(OUT, `admin-run-${run}.json`),
      JSON.stringify(
        { run, promoted: a.user.id, disabledAndEnabled: b.user.id, retries: 0, passed: true },
        null,
        2,
      ),
    );
  });
  test(`USER authorization denial ${run}/3`, async ({ page, request }) => {
    test.setTimeout(120_000);
    const email = `denied-${run}-${Date.now()}@example.com`;
    const user = await register(request, 'Denied User', email);
    await page.goto('/login');
    await page.locator('input#login-email').fill(email);
    await page.locator('app-password-input input').fill(password);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/resumes/);
    await expect(page.getByRole('link', { name: 'Admin' })).toHaveCount(0);
    await page.goto('/admin');
    await expect(page).toHaveURL(/resumes/);
    const headers = { Authorization: `Bearer ${user.accessToken}` };
    const results = [];
    for (const [method, path, data] of [
      ['get', '/admin/summary', null],
      ['get', '/admin/users', null],
      ['get', '/admin/audit-events', null],
      ['patch', `/admin/users/${user.user.id}/role`, { role: 'admin' }],
      ['patch', `/admin/users/${user.user.id}/status`, { status: 'disabled' }],
    ] as const) {
      const options = data ? { headers, data } : { headers };
      let r: APIResponse;
      if (method === 'get') r = await request.get(`${API}${path}`, options);
      else r = await request.patch(`${API}${path}`, options);
      const body = await r.json();
      expect(r.status(), `${method.toUpperCase()} ${path}: ${JSON.stringify(body)}`).toBe(403);
      results.push({ method, path, status: r.status(), body });
    }
    await mkdir(OUT, { recursive: true });
    if (run === 1) {
      await page.screenshot({ path: join(OUT, 'access-denied-user.png'), fullPage: true });
      await writeFile(join(OUT, 'authorization-denials.json'), JSON.stringify(results, null, 2));
    }
    await writeFile(
      join(OUT, `authorization-run-${run}.json`),
      JSON.stringify({ run, retries: 0, passed: true }, null, 2),
    );
  });
}
