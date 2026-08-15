import {
  ATS_TEMPLATE_PROFILES,
  DEFAULT_ATS_TEMPLATE_ID,
  TemplateAtsProfile,
} from '../../../../shared/ats-template-catalogue';
import { DEFAULT_TEMPLATE_ID } from '../../types/domain';

let cached: Set<string> | null = null;
let cachedProfiles: Map<string, TemplateAtsProfile> | null = null;

/** ATS-relevant template metadata backed by the shared canonical catalogue. */
export type { TemplateAtsProfile };

export function isValidTemplateId(id: string | undefined): boolean {
  if (typeof id !== 'string') {
    return false;
  }
  if (!cached) {
    cached = new Set(ATS_TEMPLATE_PROFILES.map((d) => d.id));
  }
  return cached.has(id);
}

export function resolveTemplateId(id: string | undefined): string {
  return isValidTemplateId(id) ? (id as string) : DEFAULT_TEMPLATE_ID;
}

/**
 * Returns the canonical ATS metadata for a template definition, or undefined
 * when the id does not resolve to a known template. Callers must never infer
 * ATS quality from template names or category labels.
 */
export function getTemplateAtsProfile(id: string | undefined): TemplateAtsProfile | undefined {
  if (typeof id !== 'string') {
    return undefined;
  }
  if (!cachedProfiles) {
    cachedProfiles = new Map(ATS_TEMPLATE_PROFILES.map((d) => [d.id, d]));
  }
  const profile = cachedProfiles.get(id);
  return profile ? { ...profile } : undefined;
}

export { DEFAULT_ATS_TEMPLATE_ID };
