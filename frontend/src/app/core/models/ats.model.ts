/**
 * ATS analysis contract shared between the editor UI and the backend engine.
 * Shapes mirror the backend AtsAnalysisCore response exactly so the repository
 * layer is a thin pass-through (no scoring happens in the browser).
 */

export type AtsCategoryKey =
  | 'contact'
  | 'summary'
  | 'experience'
  | 'skills'
  | 'education'
  | 'structure'
  | 'links'
  | 'template'
  | 'contentQuality';

export type FindingSeverity = 'error' | 'warning' | 'info';

export interface AtsFindingEvidence {
  kind: 'count' | 'missing' | 'pattern';
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

export interface AtsAnalysisSummary {
  errors: number;
  warnings: number;
  info: number;
}

export interface AtsAnalysis {
  rulesetVersion: string;
  versionId: string;
  overallScore: number;
  categories: AtsCategoryScore[];
  findings: AtsFinding[];
  summary: AtsAnalysisSummary;
}
