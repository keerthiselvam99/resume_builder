import { it, describe, expect } from 'vitest';
import {
  assertValidResumeContent,
  isResumeContentEmpty,
  ResumeContentPayload,
} from '../src/services/pdf/content-validation';
import { PdfValidationError } from '../src/services/pdf/errors';
import { sampleContent } from '../../frontend/scripts/shared/sample-content';

/** Structurally valid resume with no user-supplied content at all. */
function blankContent(): ResumeContentPayload {
  return {
    contacts: {
      fullName: '',
      title: '',
      email: '',
      phone: '',
      location: '',
      linkedinUrl: '',
      githubUrl: '',
      portfolioUrl: '',
    },
    summary: '',
    skills: [],
    experiences: [],
    projects: [],
    education: [],
    certifications: [],
    awards: [],
    achievements: [],
    languages: [],
    customSections: [],
  };
}

describe('assertValidResumeContent', () => {
  it('accepts valid structured content', () => {
    const out = assertValidResumeContent(sampleContent);
    expect(out.contacts.fullName).toBe('Jane Doe');
    expect(out.skills.length).toBeGreaterThan(0);
  });

  it('rejects legacy HTML payloads (unknown top-level keys)', () => {
    expect(() => assertValidResumeContent({ html: '<b>x</b>', content: sampleContent })).toThrow(
      PdfValidationError
    );
  });

  it('rejects a missing contacts object', () => {
    expect(() => assertValidResumeContent({})).toThrow(PdfValidationError);
  });

  it('rejects oversized strings', () => {
    const content = structuredClone(sampleContent);
    content.summary = 'x'.repeat(10_000);
    expect(() => assertValidResumeContent(content)).toThrow(/at most 8000 character/i);
  });

  it('rejects oversized arrays', () => {
    const content = structuredClone(sampleContent);
    content.skills = Array.from({ length: 200 }, (_, i) => `s${i}`);
    expect(() => assertValidResumeContent(content)).toThrow(/at most 100 element/i);
  });

  it('enforces the byte-size limit', () => {
    const content = structuredClone(sampleContent);
    content.summary = 'a'.repeat(700_000);
    expect(() => assertValidResumeContent(content)).toThrow(/too large/i);
  });

  it('rejects unknown nested keys', () => {
    const content = structuredClone(sampleContent) as unknown as Record<string, unknown>;
    content.experiences = [
      {
        ...(sampleContent.experiences[0] as object),
        bogusField: 'dropped',
      },
    ];
    expect(() => assertValidResumeContent(content)).toThrow(/Unrecognized key/i);
  });
});

describe('isResumeContentEmpty', () => {
  it('returns true for a blank resume', () => {
    expect(isResumeContentEmpty(blankContent())).toBe(true);
  });

  it('returns false for the rich sample content', () => {
    expect(isResumeContentEmpty(sampleContent)).toBe(false);
  });

  it('returns false when only a summary is present', () => {
    const content = blankContent();
    content.summary = 'Full-stack developer.';
    expect(isResumeContentEmpty(content)).toBe(false);
  });

  it('returns false when a single contact field is filled', () => {
    const content = blankContent();
    content.contacts.fullName = 'Jane Doe';
    expect(isResumeContentEmpty(content)).toBe(false);
  });

  it('returns false when a partially filled entry exists', () => {
    const content = blankContent();
    content.experiences = [
      {
        id: 'e-skeleton',
        company: 'Acme',
        role: '',
        location: '',
        startDate: '',
        endDate: '',
        current: false,
        bullets: [],
      },
    ];
    expect(isResumeContentEmpty(content)).toBe(false);
  });

  it('ignores generated ids and toggle booleans, so an id-only entry stays empty', () => {
    const content = blankContent();
    content.experiences = [
      {
        id: 'e-skeleton',
        company: '',
        role: '',
        location: '',
        startDate: '',
        endDate: '',
        current: false,
        bullets: [],
      },
    ];
    expect(isResumeContentEmpty(content)).toBe(true);
  });
});
