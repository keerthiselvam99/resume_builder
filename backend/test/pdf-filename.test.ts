import { it, describe, expect } from 'vitest';
import { sanitizePdfBaseName, buildPdfFilename } from '../src/services/pdf/filename';

describe('sanitizePdfBaseName', () => {
  it('builds the canonical arun-kumar-master-resume style name', () => {
    expect(buildPdfFilename('Arun Kumar Master Resume')).toBe('arun-kumar-master-resume.pdf');
  });

  it('collapses punctuation and multiple separators into single dashes', () => {
    expect(sanitizePdfBaseName('  Zoho__-_-Angular  Dev ')).toBe('zoho-angular-dev');
  });

  it('rejects path traversal characters', () => {
    expect(sanitizePdfBaseName('../../etc/passwd')).toBe('etc-passwd');
  });

  it('removes control characters and treats unusual unicode as a separator', () => {
    expect(sanitizePdfBaseName('Resume\u0000\u007f\uD83D\uDE00Name')).toBe('resume-name');
  });

  it('caps the length and trims trailing dashes', () => {
    expect(sanitizePdfBaseName('a'.repeat(200), 20).length).toBeLessThanOrEqual(20);
    expect(sanitizePdfBaseName('a-', 5)).toBe('a');
  });

  it('falls back to resume when nothing usable remains', () => {
    expect(sanitizePdfBaseName('!!!')).toBe('resume');
    expect(sanitizePdfBaseName('')).toBe('resume');
  });

  it('buildPdfFilename always appends .pdf', () => {
    expect(buildPdfFilename('Master')).toBe('master.pdf');
  });

  it('buildPdfFilename does not double the extension when the caller already sent *.pdf', () => {
    expect(buildPdfFilename('arun-kumar-master-resume.pdf')).toBe('arun-kumar-master-resume.pdf');
  });
});
