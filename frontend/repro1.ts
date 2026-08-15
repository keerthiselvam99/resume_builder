import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4200';
const EMAIL = 'arun@example.com';
const PASSWORD = 'Password123!';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const logs: string[] = [];

  await page.goto(`${BASE}/login`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  await page.locator('app-input input').fill(EMAIL);
  await page.locator('app-password-input input').fill(PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.getByRole('button', { name: 'Open' }).click();
  await page.waitForSelector('#editor-section-experience');

  // Open the seeded master resume which already has 2 experiences.
  const expCountBefore = await page.locator('#editor-section-experience .entry').count();
  logs.push(`experience entries before add: ${expCountBefore}`);

  await page.locator('#editor-section-experience').getByRole('button', { name: '+ Add experience' }).click();
  await page.waitForTimeout(1200);
  const expCountAfter = await page.locator('#editor-section-experience .entry').count();
  logs.push(`experience entries after clicking Add (wait 1.2s): ${expCountAfter}`);
  logs.push(`EXPECTED: ${expCountBefore + 1}, GOT: ${expCountAfter} -> ${expCountAfter === expCountBefore + 1 ? 'WORKS' : 'DOES NOTHING'}`);

  // Repeat for the other four sections (all empty on master resume).
  const addLabels: Record<string, string> = {
    projects: '+ Add project',
    education: '+ Add education',
    certifications: '+ Add certification',
    awards: '+ Add award',
  };
  for (const section of ['projects', 'education', 'certifications', 'awards']) {
    const before = await page.locator(`#editor-section-${section} .entry`).count();
    await page.locator(`#editor-section-${section}`).getByRole('button', { name: addLabels[section] }).click();
    await page.waitForTimeout(1200);
    const after = await page.locator(`#editor-section-${section} .entry`).count();
    logs.push(`section=${section} before=${before} after=${after} -> ${after === before + 1 ? 'WORKS' : 'DOES NOTHING'}`);
  }

  console.log(logs.join('\n'));
  await browser.close();
}

main().catch((err) => {
  console.error('REPRO FAILED:', err.message);
  process.exit(1);
});
