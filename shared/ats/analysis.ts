import type { ResumeContent } from "./resume-content";
import type { TemplateAtsProfile } from "../ats-template-catalogue";
import {
  AtsAnalysisCore,
  AtsCategoryKey,
  ATS_CATEGORIES,
  ATS_RULESET_VERSION,
  CategoryResult,
} from "./model";
import {
  analyzeContact,
  analyzeEducation,
  analyzeExperience,
  analyzeSkills,
  analyzeSummary,
} from "./rules-content";
import {
  analyzeContentQuality,
  analyzeLinks,
  analyzeStructure,
  analyzeTemplate,
} from "./rules-layout";

export { ATS_CATEGORIES, ATS_RULESET_VERSION } from "./model";
export type {
  AtsAnalysisCore,
  AtsCategoryKey,
  AtsCategoryScore,
  AtsFinding,
  AtsFindingEvidence,
  FindingSeverity,
} from "./model";

const CATEGORY_ANALYZERS: Record<
  AtsCategoryKey,
  (
    content: ResumeContent,
    templateProfile: TemplateAtsProfile | undefined,
  ) => CategoryResult
> = {
  contact: analyzeContact,
  summary: analyzeSummary,
  experience: analyzeExperience,
  skills: analyzeSkills,
  education: analyzeEducation,
  structure: analyzeStructure,
  links: analyzeLinks,
  template: analyzeTemplate,
  contentQuality: analyzeContentQuality,
};

/**
 * Runs the versioned ATS rules over saved resume content plus the canonical
 * template metadata. Scores are clamped to 0–100 and rounded exactly once,
 * after aggregation, so category scores stay exact and reproducible.
 */
export function analyzeResume(
  content: ResumeContent,
  templateProfile: TemplateAtsProfile | undefined,
): AtsAnalysisCore {
  const findings: AtsAnalysisCore["findings"] = [];
  const categories: AtsAnalysisCore["categories"] = [];

  let weightedTotal = 0;
  for (const category of ATS_CATEGORIES) {
    const result = CATEGORY_ANALYZERS[category.key](content, templateProfile);
    findings.push(...result.findings);

    const cappedPenalty = Math.min(category.weight, result.penalty);
    const earnedPoints = Math.max(0, category.weight - cappedPenalty);
    const score = (earnedPoints / category.weight) * 100;
    categories.push({
      key: category.key,
      label: category.label,
      weight: category.weight,
      earnedPoints,
      maxPoints: category.weight,
      score,
    });
    weightedTotal += (category.weight * score) / 100;
  }

  const overallScore = Math.max(0, Math.min(100, Math.round(weightedTotal)));
  const summary = {
    errors: findings.filter((f) => f.severity === "error").length,
    warnings: findings.filter((f) => f.severity === "warning").length,
    info: findings.filter((f) => f.severity === "info").length,
  };

  return {
    rulesetVersion: ATS_RULESET_VERSION,
    overallScore,
    categories,
    findings,
    summary,
  };
}
