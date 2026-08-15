import { chromium } from 'playwright';

const BASE = 'http://127.0.0.1:4200';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  const logs: string[] = [];

  await page.goto(`${BASE}/login`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('app-input input').fill('arun@example.com');
  await page.locator('app-password-input input').fill('Password123!');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.getByRole('button', { name: 'Open' }).click();
  await page.waitForSelector('#editor-section-experience');

  // ATS on the populated master resume.
  await page.locator('.ats-panel').getByRole('button', { name: 'Run analysis' }).click();
  await page.waitForSelector('.ats-score');
  await page.waitForTimeout(900);
  const score = await page.locator('.ats-score__value').textContent();
  const cats: string[] = await page.locator('.ats-category__row').allTextContents();
  logs.push(`ATS overall score on master resume: ${score}`);
  logs.push(`category rows: ${cats.join(' | ')}`);

  // Findings text (looking for "Oracle" or single-bullet role references).
  const findings = await page.locator('.ats-finding__message').allTextContents();
  logs.push(`findings: ${findings.join(' || ')}`);

  // New empty resume ATS.
  await page.goto(`${BASE}/templates`);
  await page.waitForSelector('article.card');
  await page.locator('article.card').first().getByRole('button', { name: 'Preview & customise' }).click();
  await page.waitForSelector('app-button', { hasText: 'Use this template' });
  await page.locator('app-button', { hasText: 'Use this template' }).click();
  await page.waitForSelector('input[type="text"]');
  await page.locator('input[type="text"]').fill('Repro Resume');
  await page.locator('app-button', { hasText: /Create and edit/i }).click();
  await page.waitForSelector('.ats-panel');
  await page.locator('.ats-panel').getByRole('button', { name: 'Run analysis' }).click();
  await page.waitForSelector('.ats-score');
  await page.waitForTimeout(900);
  const emptyScore = await page.locator('.ats-score__value').textContent();
  const emptyCats: string[] = await page.locator('.ats-category__row').allTextContents();
  logs.push(`ATS overall score on EMPTY new resume: ${emptyScore}`);
  logs.push(`empty category rows: ${emptyCats.join(' | ')}`);

  // PDF in demo mode: fill summary first so content is non-empty.
  const textarea = page.locator('app-editor-summary-form textarea');
  await textarea.fill('Some summary content for the PDF test.');
  await page.waitForTimeout(1000);
  const pdfBtn = page.locator('.editor__actions').getByRole('button', { name: 'Download PDF' });
  logs.push(`PDF button disabled? ${await pdfBtn.isDisabled()}`);
  await pdfBtn.click();
  await page.waitForTimeout(3500);
  const pdfLabel = await page.locator('.editor__pdf-label').textContent().catch(() => null);
  logs.push(`PDF demo-mode result label: ${pdfLabel ?? 'NO LABEL'}`);

  console.log(logs.join('\n'));
  await browser.close();
}

main().catch((err) => {
  console.error('REPRO FAILED:', err.message);
  process.exit(1);
});
