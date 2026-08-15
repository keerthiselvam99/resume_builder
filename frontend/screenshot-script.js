const { chromium } = require('playwright');

const BASE = 'http://127.0.0.1:4200';
const OUT = 'C:\\Users\\RUBANR~1\\AppData\\Local\\Temp\\opencode\\screenshots';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  let n = 0;
  const shot = async (name) => {
    const path = `${OUT}\\${String(n).padStart(2, '0')}_${name}.png`;
    await page.screenshot({ path, fullPage: true });
    console.log('  screenshot:', path);
    n++;
  };

  // 1. Login page
  await page.goto(`${BASE}/login`);
  await wait(800);
  await shot('01-login');

  // 2. Login with invalid creds (validation)
  await page.locator('app-input input').fill('bad@email.com');
  await page.locator('app-password-input input').fill('wrong');
  await page.getByRole('button', { name: 'Log in' }).click();
  await wait(600);
  await shot('02-login-error');

  // 3. Correct login
  await page.locator('app-input input').fill('arun@example.com');
  await page.locator('app-password-input input').fill('Password123!');
  await page.getByRole('button', { name: 'Log in' }).click();
  await wait(1200);
  await shot('03-dashboard');

  // 4. Open Master Resume editor
  await page.getByRole('button', { name: 'Open' }).click();
  await wait(1500);
  await shot('04-editor-desktop');

  // 5. Edit summary -> preview updates immediately
  const textarea = page.locator('app-editor-summary-form textarea');
  await textarea.fill('Edited summary for screenshot review.');
  await wait(400);
  await shot('05-summary-edit');

  // 6. Add a skill
  const skillInput = page.locator('app-editor-skills-form app-input input');
  await skillInput.fill('Playwright');
  await skillInput.press('Enter');
  await wait(400);
  await shot('06-skills-added');

  // 7. Wait for Saved
  await page.waitForSelector('.editor__save-label', { state: 'visible' });
  await wait(500);
  await shot('07-saved');

  // 8. Mobile viewport - Edit tab
  await page.setViewportSize({ width: 375, height: 812 });
  await wait(600);
  await shot('08-mobile-edit');

  // 9. Mobile - Preview tab
  await page.getByRole('tab', { name: 'Preview' }).click();
  await wait(400);
  await shot('09-mobile-preview');

  // 10. Zoom controls
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator('app-resume-preview button[aria-label="Zoom out"]').click();
  await wait(300);
  await shot('10-zoom-out');
  await page.locator('app-resume-preview button[aria-label="Reset zoom to 100%"]').click();
  await wait(300);
  await shot('11-zoom-reset');
  await page.locator('app-resume-preview button[aria-label="Zoom in"]').click();
  await wait(300);
  await shot('12-zoom-in');

  // 11. Focus visibility on the skills Add button
  await page.locator('app-editor-skills-form .app-button--secondary').focus();
  await wait(200);
  await shot('13-focus-visible');

  // 12. Save bar states
  await shot('14-save-bar');

  console.log('Done. Total screenshots:', n);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
