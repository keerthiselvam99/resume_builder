import { it, describe, expect } from 'vitest';
import { findUnsafeUrlSchemes, assertSafePdfHtml } from '../src/services/pdf/html-validation';
import { PdfValidationError } from '../src/services/pdf/errors';

describe('findUnsafeUrlSchemes', () => {
  it('returns empty for safe links', () => {
    const html = '<a href="https://example.com/x">x</a><a href="mailto:a@b.c">m</a>';
    expect(findUnsafeUrlSchemes(html)).toEqual([]);
  });

  it('detects javascript: links in href attributes', () => {
    const html = '<a href="javascript:alert(1)">x</a>';
    expect(findUnsafeUrlSchemes(html)).toContain('javascript:');
  });

  it('detects data: links in src attributes', () => {
    const html = '<img src="data:image/svg+xml;base64,AAAA">';
    expect(findUnsafeUrlSchemes(html)).toContain('data:');
  });

  it('detects vbscript: and case variations', () => {
    const html = '<a href="VBScript:msgbox(1)">x</a>';
    expect(findUnsafeUrlSchemes(html)).toContain('vbscript:');
  });

  it('detects inline event handlers', () => {
    const html = '<div onclick="alert(1)">x</div>';
    expect(findUnsafeUrlSchemes(html)).toContain('inline-event-handler');
  });

  it('ignores unsafe-looking schemes that are actually safe (https data in text)', () => {
    const html = '<p>learn javascript: basics</p>';
    expect(findUnsafeUrlSchemes(html)).toEqual([]);
  });
});

describe('assertSafePdfHtml', () => {
  it('accepts a valid document', () => {
    const html = buildValidHtml();
    expect(assertSafePdfHtml(html)).toBe(html);
  });

  it('rejects non-string and empty payloads', () => {
    expect(() => assertSafePdfHtml('')).toThrow(PdfValidationError);
    expect(() => assertSafePdfHtml(undefined)).toThrow(PdfValidationError);
    expect(() => assertSafePdfHtml(123)).toThrow(PdfValidationError);
  });

  it('rejects oversized payloads', () => {
    const big = '<div>' + 'x'.repeat(2048) + '</div>';
    expect(() => assertSafePdfHtml(big, 1024)).toThrow(/too large/i);
  });

  it('rejects unsafe schemes', () => {
    const html = buildValidHtml().replace('</body>', '<a href="javascript:void(0)">x</a></body>');
    expect(() => assertSafePdfHtml(html)).toThrow(/unsafe link schemes/i);
  });
});

function buildValidHtml(): string {
  return '<!DOCTYPE html><html><body><h1>Hello</h1><a href="https://example.com">link</a></body></html>';
}
