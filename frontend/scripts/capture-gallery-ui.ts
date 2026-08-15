import { chromium } from 'playwright';
import * as path from 'path';

const BASE = 'http://127.0.0.1:4200';
const OUT = path.join(__dirname, '..', 'screenshots', 'gallery-ui-full.png');

async function main(): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.locator('app-input input').fill('arun@example.com');
  await page.locator('app-password-input input').fill('Password123!');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForFunction(() => location.pathname === '/dashboard', undefined, { timeout: 30000 });

  await page.getByRole('link', { name: 'Templates' }).click();
  await page.waitForFunction(() => location.pathname === '/templates', undefined, { timeout: 30000 });
  await page.getByRole('heading', { name: /Templates/i }).waitFor({ timeout: 30000 });

  await page.waitForFunction(() => {
    const viewport = window.innerHeight;
    return Array.from(document.images).every((img) => {
      const rect = img.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > viewport) {
        return true;
      }
      return img.complete && img.naturalWidth > 0;
    });
  });

  await page.screenshot({ path: OUT, fullPage: true });
  await browser.close();
  console.log(`Saved ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
