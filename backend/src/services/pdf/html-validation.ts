import { PdfValidationError } from './errors';
import { UNSAFE_URL_SCHEME_RE, hasUnsafeUrlScheme } from '../../../../shared/ats/url-scheme';

/** Maximum accepted HTML payload size (bytes). */
export const MAX_PDF_HTML_BYTES = 2 * 1024 * 1024;

const ATTR_RE = /\b(href|src|xlink:href|action|formaction)\s*=\s*("[^"]*"|'[^']*')/gi;

const EVENT_HANDLER_RE = /\son[a-z]+\s*=\s*("[^"]*"|'[^']*')/gi;

/**
 * True when the value starts with a scheme that must never be rendered or
 * stored as a resume link. Single source of truth shared by the HTML payload
 * check and the ATS link rules.
 */
export { hasUnsafeUrlScheme };

/**
 * Scans rendered resume HTML for link/script vectors that must never reach the
 * PDF renderer. The frontend renderer already strips these; this is the
 * backend's independent check (defense in depth).
 *
 * Returns the list of offending schemes, empty when the HTML is safe.
 */
export function findUnsafeUrlSchemes(html: string): string[] {
  const offenders = new Set<string>();

  let match: RegExpExecArray | null;
  ATTR_RE.lastIndex = 0;
  while ((match = ATTR_RE.exec(html)) !== null) {
    const value = match[2].slice(1, -1).trim();
    const scheme = value.match(UNSAFE_URL_SCHEME_RE)?.[1]?.toLowerCase();
    if (scheme) {
      offenders.add(`${scheme}:`);
    }
  }

  if (EVENT_HANDLER_RE.test(html)) {
    offenders.add('inline-event-handler');
  }

  return [...offenders];
}

/**
 * Validates the rendered HTML before it is handed to headless Chromium.
 * Throws PdfValidationError when the payload is unacceptable.
 */
export function assertSafePdfHtml(html: unknown, maxBytes = MAX_PDF_HTML_BYTES): string {
  if (typeof html !== 'string' || html.trim().length === 0) {
    throw new PdfValidationError('HTML payload is missing or empty.');
  }

  const bytes = Buffer.byteLength(html, 'utf8');
  if (bytes > maxBytes) {
    throw new PdfValidationError(`HTML payload is too large (${bytes} bytes).`);
  }

  const schemes = findUnsafeUrlSchemes(html);
  if (schemes.length > 0) {
    throw new PdfValidationError(
      `Refusing to render HTML with unsafe link schemes: ${schemes.join(', ')}`
    );
  }

  return html;
}
