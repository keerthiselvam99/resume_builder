import { expect, test, Download, Locator, Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { registerUser, uniqueEmail } from './support/http-flow';

const OUT = join(process.cwd(), 'dummy-resume-acceptance');
const SUMMARY =
  'Senior Full Stack Engineer with 8 years of experience building accessible, secure and scalable web applications. Delivered Angular and Node.js platforms used by more than 100,000 customers, improved deployment frequency by 60%, and reduced production incidents through automated testing, observability and resilient cloud architecture.';
const SKILLS = [
  'Angular',
  'TypeScript',
  'JavaScript',
  'Node.js',
  'Express',
  'REST APIs',
  'HTML5',
  'CSS3',
  'PostgreSQL',
  'Oracle',
  'Docker',
  'AWS',
  'Playwright',
  'Vitest',
  'Git',
];
const PDF_VALUES = [
  'Maya Raman',
  'Northstar Digital',
  'BluePeak Systems',
  'Resume Intelligence Platform',
  'Release Quality Dashboard',
  'Anna University',
  'AWS Certified Solutions Architect',
  'Professional Scrum Master I',
  'Engineering Excellence Award',
  'Customer Impact Award',
];

async function createClassicResume(page: Page): Promise<void> {
  await page.goto('/templates');
  const card = page.locator('article.card', { hasText: 'Classic ATS' });
  await card.getByRole('button', { name: 'Preview & customise' }).click();
  await page.locator('app-button', { hasText: 'Use this template' }).click();
  await page.locator('input[type="text"]').fill('Maya Raman — Full Stack Engineer');
  await page.locator('app-button', { hasText: /Create and edit/i }).click();
  await expect(page).toHaveURL(/\/resumes\/[^/]+\/versions\/[^/]+\/edit/);
}

async function proveDraftControls(section: Locator, addName: string): Promise<void> {
  await section.getByRole('button', { name: addName }).click();
  const first = section.locator('[data-draft="true"]');
  await expect(first.locator('input').first()).toBeFocused();
  await first.getByRole('button', { name: 'Save' }).click();
  await expect(first.getByText(/required/i).first()).toBeVisible();
  await first.getByRole('button', { name: 'Cancel' }).click();
  await expect(section.locator('[data-draft="true"]')).toHaveCount(0);
}

async function addEntry(
  section: Locator,
  addName: string,
  fields: [string, string][],
): Promise<Locator> {
  await section.getByRole('button', { name: addName }).click();
  const card = section.locator('[data-draft="true"]');
  for (const [label, value] of fields) await card.getByLabel(label).fill(value);
  return card;
}

async function addHighlights(card: Locator, values: string[]): Promise<void> {
  for (const value of values) {
    const count = await card.getByPlaceholder('Write a highlight…').count();
    await card.getByRole('button', { name: 'Add highlight' }).click();
    await expect(card.getByPlaceholder('Write a highlight…')).toHaveCount(count + 1);
    await card.getByPlaceholder('Write a highlight…').nth(count).fill(value);
  }
}

async function save(card: Locator): Promise<void> {
  await card.getByRole('button', { name: 'Save' }).click();
  await expect(card).toHaveCount(0);
}

async function addTemporaryAndDelete(
  section: Locator,
  addName: string,
  fields: [string, string][],
  removeName: string,
): Promise<void> {
  const count = await section.locator('article.entry').count();
  const card = await addEntry(section, addName, fields);
  await save(card);
  await expect(section.locator('article.entry')).toHaveCount(count + 1);
  await section.getByRole('button', { name: removeName }).last().click();
  await expect(section.locator('article.entry')).toHaveCount(count);
}

async function runAts(page: Page): Promise<Record<string, unknown>> {
  const response = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      /\/ats-analysis$/.test(new URL(r.url()).pathname) &&
      r.status() === 200,
  );
  await page.locator('.ats-panel').getByRole('button', { name: 'Run analysis' }).click();
  return (await (await response).json()) as Record<string, unknown>;
}

async function previewContains(page: Page, text: string): Promise<void> {
  await expect
    .poll(() => page.locator('iframe.preview__iframe').getAttribute('srcdoc'))
    .toContain(text);
}

async function extractPdf(
  download: Download,
): Promise<{ bytes: Uint8Array; text: string; pages: number }> {
  const target = join(OUT, download.suggestedFilename());
  await download.saveAs(target);
  const { readFile } = await import('node:fs/promises');
  const buffer = await readFile(target);
  const bytes = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const parserBytes = bytes.slice();
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await getDocument({ data: parserBytes, isEvalSupported: false }).promise;
  const chunks: string[] = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const p = await doc.getPage(i);
    const content = await p.getTextContent();
    const pageText = content.items
      .map((item) => item.str)
      .join(' ')
      .trim();
    expect(pageText.length).toBeGreaterThan(0);
    chunks.push(pageText);
  }
  return { bytes, text: chunks.join('\n'), pages: doc.numPages };
}

test('realistic Maya Raman full-stack acceptance', async ({ page, request }) => {
  test.setTimeout(480_000);
  await mkdir(OUT, { recursive: true });
  expect((await request.get('http://127.0.0.1:3000/livez')).status()).toBe(200);
  expect((await request.get('http://127.0.0.1:3000/pdfz')).status()).toBe(200);
  const email = uniqueEmail('maya-acceptance');
  await registerUser(page, email);
  await createClassicResume(page);

  const contact = page.locator('#editor-section-contact');
  for (const [label, value] of [
    ['Full name', 'Maya Raman'],
    ['Job title / Headline', 'Senior Full Stack Engineer'],
    ['Email', 'maya.raman@example.test'],
    ['Phone', '+91 90000 12345'],
    ['Location', 'Bengaluru, Karnataka'],
    ['LinkedIn URL', 'https://www.linkedin.com/in/maya-raman-demo'],
    ['GitHub URL', 'https://github.com/maya-raman-demo'],
    ['Portfolio URL', 'https://maya-raman-demo.example.com'],
  ] as [string, string][])
    await contact.getByLabel(label).fill(value);
  await page.locator('#editor-section-summary textarea').fill(SUMMARY);
  const skills = page.locator('#editor-section-skills');
  for (const skill of SKILLS) {
    await skills.getByLabel('Add a skill').fill(skill);
    await skills.getByRole('button', { name: 'Add', exact: true }).click();
  }

  const incomplete = await runAts(page);
  expect(incomplete['overallScore']).not.toBe(97);
  const incompleteCategories = incomplete['categories'] as { key: string; score: number }[];
  expect(incompleteCategories.find((c) => c.key === 'experience')?.score).toBeLessThan(100);
  expect(incompleteCategories.find((c) => c.key === 'education')?.score).toBeLessThan(100);
  expect(JSON.stringify(incomplete['findings'])).toMatch(/experience/i);
  expect(JSON.stringify(incomplete['findings'])).toMatch(/education/i);
  await page.screenshot({ path: join(OUT, 'ats-incomplete.png'), fullPage: true });

  const exp = page.locator('#editor-section-experience');
  await proveDraftControls(exp, 'Add experience');
  let card = await addEntry(exp, 'Add experience', [
    ['Company', 'Northstar Digital'],
    ['Role', 'Senior Full Stack Engineer'],
    ['Location', 'Bengaluru, India'],
    ['Start date', '2022-01'],
  ]);
  await card.getByLabel('Currently working here').check();
  await addHighlights(card, [
    'Built Angular and Node.js customer platforms serving more than 100,000 monthly users.',
    'Reduced page-load time by 42% through lazy loading, caching and bundle optimization.',
    'Increased deployment frequency by 60% by introducing automated CI/CD quality gates.',
    'Mentored six engineers and established accessible component and testing standards.',
  ]);
  await save(card);
  card = await addEntry(exp, 'Add experience', [
    ['Company', 'BluePeak Systems'],
    ['Role', 'Software Engineer'],
    ['Location', 'Chennai, India'],
    ['Start date', '2018-06'],
    ['End date', '2021-12'],
  ]);
  await addHighlights(card, [
    'Developed REST APIs and background services processing more than two million monthly transactions.',
    'Reduced production incidents by 35% using integration tests, monitoring and structured logging.',
    'Migrated legacy UI modules to Angular while preserving existing customer workflows.',
  ]);
  await save(card);
  await addTemporaryAndDelete(
    exp,
    'Add experience',
    [
      ['Company', 'Temporary Employer'],
      ['Role', 'Temporary Role'],
    ],
    'Remove experience',
  );

  const projects = page.locator('#editor-section-projects');
  await proveDraftControls(projects, 'Add project');
  card = await addEntry(projects, 'Add project', [
    ['Title', 'Resume Intelligence Platform'],
    ['Role', 'Lead Developer'],
    ['Start date', '2024-03'],
    ['URL', 'https://github.com/maya-raman-demo/resume-platform'],
    [
      'Summary',
      'Designed a resume-building platform with live A4 previews, ATS analysis, secure PDF export and automated visual-regression testing.',
    ],
    ['Technologies', 'Angular, TypeScript, Node.js, Playwright, Docker'],
  ]);
  await addHighlights(card, ['Delivered secure ATS analysis and PDF export.']);
  await save(card);
  card = await addEntry(projects, 'Add project', [
    ['Title', 'Release Quality Dashboard'],
    ['Role', 'Full Stack Developer'],
    ['Start date', '2023-01'],
    ['End date', '2024-02'],
    ['URL', 'https://github.com/maya-raman-demo/quality-dashboard'],
    [
      'Summary',
      'Built an engineering dashboard that combines deployment, testing and production-health metrics for release decisions.',
    ],
    ['Technologies', 'Angular, Express, PostgreSQL, AWS'],
  ]);
  await save(card);
  await addTemporaryAndDelete(
    projects,
    'Add project',
    [['Title', 'Temporary Project']],
    'Remove project',
  );

  const education = page.locator('#editor-section-education');
  await proveDraftControls(education, 'Add education');
  card = await addEntry(education, 'Add education', [
    ['Institution', 'Anna University'],
    ['Degree', 'B.E. Computer Science and Engineering'],
    ['Start date', '2014-08'],
    ['End date', '2018-05'],
    ['Grade / Score (optional)', '8.7 CGPA'],
  ]);
  await save(card);
  await addTemporaryAndDelete(
    education,
    'Add education',
    [['Institution', 'Temporary University']],
    'Remove education',
  );

  const certs = page.locator('#editor-section-certifications');
  await proveDraftControls(certs, 'Add certification');
  for (const fields of [
    [
      ['Certification name', 'AWS Certified Solutions Architect — Associate'],
      ['Issuing organization', 'Amazon Web Services'],
      ['Issue date', '2024-06'],
      ['Credential ID', 'AWS-DEMO-12345'],
    ],
    [
      ['Certification name', 'Professional Scrum Master I'],
      ['Issuing organization', 'Scrum.org'],
      ['Issue date', '2023-11'],
      ['Credential ID', 'PSM-DEMO-67890'],
    ],
  ] as [string, string][][]) {
    card = await addEntry(certs, 'Add certification', fields);
    await save(card);
  }
  await addTemporaryAndDelete(
    certs,
    'Add certification',
    [
      ['Certification name', 'Temporary Certificate'],
      ['Issuing organization', 'Temporary Issuer'],
    ],
    'Remove certification',
  );

  const awards = page.locator('#editor-section-awards');
  await proveDraftControls(awards, 'Add award');
  for (const fields of [
    [
      ['Award or achievement title', 'Engineering Excellence Award'],
      ['Issuing organization', 'Northstar Digital'],
      ['Date', '2024-12'],
      ['Description', 'Recognized for improving platform performance and release reliability.'],
    ],
    [
      ['Award or achievement title', 'Customer Impact Award'],
      ['Issuing organization', 'BluePeak Systems'],
      ['Date', '2021-09'],
      ['Description', 'Recognized for delivering a critical customer migration without downtime.'],
    ],
  ] as [string, string][][]) {
    card = await addEntry(awards, 'Add award', fields);
    await save(card);
  }
  await addTemporaryAndDelete(
    awards,
    'Add award',
    [['Award or achievement title', 'Temporary Award']],
    'Remove award',
  );

  // Edit a committed item and prove preview reflects it.
  await exp
    .locator('article.entry')
    .first()
    .getByLabel('Role')
    .fill('Principal Full Stack Engineer');
  await projects
    .locator('article.entry')
    .first()
    .getByLabel('Title')
    .fill('Resume Intelligence Platform v2');
  await education
    .locator('article.entry')
    .first()
    .getByLabel('Degree')
    .fill('B.E. Computer Science and Engineering (Honours)');
  await certs
    .locator('article.entry')
    .first()
    .getByLabel('Credential ID')
    .fill('AWS-DEMO-12345-EDITED');
  await awards
    .locator('article.entry')
    .first()
    .getByLabel('Description')
    .fill(
      'Recognized for improving platform performance and release reliability. Verified acceptance edit.',
    );
  await previewContains(page, 'Principal Full Stack Engineer');
  await previewContains(page, 'Resume Intelligence Platform v2');
  await previewContains(page, 'Honours');
  await previewContains(page, 'AWS-DEMO-12345-EDITED');
  await previewContains(page, 'Verified acceptance edit');
  await expect(page.locator('.ats-panel__stale')).toBeVisible();
  await page.screenshot({ path: join(OUT, 'ats-stale.png'), fullPage: true });
  const complete = await runAts(page);
  expect(Number(complete['overallScore'])).toBeGreaterThan(Number(incomplete['overallScore']));
  expect(JSON.stringify(complete['findings'])).not.toMatch(
    /No work experience entries|No education entries/,
  );
  const deterministic = await runAts(page);
  expect(deterministic).toEqual(complete);
  await writeFile(
    join(OUT, 'ats-before-after.json'),
    JSON.stringify({ incomplete, complete }, null, 2),
  );
  await page.screenshot({ path: join(OUT, 'full-populated-editor.png'), fullPage: true });

  await expect(page.locator('.editor__save-label')).toHaveText('Draft saved', { timeout: 10_000 });
  await page.getByRole('button', { name: 'Save resume' }).click();
  await page.reload();
  for (const value of PDF_VALUES) await previewContains(page, value);
  await page.screenshot({ path: join(OUT, 'persisted-after-reload.png'), fullPage: true });

  const measurements: Record<string, unknown> = {};
  for (const [w, h] of [
    [1440, 900],
    [1280, 800],
    [1024, 768],
    [768, 1024],
    [390, 844],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    measurements[`${w}x${h}`] = await page.evaluate(() => {
      const frame = document.querySelector('iframe.preview__iframe') as HTMLIFrameElement | null;
      const pageEl = frame?.contentDocument?.querySelector('.resume-page') as HTMLElement | null;
      const report = (frame?.contentWindow as unknown as { __paginationReport?: unknown })
        ?.__paginationReport;
      return {
        documentOverflow:
          document.documentElement.scrollWidth - document.documentElement.clientWidth,
        bodyOverflow: document.body.scrollWidth - document.body.clientWidth,
        previewRatio: pageEl
          ? pageEl.getBoundingClientRect().height / pageEl.getBoundingClientRect().width
          : null,
        report,
      };
    });
    expect((measurements[`${w}x${h}`] as { documentOverflow: number }).documentOverflow).toBe(0);
    if (w === 1440)
      await page.screenshot({ path: join(OUT, 'desktop-alignment.png'), fullPage: true });
    if (w === 390)
      await page.screenshot({ path: join(OUT, 'mobile-alignment.png'), fullPage: true });
  }
  await writeFile(
    join(OUT, 'overflow-alignment-measurements.json'),
    JSON.stringify(measurements, null, 2),
  );
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.getByRole('button', { name: 'Change template' }).click();
  const executive = page.locator('article.card', { hasText: 'Executive Banner' });
  await executive.getByRole('button', { name: 'Preview & customise' }).click();
  await page.locator('app-button', { hasText: 'Apply this template' }).click();
  await previewContains(page, 'Maya Raman');
  await expect(page.locator('.ats-panel__stale')).toBeVisible();
  const changedTemplate = await runAts(page);
  expect(changedTemplate['overallScore']).not.toBeUndefined();
  await page.screenshot({ path: join(OUT, 'template-changed-preview.png'), fullPage: true });
  const pagination = await page
    .locator('iframe.preview__iframe')
    .evaluate((el) => (el as HTMLIFrameElement).contentWindow?.__paginationReport);
  expect(pagination).toMatchObject({
    overflowingPages: 0,
    orphanedHeadings: 0,
    clippedBlocks: 0,
    missingSections: 0,
  });
  await writeFile(join(OUT, 'pagination-report.json'), JSON.stringify(pagination, null, 2));

  await page.getByRole('button', { name: 'Change template' }).click();
  const classic = page.locator('article.card', { hasText: 'Classic ATS' });
  await classic.getByRole('button', { name: 'Preview & customise' }).click();
  await page.locator('app-button', { hasText: 'Apply this template' }).click();
  await previewContains(page, 'Maya Raman');

  const pdfResponse = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      /\/pdf$/.test(new URL(r.url()).pathname) &&
      r.status() === 200,
  );
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download PDF' }).click();
  const [response, download] = await Promise.all([pdfResponse, downloadPromise]);
  expect(response.headers()['content-type']).toBe('application/pdf');
  await expect(page.locator('.editor__pdf-label')).toHaveText('Downloaded');
  await page.screenshot({ path: join(OUT, 'pdf-success.png'), fullPage: true });
  const pdf = await extractPdf(download);
  expect(Buffer.from(pdf.bytes.subarray(0, 5)).toString('latin1')).toBe('%PDF-');
  for (const value of PDF_VALUES) expect(pdf.text).toContain(value);
  await writeFile(join(OUT, 'extracted-pdf-text.txt'), pdf.text);
  await writeFile(
    join(OUT, 'pdf-metadata.json'),
    JSON.stringify(
      {
        status: response.status(),
        mime: response.headers()['content-type'],
        filename: download.suggestedFilename(),
        size: pdf.bytes.length,
        magic: '%PDF-',
        pageCount: pdf.pages,
      },
      null,
      2,
    ),
  );

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.locator('app-input input').fill(email);
  await page.locator('app-password-input input').fill('E2ePassw0rd!');
  await page.getByRole('button', { name: 'Log in' }).click();
  let resumeCard = page.locator('article.card', { hasText: 'Maya Raman — Full Stack Engineer' });
  await expect(resumeCard).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept('Maya Raman — Full Stack Engineer RC'));
  await resumeCard.getByRole('button', { name: 'Rename' }).click();
  resumeCard = page.locator('article.card', { hasText: 'Maya Raman — Full Stack Engineer RC' });
  await expect(resumeCard).toBeVisible();
  await resumeCard.getByRole('button', { name: 'Clone' }).click();
  await page.getByRole('link', { name: 'Drafts' }).click();
  await expect(
    page.locator('article.card', { hasText: /Maya Raman.*Full Stack Engineer RC/ }),
  ).toBeVisible();
  await page.screenshot({ path: join(OUT, 'my-resumes-after-relogin.png'), fullPage: true });
});
