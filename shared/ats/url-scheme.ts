/** Schemes that must never be rendered or stored as a resume link. */
export const UNSAFE_URL_SCHEME_RE = /^\s*(javascript|vbscript|data):/i;

/**
 * True when the value starts with a scheme that must never be rendered or
 * stored as a resume link. Single source of truth shared by the backend HTML
 * payload check and the ATS link rules (and the browser-safe rules engine).
 */
export function hasUnsafeUrlScheme(value: string): boolean {
  return UNSAFE_URL_SCHEME_RE.test(value);
}
