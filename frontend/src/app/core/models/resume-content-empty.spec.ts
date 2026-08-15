import { describe, it, expect } from 'vitest';
import { ResumeContent } from './resume.model';
import { isContentEmpty } from './resume-content-empty';
import { emptyContent } from '../repositories/mock/fixtures';
import { sampleContent } from '../../../../scripts/shared/sample-content';

describe('isContentEmpty', () => {
  it('returns true for the blank template content', () => {
    expect(isContentEmpty(emptyContent)).toBe(true);
  });

  it('returns false for the rich sample content', () => {
    expect(isContentEmpty(sampleContent)).toBe(false);
  });

  it('returns false when a contact field is filled', () => {
    const content = structuredClone(emptyContent);
    content.contacts.fullName = 'Jane Doe';
    expect(isContentEmpty(content)).toBe(false);
  });

  it('returns false when only a summary is present', () => {
    const content = structuredClone(emptyContent);
    content.summary = 'Full-stack developer.';
    expect(isContentEmpty(content)).toBe(false);
  });

  it('returns false when a single skill is present', () => {
    const content = structuredClone(emptyContent);
    content.skills = ['Angular'];
    expect(isContentEmpty(content)).toBe(false);
  });

  it('ignores generated ids and toggle booleans in entries', () => {
    const content = structuredClone(emptyContent);
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
    expect(isContentEmpty(content)).toBe(true);

    content.experiences[0].bullets = ['Led a team of 5.'];
    expect(isContentEmpty(content)).toBe(false);
  });

  it('treats an omitted optional contact title as empty, not as content', () => {
    const content = structuredClone(emptyContent);
    delete (content.contacts as Partial<ResumeContent['contacts']>).title;
    expect(isContentEmpty(content)).toBe(true);
  });
});
