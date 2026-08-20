import { expect, test, Download } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  createResumeFromGallery,
  extractVersionIds,
  fillEditorSummary,
  HTTP_BASE,
  registerUser,
  readAccessToken,
  uniqueEmail,
} from './support/http-flow';

// User signed up as "E2E HTTP User" + default master version name "Master Resume".
const EXPECTED_FILENAME = 'e2e-http-user-master-resume.pdf';

const SUMMARY = 'Backend-rendered resume summary used to give the PDF real text.';
const EXPORTED_SECTIONS = [
  'HTTP Gate Labs',
  'HTTP Evidence Console',
  'HTTP Quality University',
  'HTTP Certified Release Professional',
  'HTTP Zero Retry Award',
];
const EVIDENCE = join(process.cwd(), 'final-functional-review');

async function addExportSections(page: import('@playwright/test').Page): Promise<void> {
  const values: [string, string, [string, string][]][] = [
    [
      'experience',
      'Add experience',
      [
        ['Company', EXPORTED_SECTIONS[0]],
        ['Role', 'Release Engineer'],
      ],
    ],
    [
      'projects',
      'Add project',
      [
        ['Title', EXPORTED_SECTIONS[1]],
        ['Summary', 'Verified PDF output'],
      ],
    ],
    [
      'education',
      'Add education',
      [
        ['Institution', EXPORTED_SECTIONS[2]],
        ['Degree', 'BSc Quality'],
      ],
    ],
    [
      'certifications',
      'Add certification',
      [
        ['Certification name', EXPORTED_SECTIONS[3]],
        ['Issuing organization', 'Standards Board'],
      ],
    ],
    [
      'awards',
      'Add award',
      [
        ['Award or achievement title', EXPORTED_SECTIONS[4]],
        ['Issuing organization', 'Quality Council'],
      ],
    ],
  ];
  for (const [id, addName, fields] of values) {
    const section = page.locator(`#editor-section-${id}`);
    await section.getByRole('button', { name: addName }).click();
    const card = section.locator('[data-draft="true"]');
    for (const [label, value] of fields) await card.getByLabel(label).fill(value);
    if (id === 'experience') {
      await card.getByRole('combobox', { name: 'End date month' }).selectOption('01');
      await card.getByRole('combobox', { name: 'End date year' }).selectOption('2024');
    }
    await card.getByRole('button', { name: 'Save' }).click();
  }
  await expect(page.locator('.editor__save-label')).toHaveText('Draft saved', { timeout: 10_000 });
}

// Directly to the backend process that Playwright starts for the http track.
// Playwright always runs the backend on its default port; the Angular dev
// server on :4201 proxies /api to it.
const PDF_READY_PROBE = 'http://127.0.0.1:3000/pdfz';

/** Minimal structural view of the Playwright `request` fixture used to poll. */
interface ProbeClient {
  get(url: string): Promise<{ status(): number }>;
}

/**
 * Readiness gate: the backend PDF worker must have launched before the first
 * export is accepted. The backend warms up Chromium at boot (PDF_WARMUP=true
 * is set by playwright.config.ts), so this probe transitions to 200 within the
 * browser-launch window and guarantees the export budget is spent on rendering
 * rather than on a cold browser start.
 */
async function waitForPdfWorkerReady(request: ProbeClient, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = 0;
  while (Date.now() < deadline) {
    const response = await request.get(PDF_READY_PROBE).catch(() => null);
    lastStatus = response?.status() ?? 0;
    if (lastStatus === 200) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `PDF worker did not become ready within ${timeoutMs}ms (last /pdfz status: ${lastStatus}).`,
  );
}

test('http pdf export: downloads a genuine, A4 named PDF through the real service', async ({
  page,
  request,
}) => {
  // The very first export through a freshly started backend must fit inside a
  // budget that covers warm Chromium first-use, the pagination pre-pass, the
  // print pass, and pdf.js verification after the readiness gate has passed.
  test.setTimeout(180_000);
  await registerUser(page, uniqueEmail('pdf'));

  // Register flow logs in and lands on the dashboard; create + open the editor.
  const editorUrl = await createResumeFromGallery(page, 'PDF Export Resume');
  const { versionId } = extractVersionIds(editorUrl);

  // The backend rejects exports of resumes with no selectable text, so the
  // owner must enter some content before the export will succeed.
  await fillEditorSummary(page, SUMMARY);
  await addExportSections(page);
  await page.getByRole('button', { name: 'Save resume' }).click();
  await page.reload();
  for (const value of EXPORTED_SECTIONS) {
    await expect
      .poll(() => page.locator('iframe.preview__iframe').getAttribute('srcdoc'))
      .toContain(value);
  }

  // The export is a real POST to the backend renderer.
  const exportPromise = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      new URL(r.url()).pathname.endsWith(`/versions/${versionId}/pdf`) &&
      r.status() === 200,
    { timeout: 90_000 },
  );
  const downloadPromise = page.waitForEvent('download');
  await waitForPdfWorkerReady(request);
  await page.getByRole('button', { name: 'Download PDF' }).click();

  const [exportResponse, download] = await Promise.all([exportPromise, downloadPromise]);
  expect(exportResponse.status()).toBe(200);
  expect(exportResponse.headers()['content-type']).toBe('application/pdf');

  // The frontend builds <user><version>.pdf; the backend sanitizes again.
  expect(download.suggestedFilename()).toBe(EXPECTED_FILENAME);

  // Navigation happens only after the browser download event has fired, and
  // carries the exact exported resume/version selection into Job Matcher.
  await expect(page).toHaveURL(/\/job-matcher\?resumeId=[^&]+&versionId=[^&]+/);
  await expect(page.locator('select[formControlName="resumeId"]')).not.toHaveValue('');
  await expect(page.locator('select[formControlName="versionId"]')).toHaveValue(versionId);
  await mkdir(EVIDENCE, { recursive: true });
  await page.screenshot({ path: join(EVIDENCE, 'full-stack-downloaded.png'), fullPage: true });

  // Payload is a real, non-empty PDF document.
  const bytes = await readDownload(download);
  expect(bytes.length).toBeGreaterThan(1024);
  expect(Buffer.from(bytes.subarray(0, 5)).toString('latin1')).toBe('%PDF-');

  // The PDF carries the entered content as selectable text (same pdf.js check
  // the backend runs before shipping a file), not an image-only stub.
  const { text, pageCount } = await extractPdfText(bytes);
  expect(pageCount).toBeGreaterThan(0);
  expect(text).toContain(SUMMARY);
  for (const value of EXPORTED_SECTIONS) expect(text).toContain(value);

  await download.saveAs(join(EVIDENCE, download.suggestedFilename()));
  await writeFile(join(EVIDENCE, 'full-stack-pdf-text.txt'), text, 'utf8');
});

test('http pdf export: another users request to the export endpoint is denied', async ({
  browser,
  request,
}) => {
  test.setTimeout(180_000);
  const ctxOwner = await browser.newContext();
  const pageOwner = await ctxOwner.newPage();
  await registerUser(pageOwner, uniqueEmail('pdf-owner'));
  const editorUrl = await createResumeFromGallery(pageOwner, 'PDF Ownership Target');
  const { versionId } = extractVersionIds(editorUrl);

  // Detect leftover zero-text pages from an unedited resume export.
  await fillEditorSummary(pageOwner, SUMMARY);

  // The owner's export is a first-export too; gate it on worker readiness like
  // the primary export test.
  await waitForPdfWorkerReady(request);

  // Capture a valid export body that the owner's browser actually sends, so the
  // ownership check (not body validation) is what screens the intruder.
  const bodyPromise = pageOwner.waitForRequest(
    (r) =>
      r.method() === 'POST' && new URL(r.url()).pathname.endsWith(`/versions/${versionId}/pdf`),
  );
  const ownerDone = pageOwner.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      new URL(r.url()).pathname.endsWith(`/versions/${versionId}/pdf`),
  );
  const ownerDownload = pageOwner.waitForEvent('download');
  await pageOwner.getByRole('button', { name: 'Download PDF' }).click();
  const bodyRequest = await bodyPromise;
  await Promise.all([ownerDone, ownerDownload]);

  // A second, unrelated user registers and tries to export the same version.
  const ctxIntruder = await browser.newContext();
  const pageIntruder = await ctxIntruder.newPage();
  await registerUser(pageIntruder, uniqueEmail('pdf-intruder'));
  const token = await readAccessToken(ctxIntruder);

  const exportRes = await ctxIntruder.request.post(
    `${HTTP_BASE}/api/v1/versions/${versionId}/pdf`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: bodyRequest.postDataJSON(),
    },
  );
  expect([403, 404]).toContain(exportRes.status());

  await ctxIntruder.close();
  await ctxOwner.close();
});

async function readDownload(download: Download): Promise<Uint8Array> {
  const { mkdtemp, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = await mkdtemp(join(tmpdir(), 'resumeiq-pdf-'));
  const target = join(dir, 'resume.pdf');
  await download.saveAs(target);
  const buffer = await readFile(target);
  await rm(dir, { recursive: true, force: true });
  return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
}

/**
 * Parses the downloaded file with pdf.js (the same library the backend uses to
 * verify exports) and returns every page's selectable text plus the page count.
 */
async function extractPdfText(bytes: Uint8Array): Promise<{ text: string; pageCount: number }> {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({ data: bytes, isEvalSupported: false });
  const doc = await task.promise;
  const chunks: string[] = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    chunks.push(
      content.items
        .map((item) => item.str)
        .join(' ')
        .trim(),
    );
  }
  return { text: chunks.join('\n'), pageCount: doc.numPages };
}
