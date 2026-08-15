export type FindingSeverity = "error" | "warning" | "info";

export interface AtsFindingEvidence {
  kind: "count" | "missing" | "pattern";
  value: number | string;
}

export interface AtsFinding {
  code: string;
  severity: FindingSeverity;
  category: AtsCategoryKey;
  section: string;
  fieldPath?: string;
  message: string;
  evidence?: AtsFindingEvidence;
  suggestion: string;
  pointsLost: number;
}

export interface AtsCategoryScore {
  key: AtsCategoryKey;
  label: string;
  weight: number;
  earnedPoints: number;
  maxPoints: number;
  score: number;
}

export interface AtsAnalysisCore {
  rulesetVersion: string;
  overallScore: number;
  categories: AtsCategoryScore[];
  findings: AtsFinding[];
  summary: { errors: number; warnings: number; info: number };
}

export interface CategoryResult {
  findings: AtsFinding[];
  penalty: number;
}

/** The version of the scoring rules; bump whenever scoring semantics change. */
export const ATS_RULESET_VERSION = "ats-rules-v1";

export const ATS_CATEGORIES = [
  { key: "contact", label: "Contact information", weight: 15 },
  { key: "summary", label: "Professional summary", weight: 10 },
  { key: "experience", label: "Work experience", weight: 20 },
  { key: "skills", label: "Skills", weight: 10 },
  { key: "education", label: "Education", weight: 5 },
  { key: "structure", label: "Structure & sections", weight: 10 },
  { key: "links", label: "Links", weight: 5 },
  { key: "template", label: "Template", weight: 10 },
  { key: "contentQuality", label: "Content quality", weight: 15 },
] as const;

export type AtsCategoryKey = (typeof ATS_CATEGORIES)[number]["key"];

export interface FindingInput {
  fieldPath?: string;
  evidence?: AtsFindingEvidence;
}

export function finding(
  category: AtsCategoryKey,
  section: string,
  code: string,
  severity: FindingSeverity,
  message: string,
  suggestion: string,
  pointsLost: number,
  input: FindingInput = {},
): AtsFinding {
  return {
    code,
    severity,
    category,
    section,
    fieldPath: input.fieldPath,
    message,
    evidence: input.evidence,
    suggestion,
    pointsLost,
  };
}

export function countOf(value: number): AtsFindingEvidence {
  return { kind: "count", value };
}

export function missingOf(items: string[], limit = 4): AtsFindingEvidence {
  const shown = items.slice(0, limit);
  const suffix = items.length > limit ? "…" : "";
  return { kind: "missing", value: shown.join(", ") + suffix };
}

export function patternOf(value: string, max = 160): AtsFindingEvidence {
  const truncated =
    value.length <= max ? value : `${value.slice(0, max).trimEnd()}…`;
  return { kind: "pattern", value: truncated };
}

export function sumPenalty(findings: AtsFinding[]): number {
  return findings.reduce((total, f) => total + f.pointsLost, 0);
}
