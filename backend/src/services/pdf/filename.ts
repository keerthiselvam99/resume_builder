/**
 * Sanitizes a user-supplied resume name into a safe, portable PDF base name.
 *
 * Rules:
 *  - Lowercases everything.
 *  - Collapses runs of non-alphanumeric characters into a single dash.
 *  - Strips leading/trailing dashes and any control characters.
 *  - Caps the length so the final filename stays well under filesystem limits.
 *  - Never returns an empty string (falls back to "resume").
 *
 * The frontend sends a full "*.pdf" name; the backend sanitizes again as
 * defense-in-depth and appends ".pdf" (stripping a redundant extension first).
 */
export function sanitizePdfBaseName(raw: string, maxLength = 64): string {
  const withoutControlChars = Array.from(String(raw ?? '').normalize('NFKC'))
    .filter((char) => {
      const code = char.codePointAt(0) ?? 0;
      return code >= 32 && code !== 127;
    })
    .join('');

  const cleaned = withoutControlChars
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const truncated = cleaned.slice(0, maxLength).replace(/-+$/g, '');
  return truncated || 'resume';
}

export function buildPdfFilename(raw: string, maxLength = 64): string {
  // Tolerate a caller that already sent a full "*.pdf" name (the frontend does):
  // strip the extension so it is not appended twice.
  const withoutExtension = String(raw ?? '').replace(/\.pdf$/i, '');
  return `${sanitizePdfBaseName(withoutExtension, maxLength)}.pdf`;
}
