/**
 * Builds a safe, human-readable PDF download name such as
 * `arun-kumar-master-resume.pdf` from the signed-in user's name and the
 * resume version name. The backend sanitizes again before serving.
 */
export function slugifySegment(value: string): string {
  if (!value) {
    return '';
  }
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

export function buildPdfFilename(userName: string | undefined, versionName: string): string {
  const userPart = slugifySegment(userName ?? '');
  const versionPart = slugifySegment(versionName ?? '');
  const parts = [userPart, versionPart].filter(Boolean);
  const base = parts.length > 0 ? parts.join('-') : 'resume';
  return `${base}.pdf`;
}
