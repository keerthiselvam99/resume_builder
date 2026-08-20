import { expect, test, Page, Locator } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const EVIDENCE = join(process.cwd(), 'final-functional-review');
const STABILIZATION = join(process.cwd(), 'job-matcher-acceptance', 'stabilization');
const DEMO_MESSAGE =
  'PDF download requires the local backend. Start the full application to export your resume.';

async function loginAndCreate(page: Page): Promise<void> {
  await page.goto('/login');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('app-input input').fill('arun@example.com');
  await page.locator('app-password-input input').fill('Password123!');
  await page.getByRole('button', { name: 'Log in' }).click();
  await page.goto('/templates/t-classic-ats-navy');
  await page.locator('app-button', { hasText: 'Use this template' }).click();
  await page.locator('input[type="text"]').fill('Final Functional Demo');
  await page.locator('app-button', { hasText: /Create and edit/i }).click();
  await expect(page).toHaveURL(/\/resumes\/[^/]+\/versions\/[^/]+\/edit/);
}

async function draft(section: Locator, addName: string): Promise<Locator> {
  // Prove Cancel independently before creating the committed entry.
  await section.getByRole('button', { name: addName }).click();
  await section.getByRole('button', { name: 'Cancel' }).click();
  await expect(section.locator('[data-draft="true"]')).toHaveCount(0);

  await section.getByRole('button', { name: addName }).click();
  const card = section.locator('[data-draft="true"]');
  await card.getByRole('button', { name: 'Save' }).click();
  await expect(card.getByText(/required/i).first()).toBeVisible();
  return card;
}

async function addAllSections(page: Page): Promise<void> {
  let section = page.locator('#editor-section-experience');
  let card = await draft(section, 'Add experience');
  await card.getByLabel('Company').fill('Gate Labs');
  await card.getByLabel('Role').fill('Release Engineer');
  await card.getByRole('combobox', { name: 'Start date month' }).selectOption('01');
  await card.getByRole('combobox', { name: 'Start date year' }).selectOption('2021');
  await card.getByRole('combobox', { name: 'End date month' }).selectOption('12');
  await card.getByRole('combobox', { name: 'End date year' }).selectOption('2024');
  await card.getByRole('button', { name: 'Add highlight' }).click();
  await card
    .getByPlaceholder('Write a highlight…')
    .fill('Built 24 deterministic browser release gates and reduced escaped defects by 35%.');
  await card.getByRole('button', { name: 'Add highlight' }).click();
  await card
    .getByPlaceholder('Write a highlight…')
    .nth(1)
    .fill('Reduced regression triage time by 40% with zero-retry checks across 18 workflows.');
  await card.getByRole('button', { name: 'Save' }).click();

  section = page.locator('#editor-section-projects');
  card = await draft(section, 'Add project');
  await card.getByLabel('Title').fill('Evidence Console');
  await card.getByLabel('Summary').fill('A release evidence application');
  await card.getByRole('button', { name: 'Add highlight' }).click();
  await card.getByPlaceholder('Write a highlight…').fill('Captured current resume evidence');
  await card.getByRole('button', { name: 'Add highlight' }).click();
  await card.getByPlaceholder('Write a highlight…').nth(1).fill('Verified exported PDF content');
  await card.getByRole('button', { name: 'Save' }).click();

  section = page.locator('#editor-section-education');
  card = await draft(section, 'Add education');
  await card.getByLabel('Institution').fill('Quality University');
  await card.getByLabel('Degree').fill('BSc Software Quality');
  await card.getByRole('combobox', { name: 'Start date month' }).selectOption('01');
  await card.getByRole('combobox', { name: 'Start date year' }).selectOption('2020');
  await card.getByRole('combobox', { name: 'End date month' }).selectOption('05');
  await card.getByRole('combobox', { name: 'End date year' }).selectOption('2024');
  await card.getByRole('button', { name: 'Save' }).click();

  section = page.locator('#editor-section-certifications');
  card = await draft(section, 'Add certification');
  await card.getByLabel('Certification name').fill('Certified Release Professional');
  await card.getByLabel('Issuing organization').fill('Test Standards Board');
  await card.getByRole('button', { name: 'Save' }).click();

  section = page.locator('#editor-section-awards');
  card = await draft(section, 'Add award');
  await card.getByLabel('Award or achievement title').fill('Zero Retry Award');
  await card.getByLabel('Issuing organization').fill('Quality Council');
  await card.getByRole('button', { name: 'Save' }).click();
}

async function expectPreview(page: Page, value: string, present = true): Promise<void> {
  const assertion = expect.poll(() =>
    page.locator('iframe.preview__iframe').getAttribute('srcdoc'),
  );
  if (present) {
    await assertion.toContain(value);
  } else {
    await assertion.not.toContain(value);
  }
}

async function captureAtsState(page: Page) {
  return page.evaluate(() => {
    const key = Object.keys(sessionStorage).find((candidate) =>
      candidate.startsWith('resumeiq_ats_'),
    );
    const cached = key ? JSON.parse(sessionStorage.getItem(key) ?? 'null') : null;
    const versionId = key?.slice('resumeiq_ats_'.length) ?? '';
    const versions = JSON.parse(localStorage.getItem('resumeiq_versions') ?? '[]') as {
      id: string;
      templateId: string;
      content: unknown;
    }[];
    const version = versions.find((candidate) => candidate.id === versionId) ?? null;
    const persistedSignature = version
      ? `${version.templateId}|${JSON.stringify(version.content)}`
      : null;
    return { versionId, cached, version, persistedSignature };
  });
}

test('final Demo functional correction journey', async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  await mkdir(EVIDENCE, { recursive: true });
  await mkdir(STABILIZATION, { recursive: true });
  let pdfRequests = 0;
  page.on('request', (request) => {
    if (/\/versions\/[^/]+\/pdf$/.test(new URL(request.url()).pathname)) pdfRequests += 1;
  });

  await loginAndCreate(page);
  await page.locator('#editor-section-contact').getByLabel('Full name').fill('Release Test User');
  await page
    .locator('#editor-section-contact')
    .getByLabel('Email')
    .fill('release.test@example.com');
  await page
    .locator('#editor-section-summary textarea')
    .fill('Quality engineer focused on accessible deterministic release verification.');
  const skills = page.locator('#editor-section-skills');
  await skills.getByLabel('Add a skill').fill('Angular');
  await skills.getByRole('button', { name: 'Add', exact: true }).click();

  const panel = page.locator('.ats-panel');
  const beforeStartedAt = Date.now();
  await panel.getByRole('button', { name: 'Run analysis' }).click();
  await expect(panel.getByText('Analysing your resume…')).toBeVisible();
  await expect(panel.locator('.ats-score')).toBeVisible();
  const beforeCompletedAt = Date.now();
  const before = Number(await panel.locator('.ats-score').getAttribute('aria-valuenow'));
  const beforeExperience = await panel
    .getByRole('progressbar', { name: /Work experience score/ })
    .getAttribute('aria-valuenow');
  const beforeEducation = await panel
    .getByRole('progressbar', { name: /Education score/ })
    .getAttribute('aria-valuenow');
  const beforeFindings = await panel.locator('.ats-finding__message').allTextContents();
  const beforeState = await captureAtsState(page);
  expect(before).not.toBe(97);
  await expect(
    panel.getByRole('progressbar', { name: /Work experience score/ }),
  ).not.toHaveAttribute('aria-valuenow', '100');
  await expect(panel.getByRole('progressbar', { name: /Education score/ })).not.toHaveAttribute(
    'aria-valuenow',
    '100',
  );
  await expect(panel.locator('.ats-panel__findings')).toContainText(/experience/i);
  await expect(panel.locator('.ats-panel__findings')).toContainText(/education/i);
  await page.screenshot({ path: join(EVIDENCE, 'ats-before-sections.png'), fullPage: true });

  await addAllSections(page);
  await expectPreview(page, 'Gate Labs');
  await expectPreview(page, 'Evidence Console');
  await expectPreview(page, 'Quality University');
  await expectPreview(page, 'Certified Release Professional');
  await expectPreview(page, 'Zero Retry Award');
  await expect(panel.locator('.ats-panel__stale')).toBeVisible();
  const afterStartedAt = Date.now();
  await panel.getByRole('button', { name: 'Run analysis' }).click();
  await expect(panel.getByText('Analysing your resume…')).toBeVisible();
  await expect(panel.locator('.ats-score')).toBeVisible();
  const afterCompletedAt = Date.now();
  const after = Number(await panel.locator('.ats-score').getAttribute('aria-valuenow'));
  const afterExperience = await panel
    .getByRole('progressbar', { name: /Work experience score/ })
    .getAttribute('aria-valuenow');
  const afterEducation = await panel
    .getByRole('progressbar', { name: /Education score/ })
    .getAttribute('aria-valuenow');
  const afterFindings = await panel.locator('.ats-finding__message').allTextContents();
  const afterState = await captureAtsState(page);
  expect(after).toBeGreaterThan(before);
  await expect(panel.locator('.ats-panel__findings')).not.toContainText(
    'No work experience entries are present.',
  );
  await expect(panel.locator('.ats-panel__findings')).not.toContainText(
    'No education entries are present.',
  );
  expect(afterExperience).not.toBe('0');
  expect(afterEducation).not.toBe('80');
  expect(afterState.cached?.signature).toBe(afterState.persistedSignature);
  await page.screenshot({ path: join(EVIDENCE, 'all-sections-and-ats-after.png'), fullPage: true });
  await writeFile(
    join(EVIDENCE, 'ats-before-after.json'),
    JSON.stringify(
      {
        before: {
          overall: before,
          experience: beforeExperience,
          education: beforeEducation,
          findings: beforeFindings,
        },
        after: {
          overall: after,
          experience: afterExperience,
          education: afterEducation,
          findings: afterFindings,
        },
      },
      null,
      2,
    ),
    'utf8',
  );
  await writeFile(
    join(STABILIZATION, 'ats-before-after.json'),
    JSON.stringify(
      {
        before: {
          startedAt: beforeStartedAt,
          completedAt: beforeCompletedAt,
          durationMs: beforeCompletedAt - beforeStartedAt,
          overall: before,
          experience: beforeExperience,
          education: beforeEducation,
          findings: beforeFindings,
          state: beforeState,
        },
        after: {
          startedAt: afterStartedAt,
          completedAt: afterCompletedAt,
          durationMs: afterCompletedAt - afterStartedAt,
          overall: after,
          experience: afterExperience,
          education: afterEducation,
          findings: afterFindings,
          state: afterState,
        },
      },
      null,
      2,
    ),
  );
  await writeFile(
    join(STABILIZATION, `ats-run-${testInfo.repeatEachIndex + 1}.json`),
    JSON.stringify(
      {
        run: testInfo.repeatEachIndex + 1,
        retries: testInfo.retry,
        before: { overall: before, experience: beforeExperience, education: beforeEducation },
        after: { overall: after, experience: afterExperience, education: afterEducation },
        currentContentSignatureVerified:
          afterState.cached?.signature === afterState.persistedSignature,
      },
      null,
      2,
    ),
  );

  await expect(page.locator('.editor__save-label')).toHaveText('Draft saved', { timeout: 10_000 });
  await page.getByRole('button', { name: 'Save resume' }).click();
  await page.reload();
  await expect(page.locator('#editor-section-experience').getByLabel('Company')).toHaveValue(
    'Gate Labs',
  );
  await expect(page.locator('#editor-section-projects').getByLabel('Title')).toHaveValue(
    'Evidence Console',
  );
  await expect(page.locator('#editor-section-education').getByLabel('Institution')).toHaveValue(
    'Quality University',
  );
  await expect(
    page.locator('#editor-section-certifications').getByLabel('Certification name'),
  ).toHaveValue('Certified Release Professional');
  await expect(
    page.locator('#editor-section-awards').getByLabel('Award or achievement title'),
  ).toHaveValue('Zero Retry Award');
  await page.screenshot({ path: join(EVIDENCE, 'persisted-after-reload.png'), fullPage: true });

  const certification = page.locator('#editor-section-certifications article.entry').first();
  await certification.getByLabel('Certification name').fill('Certified Release Gate Professional');
  await expect(page.locator('.editor__save-label')).toHaveText('Saved', { timeout: 10_000 });
  await page
    .locator('#editor-section-awards')
    .getByRole('button', { name: 'Remove award' })
    .click();
  await expectPreview(page, 'Certified Release Gate Professional');
  await expectPreview(page, 'Zero Retry Award', false);

  const download = page.getByRole('button', { name: 'Download PDF' });
  await expect(download).toBeDisabled();
  await expect(download).toHaveAttribute('aria-describedby', 'editor-pdf-demo-hint');
  await expect(download).toHaveAttribute('title', DEMO_MESSAGE);
  await expect(page.locator('#editor-pdf-demo-hint')).toHaveText(DEMO_MESSAGE);
  await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0);
  expect(pdfRequests).toBe(0);
  await page.screenshot({ path: join(EVIDENCE, 'demo-disabled-pdf.png'), fullPage: true });
});
