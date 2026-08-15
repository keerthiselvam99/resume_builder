import { describe, it, expect, beforeEach } from 'vitest';
import { lastValueFrom } from 'rxjs';
import { MockAuthRepository } from './mock-auth.repository';
import { MockResumeRepository } from './mock-resume.repository';
import { MockTemplateRepository } from './mock-template.repository';
import { MockAnalysisRepository } from './mock-analysis.repository';
import {
  MockPdfExportRepository,
  DEMO_PDF_UNAVAILABLE_MESSAGE,
} from './mock-pdf-export.repository';
import { MockStore } from './mock-store';
import { MockUserRecord, emptyContent } from './fixtures';

describe('MockAuthRepository', () => {
  let repo: MockAuthRepository;

  beforeEach(() => {
    localStorage.clear();
    repo = new MockAuthRepository();
  });

  it('logs in the seeded demo user', async () => {
    const session = await lastValueFrom(
      repo.login({ email: 'arun@example.com', password: 'Password123!' }),
    );
    expect(session.user.email).toBe('arun@example.com');
    expect(MockStore.read('session', null)).not.toBeNull();
  });

  it('rejects invalid credentials', async () => {
    await expect(
      lastValueFrom(repo.login({ email: 'arun@example.com', password: 'wrong' })),
    ).rejects.toThrow('Invalid email or password.');
  });

  it('registers a new user and persists the record', async () => {
    const session = await lastValueFrom(
      repo.register({ name: 'Jane', email: 'jane@example.com', password: 'Secret123!' }),
    );
    expect(session.user.email).toBe('jane@example.com');
    const users = MockStore.read<MockUserRecord[]>('users', []);
    expect(users.some((u) => u.email === 'jane@example.com')).toBe(true);
  });

  it('rejects duplicate registration', async () => {
    await expect(
      lastValueFrom(
        repo.register({ name: 'Arun', email: 'arun@example.com', password: 'Secret123!' }),
      ),
    ).rejects.toThrow('already exists');
  });

  it('removes the session on logout', async () => {
    await lastValueFrom(repo.login({ email: 'arun@example.com', password: 'Password123!' }));
    await lastValueFrom(repo.logout());
    expect(MockStore.read('session', null)).toBeNull();
  });
});

describe('MockResumeRepository', () => {
  let repo: MockResumeRepository;

  beforeEach(() => {
    localStorage.clear();
    repo = new MockResumeRepository();
  });

  it('lists the seeded master resume', async () => {
    const resumes = await lastValueFrom(repo.list());
    expect(resumes.length).toBe(1);
    expect(resumes[0].name).toBe('Master Resume');
    expect(resumes[0].status).toBe('saved');
  });

  it('creates a resume with a master version as a draft', async () => {
    const resume = await lastValueFrom(
      repo.create({ name: 'Portfolio', templateId: 't-premium-sidebar-navy' }),
    );
    expect(resume.status).toBe('draft');
    const versions = await lastValueFrom(repo.listVersions(resume.id));
    expect(versions.length).toBe(1);
    expect(versions[0].isMaster).toBe(true);
  });

  it('marks a draft resume as saved', async () => {
    const created = await lastValueFrom(
      repo.create({ name: 'Portfolio', templateId: 't-premium-sidebar-navy' }),
    );
    expect(created.status).toBe('draft');

    const saved = await lastValueFrom(repo.markSaved(created.id));
    expect(saved.status).toBe('saved');

    const listed = await lastValueFrom(repo.list());
    expect(listed.find((r) => r.id === created.id)?.status).toBe('saved');
  });

  it('duplicates a resume as a draft copy', async () => {
    const copy = await lastValueFrom(repo.duplicate('r-master'));
    expect(copy.id).not.toBe('r-master');
    expect(copy.name).toContain('(copy)');
    expect(copy.status).toBe('draft');
  });

  it('rejects marking a missing resume as saved', async () => {
    await expect(lastValueFrom(repo.markSaved('r-missing'))).rejects.toThrow('Resume not found.');
  });

  it('clones a version and keeps them independent', async () => {
    const clone = await lastValueFrom(repo.cloneVersion('v-master', 'TCS — Angular Developer'));
    expect(clone.id).not.toBe('v-master');
    expect(clone.name).toBe('TCS — Angular Developer');

    await lastValueFrom(
      repo.updateContent('v-master', {
        ...clone.content,
        summary: 'Updated master summary',
      }),
    );

    const original = await lastValueFrom(repo.getVersion('v-master'));
    const cloned = await lastValueFrom(repo.getVersion(clone.id));
    expect(original?.content.summary).toBe('Updated master summary');
    expect(cloned?.content.summary).not.toBe('Updated master summary');
  });

  it('publishes a version', async () => {
    const published = await lastValueFrom(repo.publishVersion('v-master'));
    expect(published.published).toBe(true);
  });

  it('updates a version template and persists it', async () => {
    const updated = await lastValueFrom(repo.updateTemplate('v-master', 't-executive-banner-navy'));
    expect(updated.templateId).toBe('t-executive-banner-navy');

    const reloaded = await lastValueFrom(repo.getVersion('v-master'));
    expect(reloaded?.templateId).toBe('t-executive-banner-navy');
  });

  it('updating a template preserves the version content', async () => {
    const before = await lastValueFrom(repo.getVersion('v-master'));
    await lastValueFrom(repo.updateTemplate('v-master', 't-modern-split-burgundy'));
    const after = await lastValueFrom(repo.getVersion('v-master'));
    expect(after?.content).toEqual(before?.content);
    expect(after?.templateId).toBe('t-modern-split-burgundy');
  });

  it('rejects updating a missing version', async () => {
    await expect(
      lastValueFrom(repo.updateTemplate('v-missing', 't-executive-banner-navy')),
    ).rejects.toThrow('Version not found.');
  });

  it('rejects updating with an unknown template', async () => {
    await expect(
      lastValueFrom(repo.updateTemplate('v-master', 't-does-not-exist')),
    ).rejects.toThrow('Template not found.');
  });
});

describe('MockTemplateRepository', () => {
  it('returns the three seeded templates', async () => {
    const repo = new MockTemplateRepository();
    const templates = await lastValueFrom(repo.list());
    expect(templates.length).toBe(3);
  });
});

describe('MockAnalysisRepository', () => {
  let repo: MockAnalysisRepository;

  beforeEach(() => {
    localStorage.clear();
    repo = new MockAnalysisRepository();
  });

  it('runs the shared ATS engine on the seeded version content', async () => {
    const analysis = await lastValueFrom(repo.runAtsAnalysis('v-master'));
    expect(analysis.versionId).toBe('v-master');
    expect(analysis.rulesetVersion).toBe('ats-rules-v1');
    expect(analysis.overallScore).toBe(94);
    expect(analysis.categories).toHaveLength(9);
    expect(analysis.findings.some((f) => f.code === 'experience.bullets.measurable')).toBe(true);
  });

  it('runs the shared ATS engine on a blank resume', async () => {
    const resumeRepo = new MockResumeRepository();
    const resume = await lastValueFrom(
      resumeRepo.create({ name: 'Fresh', templateId: 't-classic-ats-navy' }),
    );
    const versions = await lastValueFrom(resumeRepo.listVersions(resume.id));
    const blankVersionId = versions[0].id;

    const analysis = await lastValueFrom(repo.runAtsAnalysis(blankVersionId));
    expect(analysis.overallScore).toBe(42);
    expect(analysis.findings.some((f) => f.code === 'experience.none')).toBe(true);
    expect(analysis.findings.length).toBeGreaterThan(0);
  });

  it('reflects changes to the saved content', async () => {
    const first = await lastValueFrom(repo.runAtsAnalysis('v-master'));
    await lastValueFrom(
      new MockResumeRepository().updateContent('v-master', {
        ...emptyContent,
        summary: 'Completely rewritten after the first run.',
      }),
    );
    const second = await lastValueFrom(repo.runAtsAnalysis('v-master'));
    expect(second.overallScore).toBe(47);
    expect(second.overallScore).not.toBe(first.overallScore);
    expect(second.findings).not.toEqual(first.findings);
  });

  it('rejects an unknown version', async () => {
    await expect(lastValueFrom(repo.runAtsAnalysis('v-missing'))).rejects.toThrow(
      'Version not found.',
    );
  });
});

describe('MockPdfExportRepository', () => {
  it('rejects exports with a pointer to the full application', async () => {
    const repo = new MockPdfExportRepository();
    await expect(
      repo.exportPdf('v-master', {
        templateDefinitionId: 't-classic-ats-navy',
        content: emptyContent,
        filename: 'resume',
      }),
    ).rejects.toThrow(DEMO_PDF_UNAVAILABLE_MESSAGE);
  });
});
