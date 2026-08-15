#!/usr/bin/env node
// Captures functional-review evidence into ../final-functional-review:
//   - demo-mode editor: Download PDF disabled with the full-app hint
//   - demo-mode ATS panel running the real engine (master resume score)
//   - an open "Add experience" draft entry (the fixed section-form flow)
//   - a real PDF downloaded through the full application (start:full),
//     verified for magic bytes and selectable text, saved with its text.
//
// Expects to be run while these servers are up:
//   MOCK_BASE (4200) — the default demo build (useMockApi=true)
//   FULL_BASE (4201) — the HTTP build, with the backend on :3000

import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(root, 'final-functional-review');
const MOCK_BASE = process.env.EVIDENCE_MOCK_BASE ?? 'http://127.0.0.1:4200';
const FULL_BASE = process.env.EVIDENCE_FULL_BASE ?? 'http://127.0.0.1:4201';
const PASSWORD = 'E2ePassw0rd!';

const DEMO_EMAIL = 'arun@example.com';
const DEMO_PASSWORD = 'Password123!';

const SUMMARY =
  'Backend-rendered resume summary used to give the PDF real, selectable text for the functional review.';

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch();

try {
  // ---------------------------------------------------------------- demo mode
  const demo = await browser.newContext();
  const page = await demo.newPage();

  await page.goto(`${MOCK_BASE}/login`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('app-input input').fill(DEMO_EMAIL);
  await page.locator('app-password-input input').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.waitForURL('**/resumes');
  await page.getByRole('heading', { name: /My Resumes/i }).waitFor();

  // Open the populated master resume.
  await page.locator('article.card', { hasText: 'Master Resume' }).getByRole('button', { name: 'Open' }).click();
  await page.waitForURL(/\/versions\/v-master\/edit/);
  await page.locator('#editor-section-contact').waitFor();

  // Evidence 1: Download PDF disabled + demo hint in the editor bar.
  await page.getByRole('button', { name: 'Download PDF' }).waitFor();
  await page.screenshot({
    path: join(OUT, 'demo-pdf-disabled.png'),
    fullPage: false,
    clip: undefined,
  });
  const pdfDisabled = await page.getByRole('button', { name: 'Download PDF' }).isDisabled();
  const demoHint = await page.locator('#editor-pdf-demo-hint').innerText();

  // Evidence 2: the ATS panel runs the real engine on the saved content.
  const panel = page.locator('.ats-panel');
  await panel.getByRole('button', { name: 'Run analysis' }).click();
  await panel.locator('.ats-score').waitFor();
  const atsScore = await panel.locator('.ats-score').getAttribute('aria-valuenow');
  const atsFindings = await panel.locator('.ats-finding, .ats__finding').count().catch(() => 0);
  await page.screenshot({ path: join(OUT, 'demo-ats-panel.png') });

  // Evidence 3: an "Add experience" draft entry renders with Save/Cancel.
  const expSection = page.locator('#editor-section-experience');
  await expSection.getByRole('button', { name: /Add experience/i }).click();
  const draft = expSection.locator('article.entry[data-draft="true"]');
  await draft.waitFor();
  await page.screenshot({ path: join(OUT, 'add-experience-draft.png') });
  const draftHasSave = (await draft.getByRole('button', { name: /Save/i }).count()) > 0;
  const draftHasCancel = (await draft.getByRole('button', { name: /Cancel/i }).count()) > 0;

  await demo.close();

  // ------------------------------------------------------------- full app PDF
  const full = await browser.newContext({ acceptDownloads: true });
  const fpage = await full.newPage();
  const email = `evidence-${Date.now()}@example.com`;

  await fpage.goto(`${FULL_BASE}/register`);
  await fpage.locator('input#register-name').fill('Evidence Review User');
  await fpage.locator('input#register-email').fill(email);
  await fpage.locator('input#register-password').fill(PASSWORD);
  await fpage.locator('input#register-confirm').fill(PASSWORD);
  await fpage.getByRole('button', { name: 'Create account' }).click();
  await fpage.waitForURL(/\/resumes/);

  await fpage.goto(`${FULL_BASE}/templates`);
  await fpage.getByRole('heading', { name: /Templates/i }).waitFor();
  const card = fpage.locator('article.card', { hasText: 'Executive Banner' });
  await card.getByRole('button', { name: 'Preview & customise' }).click();
  await fpage.waitForURL(/\/templates\/t-executive-banner-navy/);
  await fpage.locator('app-button', { hasText: 'Use this template' }).click();
  await fpage.waitForURL(/\/resumes\/new\?templateId=/);
  await fpage.locator('input[type="text"]').fill('Evidence PDF Resume');
  await fpage.locator('app-button', { hasText: /Create and edit/i }).click();
  await fpage.waitForURL(/\/versions\/[^/]+\/edit/);
  await fpage.locator('.editor__save-label').getByText('Draft saved').waitFor({ timeout: 15_000 });

  await fpage.locator('app-editor-summary-form textarea').fill(SUMMARY);
  await fpage.locator('.editor__save-label').getByText('Draft saved').waitFor({ timeout: 15_000 });

  const exportPromise = fpage.waitForResponse(
    (r) => r.request().method() === 'POST' && /\/versions\/[^/]+\/pdf$/.test(new URL(r.url()).pathname) && r.status() === 200,
    { timeout: 90_000 },
  );
  const downloadPromise = fpage.waitForEvent('download');
  await fpage.getByRole('button', { name: 'Download PDF' }).click();
  const [exportResponse, download] = await Promise.all([exportPromise, downloadPromise]);

  const pdfPath = join(OUT, 'exported-resume.pdf');
  await download.saveAs(pdfPath);
  const bytes = await readFile(pdfPath);
  const magic = bytes.subarray(0, 5).toString('latin1');

  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({ data: new Uint8Array(bytes), isEvalSupported: false });
  const doc = await task.promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i += 1) {
    const pg = await doc.getPage(i);
    const content = await pg.getTextContent();
    text += content.items.map((item) => item.str).join(' ') + '\n';
  }
  const textOk = text.includes(SUMMARY);

  await writeFile(
    join(OUT, 'pdf-export-evidence.txt'),
    [
      `HTTP status            : ${exportResponse.status()}`,
      `Content-Type           : ${exportResponse.headers()['content-type']}`,
      `Suggested filename     : ${download.suggestedFilename()}`,
      `Saved as               : exported-resume.pdf`,
      `PDF magic bytes        : ${magic}`,
      `File size (bytes)      : ${bytes.length}`,
      `Page count             : ${doc.numPages}`,
      `Selectable text        : ${textOk}`,
      `Extracted text contains: "${SUMMARY}"`,
      ``,
      `First 300 chars of extracted text:`,
      text.slice(0, 300),
      ``,
      `Demo-mode checks:`,
      `  Download PDF disabled          : ${pdfDisabled}`,
      `  Demo hint visible              : ${demoHint.includes('PDF download requires the local backend')}`,
      `  Master ATS score (engine)      : ${atsScore}`,
      `  ATS findings rendered          : ${atsFindings}`,
      `  Add-experience draft Save btn  : ${draftHasSave}`,
      `  Add-experience draft Cancel btn: ${draftHasCancel}`,
    ].join('\n'),
  );

  await full.close();
  console.log('Evidence captured under final-functional-review/');
  console.log(`  PDF: HTTP ${exportResponse.status()}, magic "${magic}", pages ${doc.numPages}, textOk=${textOk}`);
  console.log(`  Demo: pdfDisabled=${pdfDisabled}, atsScore=${atsScore}`);
} finally {
  await browser.close();
}