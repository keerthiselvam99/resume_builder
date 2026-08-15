import { describe, it, expect } from 'vitest';
import { slugifySegment, buildPdfFilename } from './pdf-filename';

describe('slugifySegment', () => {
  it('lowercases and dashes spaces', () => {
    expect(slugifySegment('Arun Kumar')).toBe('arun-kumar');
  });

  it('strips punctuation and symbols', () => {
    // O\u2019 is a typographic apostrophe; it is treated as a separator.
    expect(slugifySegment('Sara "Sally" O\u2019Brien, Jr.')).toBe('sara-sally-o-brien-jr');
  });

  it('collapses runs of separators', () => {
    expect(slugifySegment('Master   Resume -- final')).toBe('master-resume-final');
  });

  it('handles non-Latin input without crashing', () => {
    // r\u00e9sum\u00e9 normalizes to "resume"; the en-dash and Arabic
    // characters are stripped/separators.
    expect(slugifySegment('r\u00e9sum\u00e9 \u2013 \u0623\u062d\u0645\u062f')).toBe('resume');
  });

  it('returns an empty string for empty input', () => {
    expect(slugifySegment('')).toBe('');
    expect(slugifySegment(undefined as unknown as string)).toBe('');
  });
});

describe('buildPdfFilename', () => {
  it('combines user and version parts', () => {
    expect(buildPdfFilename('Arun Kumar', 'Master Resume')).toBe('arun-kumar-master-resume.pdf');
  });

  it('falls back to the version when the user has no name', () => {
    expect(buildPdfFilename(undefined, 'Master Resume')).toBe('master-resume.pdf');
  });

  it('falls back to resume when both parts are empty', () => {
    expect(buildPdfFilename(undefined, '')).toBe('resume.pdf');
  });
});
