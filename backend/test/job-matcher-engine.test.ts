import { describe, expect, it } from 'vitest';
import { analyzeJobMatch } from '../../shared/job-matcher';
import { emptyResumeContent, ResumeContent } from '../src/types/domain';

const description = `We require Angular, TypeScript, JavaScript, REST APIs, Node.js, AWS and testing experience. Candidates must use CI/CD and build accessible applications. Docker is preferred and Kubernetes is nice to have. The role partners with product teams to deliver measurable outcomes and reliable software for customers.`;
const strong: ResumeContent = {
  ...structuredClone(emptyResumeContent),
  contacts: { ...emptyResumeContent.contacts, title: 'Senior Angular Developer' },
  summary: 'Angular developer building accessible web applications on AWS.',
  skills: ['Angular', 'TypeScript', 'JavaScript', 'REST APIs', 'NodeJS', 'AWS', 'Testing', 'CI/CD'],
  experiences: [
    {
      id: 'e1',
      company: 'Example',
      role: 'Senior Angular Developer',
      location: 'Remote',
      startDate: '2022',
      endDate: '',
      current: true,
      bullets: ['Built Angular applications and increased test coverage by 40%.'],
    },
  ],
  projects: [
    {
      id: 'p1',
      name: 'Portal',
      role: 'Developer',
      startDate: '2023',
      endDate: '2024',
      description: 'AWS customer portal',
      technologies: 'Angular, TypeScript',
      link: '',
      bullets: ['Delivered REST APIs with Node.js.'],
    },
  ],
  education: [
    {
      id: 'd1',
      institution: 'University',
      degree: 'BSc',
      field: 'Computer Science',
      startDate: '2015',
      endDate: '2019',
      gpa: '',
    },
  ],
  certifications: [
    {
      id: 'c1',
      name: 'AWS Developer',
      issuer: 'AWS',
      issueDate: '2024',
      doesNotExpire: true,
      expiryDate: '',
      credentialId: '',
      credentialUrl: '',
    },
  ],
};
const run = (content: ResumeContent = strong, jobDescription = description) =>
  analyzeJobMatch({
    content,
    versionId: 'v1',
    templateId: 't-classic-ats-navy',
    jobTitle: 'Senior Angular Developer',
    company: 'Northstar',
    jobDescription,
  });

describe('canonical Job Matcher engine', () => {
  it('calibrates strong, partial, and weak resumes with credible separation', () => {
    const calibrationDescription =
      'Angular, TypeScript, JavaScript, REST APIs, Node.js, AWS, testing, CI/CD and Cypress are required. Docker is preferred. This role builds reliable products with measurable outcomes.';
    const strongFixture: ResumeContent = {
      ...structuredClone(strong),
      skills: [...strong.skills, 'Docker'],
      experiences: [
        ...strong.experiences,
        {
          id: 'e2',
          company: 'Northstar',
          role: 'Angular Developer',
          location: 'Remote',
          startDate: '2020-01',
          endDate: '2021-12',
          current: false,
          bullets: [
            'Developed REST APIs with Node.js and reduced latency by 35%.',
            'Automated testing and CI/CD checks, cutting regressions by 40%.',
          ],
        },
      ],
    };
    const partialFixture: ResumeContent = {
      ...structuredClone(emptyResumeContent),
      contacts: { ...emptyResumeContent.contacts, title: 'Frontend Developer' },
      skills: ['Angular', 'TypeScript', 'JavaScript', 'Testing'],
      experiences: [strongFixture.experiences[0]],
    };
    const weakFixture: ResumeContent = {
      ...structuredClone(emptyResumeContent),
      contacts: { ...emptyResumeContent.contacts, title: 'Restaurant Manager' },
      summary: 'Hospitality leader focused on guest service.',
      skills: ['Scheduling', 'Food safety'],
    };
    const analyze = (content: ResumeContent) => run(content, calibrationDescription);
    const strongResult = analyze(strongFixture);
    const partialResult = analyze(partialFixture);
    const weakResult = analyze(weakFixture);
    expect(strongResult.overallScore).toBeGreaterThanOrEqual(70);
    expect(strongResult.categories.find((x) => x.key === 'skills')!.score).toBeGreaterThanOrEqual(
      80
    );
    expect(
      strongResult.categories.find((x) => x.key === 'experience')!.score
    ).toBeGreaterThanOrEqual(65);
    expect(strongResult.missingKeywords.map((x) => x.keyword)).toEqual(['cypress']);
    expect(strongResult.matchedKeywords.every((x) => x.evidence.length > 0)).toBe(true);
    expect(partialResult.overallScore).toBeGreaterThan(weakResult.overallScore);
    expect(partialResult.overallScore).toBeLessThan(strongResult.overallScore);
    expect(weakResult.overallScore).toBeLessThanOrEqual(25);
    expect(strongResult.overallScore - weakResult.overallScore).toBeGreaterThanOrEqual(40);
    expect(weakResult.matchedKeywords).toHaveLength(0);
  });

  it('is monotonic for matched evidence and ignores unrelated skills', () => {
    const baseline = run({ ...strong, skills: strong.skills.filter((x) => x !== 'Angular') });
    const addedMatch = run(strong);
    const unrelated = run({ ...strong, skills: [...strong.skills, 'Basket weaving'] });
    const removedEvidence = run({ ...strong, skills: [], experiences: [], projects: [] });
    expect(addedMatch.overallScore).toBeGreaterThanOrEqual(baseline.overallScore);
    expect(unrelated.overallScore).toBe(addedMatch.overallScore);
    expect(removedEvidence.overallScore).toBeLessThanOrEqual(addedMatch.overallScore);
  });
  it('scores a strongly matching resume above an unrelated resume and clamps scores', () => {
    const related = run();
    const unrelated = run({
      ...structuredClone(emptyResumeContent),
      skills: ['Cooking'],
      summary: 'Restaurant operations.',
    });
    expect(related.overallScore).toBeGreaterThan(unrelated.overallScore);
    for (const result of [related, unrelated]) {
      expect(result.overallScore).toBeGreaterThanOrEqual(0);
      expect(result.overallScore).toBeLessThanOrEqual(100);
    }
  });
  it('awards no experience relevance credit when Experience is missing', () =>
    expect(
      run({ ...strong, experiences: [] }).categories.find((x) => x.key === 'experience')?.score
    ).toBe(0));
  it('weights missing required skills more heavily than preferred skills', () => {
    const focusedDescription =
      'Angular is required. Docker is preferred. The candidate will collaborate with the engineering team and product partners, review software, document decisions, deliver reliable customer outcomes, improve application performance, and communicate clearly across the organization.';
    const requiredMissing = run(
      { ...structuredClone(emptyResumeContent), skills: ['Docker'] },
      focusedDescription
    );
    const preferredMissing = run(
      { ...structuredClone(emptyResumeContent), skills: ['Angular'] },
      focusedDescription
    );
    expect(requiredMissing.categories.find((x) => x.key === 'skills')!.score).toBeLessThan(
      preferredMissing.categories.find((x) => x.key === 'skills')!.score
    );
  });
  it('matches aliases but never Java as a JavaScript substring', () => {
    const result = run(
      { ...structuredClone(emptyResumeContent), skills: ['JS', 'NodeJS', 'Amazon Web Services'] },
      `${description} Java is required.`
    );
    expect(result.matchedKeywords.map((x) => x.keyword)).toEqual(
      expect.arrayContaining(['javascript', 'node.js', 'aws'])
    );
    expect(result.missingKeywords.map((x) => x.keyword)).toContain('java');
  });
  it('returns valid evidence and deterministic missing keywords/signatures', () => {
    const first = run();
    const second = run();
    expect(first).toEqual(second);
    expect(
      first.matchedKeywords.every(
        (x) => x.evidence.length > 0 && x.evidence.every((e) => e.section && e.excerpt)
      )
    ).toBe(true);
  });
  it('handles unusual Unicode and long tokens safely', () =>
    expect(() => run(strong, `${description} café résumé 東京 ${'x'.repeat(500)}.`)).not.toThrow());
  it('changes its stale-detection signature when saved content or version changes', () => {
    expect(run().inputSignature).not.toBe(
      analyzeJobMatch({
        content: strong,
        versionId: 'v2',
        templateId: 't-classic-ats-navy',
        jobTitle: 'Senior Angular Developer',
        company: 'Northstar',
        jobDescription: description,
      }).inputSignature
    );
    expect(run().inputSignature).not.toBe(
      run({ ...strong, summary: strong.summary + ' Docker.' }).inputSignature
    );
  });
});
