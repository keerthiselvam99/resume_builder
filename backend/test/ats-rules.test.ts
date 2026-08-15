import { describe, expect, it } from 'vitest';
import { emptyResumeContent, ResumeContent } from '../src/types/domain';
import {
  ATS_CATEGORIES,
  ATS_RULESET_VERSION,
  AtsAnalysisCore,
  analyzeResume,
} from '../src/services/ats/ats-analysis';
import { TemplateAtsProfile } from '../src/services/template/template-catalogue';

const atsProfile: TemplateAtsProfile = {
  id: 't-classic-ats-navy',
  isAtsFriendly: true,
  isVisual: false,
  columnCount: 1,
};

function analyze(content: ResumeContent, profile: TemplateAtsProfile | undefined = atsProfile) {
  return analyzeResume(content, profile);
}

function contentWith(
  overrides: Omit<Partial<ResumeContent>, 'contacts'> & {
    contacts?: Partial<ResumeContent['contacts']>;
  } = {}
): ResumeContent {
  return {
    ...emptyResumeContent,
    ...overrides,
    contacts: { ...emptyResumeContent.contacts, ...(overrides.contacts ?? {}) },
  } as ResumeContent;
}

function codes(result: AtsAnalysisCore): string[] {
  return result.findings.map((f) => f.code);
}

function experience(
  overrides: Partial<{
    id: string;
    company: string;
    role: string;
    startDate: string;
    endDate: string;
    current: boolean;
    bullets: string[];
  }>
) {
  return {
    id: 'e-1',
    company: 'Acme',
    role: 'Engineer',
    location: '',
    startDate: '2020-01',
    endDate: '',
    current: true,
    bullets: ['Cut build time 40%.'],
    ...overrides,
  };
}

describe('ATS rules engine — determinism and bounds', () => {
  it('exposes the versioned ruleset', () => {
    expect(analyze(emptyResumeContent).rulesetVersion).toBe(ATS_RULESET_VERSION);
  });

  it('keeps categories in fixed registration order with total weight 100', () => {
    const result = analyze(emptyResumeContent);
    expect(result.categories.map((c) => c.key)).toEqual(ATS_CATEGORIES.map((c) => c.key));
    expect(ATS_CATEGORIES.reduce((sum, c) => sum + c.weight, 0)).toBe(100);
  });

  it('produces identical output for identical input', () => {
    const content = contentWith({ summary: 'A short summary.' });
    expect(analyze(content)).toEqual(analyze(content));
  });

  it('clamps overall to 0..100 and rounds once to an integer', () => {
    const result = analyze(emptyResumeContent, undefined);
    expect(Number.isInteger(result.overallScore)).toBe(true);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  it('keeps category earnedPoints and scores in range', () => {
    for (const category of analyze(emptyResumeContent, undefined).categories) {
      expect(category.earnedPoints).toBeGreaterThanOrEqual(0);
      expect(category.earnedPoints).toBeLessThanOrEqual(category.maxPoints);
      expect(category.score).toBeGreaterThanOrEqual(0);
      expect(category.score).toBeLessThanOrEqual(100);
    }
  });

  it('emits complete bounded findings with unique codes (no double penalty)', () => {
    const result = analyze(emptyResumeContent, undefined);
    expect(new Set(codes(result)).size).toBe(result.findings.length);
    for (const f of result.findings) {
      expect(f.code).toMatch(/^[a-z0-9.]+$/);
      expect(['error', 'warning', 'info']).toContain(f.severity);
      expect(f.section.length).toBeGreaterThan(0);
      expect(f.message.length).toBeGreaterThan(0);
      expect(f.suggestion.length).toBeGreaterThan(0);
      expect(f.pointsLost).toBeGreaterThanOrEqual(1);
      if (f.evidence && typeof f.evidence.value === 'string') {
        expect(f.evidence.value.length).toBeLessThanOrEqual(165);
      }
    }
  });

  it('stays bounded on a schema-max-scale resume', () => {
    const content = contentWith({
      summary: 'A summary with enough text to satisfy the length rules.',
      skills: Array.from({ length: 40 }, (_, i) => `Skill ${i}`),
      experiences: Array.from({ length: 60 }, () =>
        experience({
          company: '',
          role: '',
          startDate: '',
          endDate: '',
          current: false,
          bullets: [],
        })
      ),
    });
    const result = analyze(content);
    expect(result.findings.length).toBeLessThan(30);
    expect(new Set(codes(result)).size).toBe(result.findings.length);
  });
});

describe('ATS rules engine — contact', () => {
  it('flags missing name/email as errors and phone as a warning', () => {
    const result = analyze(contentWith({}));
    const byCode = new Map(result.findings.map((f) => [f.code, f]));
    expect(byCode.get('contact.name.missing')?.severity).toBe('error');
    expect(byCode.get('contact.email.missing')?.severity).toBe('error');
    expect(byCode.get('contact.phone.missing')?.severity).toBe('warning');
  });

  it('flags an invalid email and stays clean for a valid one', () => {
    const invalid = analyze(contentWith({ contacts: { email: 'not-an-email' } }));
    expect(codes(invalid)).toContain('contact.email.invalid');
    const valid = analyze(contentWith({ contacts: { email: 'a@b.com' } }));
    expect(codes(valid)).not.toContain('contact.email.invalid');
    expect(codes(valid)).not.toContain('contact.email.missing');
  });
});

describe('ATS rules engine — summary', () => {
  it('reports an empty summary as an error', () => {
    expect(codes(analyze(contentWith({ summary: '' })))).toContain('summary.missing');
  });

  it('reports a very short summary as a warning', () => {
    const result = analyze(contentWith({ summary: 'Too short.' }));
    expect(codes(result)).toContain('summary.tooShort');
    expect(codes(result)).not.toContain('summary.missing');
  });

  it('accepts a focused measurable summary without weak flag', () => {
    const summary = 'Engineer with 5 years of experience building Angular apps. Led a team of 6.';
    expect(codes(analyze(contentWith({ summary })))).not.toContain('summary.weak');
  });
});

describe('ATS rules engine — experience', () => {
  it('reports no experience as an error losing the whole category', () => {
    const result = analyze(contentWith({ experiences: [] }));
    const byCode = new Map(result.findings.map((f) => [f.code, f]));
    expect(byCode.get('experience.none')?.pointsLost).toBe(20);
    expect(result.categories.find((c) => c.key === 'experience')?.earnedPoints).toBe(0);
  });

  it('aggregates missing company/role/dates findings', () => {
    const result = analyze(
      contentWith({
        experiences: [
          experience({ company: '', startDate: '', endDate: '', current: false }),
          experience({ id: 'e-2', role: '' }),
        ],
      })
    );
    expect(codes(result)).toContain('experience.company.missing');
    expect(codes(result)).toContain('experience.role.missing');
    const dates = result.findings.find((f) => f.code === 'experience.dates.missing');
    expect(dates?.evidence).toEqual({ kind: 'count', value: 1 });
  });

  it('warns when bullets lack measurable impact', () => {
    const result = analyze(
      contentWith({
        experiences: [experience({ bullets: ['Worked on a portal.', 'Helped the team.'] })],
      })
    );
    expect(codes(result)).toContain('experience.bullets.measurable');
  });
});
