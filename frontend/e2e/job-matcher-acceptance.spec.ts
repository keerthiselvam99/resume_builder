import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { analyzeJobMatch } from '../../shared/job-matcher';
import { sampleContent } from '../scripts/shared/sample-content';
import { registerUser, readAccessToken, uniqueEmail } from './support/http-flow';

const OUT = join(process.cwd(), 'job-matcher-acceptance');
const API = 'http://127.0.0.1:3000/api/v1';
const description =
  'Angular, TypeScript, JavaScript, REST APIs, Node.js, AWS, testing, CI/CD and Cypress are required. Docker is preferred. The successful candidate must build accessible reliable applications, collaborate with product teams, review code, document technical decisions, improve performance, mentor engineers, and deliver measurable customer outcomes.';
const ORIGINAL_BREAKDOWN = {
  overallScore: 39,
  required: [
    'accessible',
    'applications',
    'aws',
    'build',
    'ci/cd',
    'code',
    'collaborate',
    'customer',
    'cypress',
    'decisions',
    'deliver',
    'document',
    'engineers',
    'improve',
    'measurable',
    'mentor',
    'outcomes',
    'performance',
    'product',
    'reliable',
    'review',
    'teams',
    'technical',
    'testing',
  ],
  unspecified: ['angular', 'javascript', 'node.js', 'rest api', 'typescript'],
  preferred: ['docker'],
  matched: [
    'angular',
    'applications',
    'aws',
    'ci/cd',
    'customer',
    'docker',
    'engineers',
    'improve',
    'javascript',
    'node.js',
    'performance',
    'rest api',
    'testing',
    'typescript',
  ],
  missing: [
    'accessible',
    'build',
    'code',
    'collaborate',
    'cypress',
    'decisions',
    'deliver',
    'document',
    'measurable',
    'mentor',
    'outcomes',
    'product',
    'reliable',
    'review',
    'teams',
    'technical',
  ],
  categories: [
    { name: 'Skills', score: 42, weight: 35, contribution: 14.7 },
    { name: 'Experience', score: 27, weight: 25, contribution: 6.75 },
    { name: 'Title', score: 67, weight: 15, contribution: 10.05 },
    { name: 'Projects', score: 20, weight: 10, contribution: 2 },
    { name: 'Education', score: 0, weight: 10, contribution: 0 },
    { name: 'Quality', score: 100, weight: 5, contribution: 5 },
  ],
};

for (const run of [1, 2, 3])
  test(`Job Matcher full-stack acceptance ${run}/3`, async ({ page, request }) => {
    test.setTimeout(180_000);
    await mkdir(OUT, { recursive: true });
    await registerUser(page, uniqueEmail(`job-match-${run}`));
    const token = await readAccessToken(page.context());
    const headers = { Authorization: `Bearer ${token}` };
    const create = async (name: string, content: typeof sampleContent) => {
      const resume = await request.post(`${API}/resumes`, {
        headers,
        data: { name, templateId: 't-classic-ats-navy' },
      });
      expect(resume.status()).toBe(201);
      const resumeBody = await resume.json();
      const versions = await request.get(`${API}/resumes/${resumeBody.id}/versions`, { headers });
      const version = (await versions.json())[0];
      expect(
        (
          await request.patch(`${API}/versions/${version.id}/content`, {
            headers,
            data: { content },
          })
        ).status(),
      ).toBe(200);
      expect(
        (await request.post(`${API}/resumes/${resumeBody.id}/save`, { headers })).status(),
      ).toBe(200);
      return { resumeId: resumeBody.id as string, versionId: version.id as string };
    };
    const strongContent = {
      ...structuredClone(sampleContent),
      skills: [...sampleContent.skills, 'JavaScript', 'REST APIs', 'Testing', 'CI/CD'],
    };
    const strong = await create(`Angular Resume ${run}`, strongContent);
    const partialContent = {
      ...structuredClone(sampleContent),
      contacts: { ...sampleContent.contacts, title: 'Frontend Developer' },
      summary: 'Frontend developer building Angular applications.',
      skills: ['Angular', 'TypeScript', 'JavaScript', 'Testing'],
      experiences: [sampleContent.experiences[0]],
      projects: [],
      education: [],
      certifications: [],
    };
    const partial = await create(`Partial Angular Resume ${run}`, partialContent);
    const weak = await create(`Hospitality Resume ${run}`, {
      ...structuredClone(sampleContent),
      contacts: { ...sampleContent.contacts, title: 'Restaurant Manager' },
      summary: 'Hospitality leader focused on guest service and food safety.',
      skills: ['Hospitality', 'Scheduling', 'Food safety'],
      experiences: [],
      projects: [],
      education: [],
      certifications: [],
    });
    await page.goto('/job-matcher');
    await expect(page.getByRole('heading', { name: 'Job Matcher' })).toBeVisible();
    if (run === 1) await page.screenshot({ path: join(OUT, 'empty-page.png'), fullPage: true });
    const resumeSelect = page.locator('select[formControlName="resumeId"]');
    const versionSelect = page.locator('select[formControlName="versionId"]');
    await resumeSelect.selectOption(strong.resumeId);
    await expect(versionSelect).toHaveValue(strong.versionId);
    await page.getByLabel('Job title').fill('Senior Angular Developer');
    await page.getByLabel('Company').fill('Northstar Careers');
    await page.getByLabel('Job description').fill(description);
    if (run === 1)
      await page.screenshot({ path: join(OUT, 'completed-input-form.png'), fullPage: true });
    if (run === 1)
      await page.route(
        '**/job-match',
        async (route) => {
          await new Promise((resolve) => setTimeout(resolve, 700));
          await route.continue();
        },
        { times: 1 },
      );
    const responsePromise = page.waitForResponse(
      (r) => r.url().endsWith('/job-match') && r.status() === 200,
    );
    await page.getByRole('button', { name: 'Analyse match' }).click();
    if (run === 1) {
      await expect(page.getByText('Analysing the saved resume')).toBeVisible();
      await page.screenshot({ path: join(OUT, 'loading-state.png'), fullPage: true });
    }
    const apiResult = await (await responsePromise).json();
    await expect(page.getByRole('heading', { name: 'Matched requirements' })).toBeVisible();
    const strongScore = Number(apiResult.overallScore);
    for (const keyword of [
      'angular',
      'typescript',
      'javascript',
      'rest api',
      'node.js',
      'aws',
      'testing',
      'ci/cd',
    ])
      expect(apiResult.matchedKeywords.map((x: { keyword: string }) => x.keyword)).toContain(
        keyword,
      );
    expect(apiResult.missingKeywords.map((x: { keyword: string }) => x.keyword)).toContain(
      'cypress',
    );
    expect(apiResult.missingKeywords.map((x: { keyword: string }) => x.keyword)).toEqual([
      'cypress',
    ]);
    expect(strongScore).toBeGreaterThanOrEqual(70);
    expect(
      apiResult.categories.find((x: { key: string }) => x.key === 'skills').score,
    ).toBeGreaterThanOrEqual(80);
    expect(
      apiResult.categories.find((x: { key: string }) => x.key === 'experience').score,
    ).toBeGreaterThanOrEqual(65);
    expect(
      apiResult.matchedKeywords.every((x: { evidence: unknown[] }) => x.evidence.length > 0),
    ).toBe(true);
    const firstJson = JSON.stringify(apiResult);
    const repeatResponse = page.waitForResponse(
      (r) => r.url().endsWith('/job-match') && r.status() === 200,
    );
    await page.getByRole('button', { name: 'Run again' }).click();
    const repeated = await (await repeatResponse).json();
    expect(JSON.stringify(repeated)).toBe(firstJson);
    if (run === 1) {
      const stabilization = join(OUT, 'stabilization');
      await mkdir(stabilization, { recursive: true });
      await writeFile(
        join(stabilization, 'original-39-breakdown.json'),
        JSON.stringify(ORIGINAL_BREAKDOWN, null, 2),
      );
      await writeFile(join(OUT, 'api-result.json'), JSON.stringify(apiResult, null, 2));
      await writeFile(
        join(OUT, 'deterministic-comparison.json'),
        JSON.stringify(
          { equal: true, first: apiResult.inputSignature, second: repeated.inputSignature },
          null,
          2,
        ),
      );
      await page.screenshot({ path: join(OUT, 'strong-match-result.png'), fullPage: true });
      await page.screenshot({
        path: join(OUT, 'matched-missing-requirements.png'),
        fullPage: true,
      });
      await page.screenshot({ path: join(OUT, 'suggestions.png'), fullPage: true });
    }
    const partialResponse = await request.post(`${API}/versions/${partial.versionId}/job-match`, {
      headers,
      data: {
        jobTitle: 'Senior Angular Developer',
        company: 'Northstar Careers',
        jobDescription: description,
      },
    });
    expect(partialResponse.status()).toBe(200);
    const partialResult = await partialResponse.json();
    await resumeSelect.selectOption(weak.resumeId);
    await expect(versionSelect).toHaveValue(weak.versionId);
    const weakResponse = page.waitForResponse(
      (r) => r.url().endsWith('/job-match') && r.status() === 200,
    );
    await page.getByRole('button', { name: 'Run again' }).click();
    const weakResult = await (await weakResponse).json();
    expect(Number(weakResult.overallScore)).toBeLessThan(Number(partialResult.overallScore));
    expect(Number(partialResult.overallScore)).toBeLessThan(strongScore);
    if (run === 1) {
      const stabilization = join(OUT, 'stabilization');
      await writeFile(
        join(stabilization, 'corrected-calibration.json'),
        JSON.stringify({ strong: apiResult, partial: partialResult, weak: weakResult }, null, 2),
      );
      await writeFile(
        join(stabilization, 'requirement-extraction.json'),
        JSON.stringify(
          {
            required: [...apiResult.matchedKeywords, ...apiResult.missingKeywords].filter(
              (keyword: { priority: string }) => keyword.priority === 'required',
            ),
            preferred: [...apiResult.matchedKeywords, ...apiResult.missingKeywords].filter(
              (keyword: { priority: string }) => keyword.priority === 'preferred',
            ),
            unspecified: [...apiResult.matchedKeywords, ...apiResult.missingKeywords].filter(
              (keyword: { priority: string }) => keyword.priority === 'unspecified',
            ),
            matched: apiResult.matchedKeywords,
            missing: apiResult.missingKeywords,
          },
          null,
          2,
        ),
      );
      const directBase = {
        ...structuredClone(strongContent),
        skills: strongContent.skills.filter((skill) => skill !== 'Angular'),
      };
      const directInput = {
        versionId: strong.versionId,
        templateId: 't-classic-ats-navy',
        jobTitle: 'Senior Angular Developer',
        company: 'Northstar Careers',
        jobDescription: description,
      };
      const baseScore = analyzeJobMatch({ ...directInput, content: directBase }).overallScore;
      const relevantScore = analyzeJobMatch({
        ...directInput,
        content: strongContent,
      }).overallScore;
      const unrelatedScore = analyzeJobMatch({
        ...directInput,
        content: {
          ...structuredClone(strongContent),
          skills: [...strongContent.skills, 'Basket weaving'],
        },
      }).overallScore;
      const monotonicity = {
        baseScore,
        relevantScore,
        unrelatedScore,
        relevantSkillDoesNotLowerScore: relevantScore >= baseScore,
        unrelatedSkillDoesNotInflateScore: unrelatedScore === relevantScore,
      };
      expect(monotonicity.relevantSkillDoesNotLowerScore).toBe(true);
      expect(monotonicity.unrelatedSkillDoesNotInflateScore).toBe(true);
      await writeFile(
        join(stabilization, 'monotonicity.json'),
        JSON.stringify(monotonicity, null, 2),
      );
    }
    if (run === 1)
      await page.screenshot({ path: join(OUT, 'weak-match-result.png'), fullPage: true });
    const other = await request.post(`${API}/auth/register`, {
      data: { name: 'Other', email: uniqueEmail(`job-other-${run}`), password: 'E2ePassw0rd!' },
    });
    const otherToken = (await other.json()).accessToken;
    expect(
      (
        await request.post(`${API}/versions/${strong.versionId}/job-match`, {
          headers: { Authorization: `Bearer ${otherToken}` },
          data: {
            jobTitle: 'Senior Angular Developer',
            company: 'Northstar Careers',
            jobDescription: description,
          },
        })
      ).status(),
    ).toBe(404);
    await resumeSelect.selectOption(strong.resumeId);
    await expect(versionSelect).toHaveValue(strong.versionId);
    const restore = page.waitForResponse(
      (r) => r.url().endsWith('/job-match') && r.status() === 200,
    );
    await page.getByRole('button', { name: 'Run again' }).click();
    await restore;
    await page.getByRole('button', { name: 'Edit selected resume' }).click();
    await expect(page).toHaveURL(
      new RegExp(`/resumes/${strong.resumeId}/versions/${strong.versionId}/edit`),
    );
    const summary = page.locator('app-editor-summary-form textarea');
    const saved = page.waitForResponse(
      (r) =>
        r.request().method() === 'PATCH' &&
        r.url().includes(`/versions/${strong.versionId}/content`) &&
        r.status() === 200,
    );
    await summary.fill(`${sampleContent.summary} Expert in Cypress component testing.`);
    await saved;
    await page.goto('/job-matcher');
    await expect(page.getByText('Result is stale.')).toBeVisible();
    if (run === 1)
      await page.screenshot({ path: join(OUT, 'stale-result-state.png'), fullPage: true });
    const updatedResponse = page.waitForResponse(
      (r) => r.url().endsWith('/job-match') && r.status() === 200,
    );
    await page.getByRole('button', { name: 'Run again' }).click();
    const updated = await (await updatedResponse).json();
    expect(updated.inputSignature).not.toBe(apiResult.inputSignature);
    expect(updated.matchedKeywords.map((x: { keyword: string }) => x.keyword)).toContain('cypress');
    if (run === 1) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: join(OUT, 'mobile-result.png'), fullPage: true });
      const measurements = [];
      for (const viewport of [
        { width: 1440, height: 900 },
        { width: 1280, height: 800 },
        { width: 768, height: 1024 },
        { width: 390, height: 844 },
      ]) {
        await page.setViewportSize(viewport);
        measurements.push(
          await page.evaluate(
            (v) => ({
              viewport: v,
              scrollWidth: document.documentElement.scrollWidth,
              clientWidth: document.documentElement.clientWidth,
              overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
            }),
            viewport,
          ),
        );
      }
      expect(measurements.every((x) => !x.overflow)).toBe(true);
      await writeFile(
        join(OUT, 'responsive-measurements.json'),
        JSON.stringify(measurements, null, 2),
      );
    }
    await writeFile(
      join(OUT, `run-${run}.json`),
      JSON.stringify(
        {
          run,
          strongScore,
          partialScore: partialResult.overallScore,
          weakScore: weakResult.overallScore,
          deterministic: true,
          crossUserStatus: 404,
          updatedSignature: updated.inputSignature,
        },
        null,
        2,
      ),
    );
  });
