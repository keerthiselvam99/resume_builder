import type { ResumeContent } from "./ats/resume-content";

export const JOB_MATCH_RULESET_VERSION = "job-match-1.0.0";

export const JOB_MATCH_CATEGORIES = [
  { key: "skills", label: "Skills and technologies", weight: 35 },
  { key: "experience", label: "Work-experience relevance", weight: 25 },
  { key: "title", label: "Job-title relevance", weight: 15 },
  { key: "projects", label: "Projects and domain evidence", weight: 10 },
  { key: "education", label: "Education and certifications", weight: 10 },
  { key: "quality", label: "Content quality and measurable impact", weight: 5 },
] as const;

export type JobMatchCategoryKey = (typeof JOB_MATCH_CATEGORIES)[number]["key"];
export type RequirementPriority = "required" | "preferred" | "unspecified";
export type EvidenceSection =
  | "skills"
  | "experience"
  | "projects"
  | "education"
  | "certifications"
  | "summary";

export interface JobMatchInput {
  content: ResumeContent;
  versionId: string;
  templateId: string;
  jobTitle: string;
  company?: string;
  jobDescription: string;
}

export interface JobMatchEvidence {
  section: EvidenceSection;
  excerpt: string;
}

export interface JobMatchKeyword {
  keyword: string;
  priority: RequirementPriority;
  evidence: JobMatchEvidence[];
}

export interface JobMatchCategoryScore {
  key: JobMatchCategoryKey;
  label: string;
  weight: number;
  score: number;
  earnedPoints: number;
}

export interface JobMatchResult {
  rulesetVersion: string;
  overallScore: number;
  categories: JobMatchCategoryScore[];
  matchedKeywords: JobMatchKeyword[];
  missingKeywords: JobMatchKeyword[];
  suggestions: string[];
  inputSignature: string;
}

const ALIASES: Record<string, string[]> = {
  javascript: ["javascript", "js"],
  typescript: ["typescript"],
  "node.js": ["node.js", "nodejs", "node js"],
  "rest api": ["rest api", "rest apis", "restful api", "restful apis"],
  aws: ["aws", "amazon web services"],
  "ci/cd": [
    "ci/cd",
    "ci cd",
    "continuous integration",
    "continuous deployment",
    "continuous integration deployment",
  ],
  angular: ["angular"],
  react: ["react"],
  java: ["java"],
  python: ["python"],
  testing: ["testing", "unit testing", "automated testing"],
  docker: ["docker"],
  kubernetes: ["kubernetes"],
  sql: ["sql"],
  git: ["git"],
  azure: ["azure"],
  cypress: ["cypress"],
};

const STOP = new Set(
  "a an and are as at be by for from has have in into is it its of on or our that the their this to using we will with you your role team work experience years knowledge strong excellent ability skills skill required preferred minimum must responsibilities qualifications candidate candidates successful".split(
    " ",
  ),
);
const REQUIRED = /\b(required|must|minimum|essential|need(?:ed)?|mandatory)\b/i;
const PREFERRED = /\b(preferred|nice\s+to\s+have|bonus|desirable|advantage)\b/i;

export function normalizeJobMatchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^\p{L}\p{N}+#./-]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function phrasePattern(phrase: string): RegExp {
  const escaped = normalizeJobMatchText(phrase)
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s+");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}(?=$|[^\\p{L}\\p{N}])`, "iu");
}

function contains(text: string, canonical: string): boolean {
  return (ALIASES[canonical] ?? [canonical]).some((alias) =>
    phrasePattern(alias).test(text),
  );
}

function requirements(
  description: string,
): Array<{ keyword: string; priority: RequirementPriority }> {
  const normalized = normalizeJobMatchText(description);
  const sentences = description.split(/(?<=[.!?;\n])\s*/u);
  const found = new Map<string, RequirementPriority>();
  const add = (keyword: string, priority: RequirementPriority) => {
    const old = found.get(keyword);
    if (
      !old ||
      (priority === "required" && old !== "required") ||
      (priority === "preferred" && old === "unspecified")
    )
      found.set(keyword, priority);
  };
  for (const [canonical, aliases] of Object.entries(ALIASES)) {
    if (!aliases.some((alias) => phrasePattern(alias).test(normalized)))
      continue;
    const context =
      sentences.find((line) =>
        aliases.some((alias) =>
          phrasePattern(alias).test(normalizeJobMatchText(line)),
        ),
      ) ?? "";
    add(
      canonical,
      REQUIRED.test(context)
        ? "required"
        : PREFERRED.test(context)
          ? "preferred"
          : "unspecified",
    );
  }
  // Deliberately exclude arbitrary prose tokens. Only catalogue-backed skills
  // and technologies enter the denominator; ordinary nouns and company copy
  // are not independently actionable resume requirements.
  return [...found]
    .map(([keyword, priority]) => ({ keyword, priority }))
    .sort((a, b) => a.keyword.localeCompare(b.keyword));
}

function resumeSources(
  content: ResumeContent,
): Array<{ section: EvidenceSection; text: string }> {
  const sources: Array<{ section: EvidenceSection; text: string }> = [
    { section: "skills", text: content.skills.join(", ") },
    { section: "summary", text: content.summary },
    ...content.experiences.map((x) => ({
      section: "experience" as const,
      text: [x.role, x.company, ...x.bullets].join(" | "),
    })),
    ...content.projects.map((x) => ({
      section: "projects" as const,
      text: [x.name, x.role, x.description, x.technologies, ...x.bullets].join(
        " | ",
      ),
    })),
    ...content.education.map((x) => ({
      section: "education" as const,
      text: [x.degree, x.field, x.institution].join(" | "),
    })),
    ...content.certifications.map((x) => ({
      section: "certifications" as const,
      text: [x.name, x.issuer].join(" | "),
    })),
  ];
  return sources.filter((source) => source.text.trim());
}

function evidenceFor(
  keyword: string,
  sources: ReturnType<typeof resumeSources>,
): JobMatchEvidence[] {
  return sources
    .filter((source) => contains(normalizeJobMatchText(source.text), keyword))
    .map((source) => ({
      section: source.section,
      excerpt: source.text.trim().slice(0, 220),
    }));
}

function weightedCoverage(items: JobMatchKeyword[]): number {
  const weight = (p: RequirementPriority) =>
    p === "required" ? 3 : p === "preferred" ? 1 : 2;
  const total = items.reduce((sum, item) => sum + weight(item.priority), 0);
  if (!total) return 0;
  return (
    (100 *
      items
        .filter((item) => item.evidence.length > 0)
        .reduce(
          (sum, item) =>
            sum + (item.evidence.length ? weight(item.priority) : 0),
          0,
        )) /
    total
  );
}

function sectionCoverage(
  items: JobMatchKeyword[],
  sections: EvidenceSection[],
): number {
  if (!items.length) return 0;
  const relevant = items.filter((item) =>
    item.evidence.some((e) => sections.includes(e.section)),
  ).length;
  return (100 * relevant) / items.length;
}

function titleTerms(value: string): string[] {
  return [
    ...new Set(
      normalizeJobMatchText(value)
        .split(" ")
        .map((term) =>
          /^(developer|development|engineer|engineering|software)$/.test(term)
            ? "developer"
            : term,
        )
        .filter((term) => term.length >= 3 && !STOP.has(term)),
    ),
  ];
}

function titleRelevance(jobTitle: string, resumeText: string): number {
  const wanted = titleTerms(jobTitle);
  if (!wanted.length) return 0;
  const available = new Set(titleTerms(resumeText));
  return (100 * wanted.filter((term) => available.has(term)).length) / wanted.length;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function createJobMatchSignature(input: JobMatchInput): string {
  const canonical = JSON.stringify({
    versionId: input.versionId,
    templateId: input.templateId,
    jobTitle: normalizeJobMatchText(input.jobTitle),
    company: normalizeJobMatchText(input.company ?? ""),
    jobDescription: normalizeJobMatchText(input.jobDescription),
    content: input.content,
  });
  let hash = 2166136261;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `jm-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function analyzeJobMatch(input: JobMatchInput): JobMatchResult {
  const reqs = requirements(input.jobDescription);
  const sources = resumeSources(input.content);
  const all = reqs.map((req) => ({
    ...req,
    evidence: evidenceFor(req.keyword, sources),
  }));
  const matchedKeywords = all.filter((item) => item.evidence.length > 0);
  const missingKeywords = all.filter((item) => item.evidence.length === 0);
  const skillScore = weightedCoverage(all);
  const experienceRequirementCoverage = sectionCoverage(all, ["experience"]);
  const experienceTitleText = input.content.experiences.map((x) => x.role).join(" ");
  const experienceHasEvidence =
    experienceRequirementCoverage > 0 ||
    titleRelevance(input.jobTitle, experienceTitleText) > 0;
  const experienceScore =
    input.content.experiences.length && experienceHasEvidence
      ? 50 + experienceRequirementCoverage / 2
      : 0;
  const titleHaystack = normalizeJobMatchText(
    [
      input.content.contacts.title ?? "",
      ...input.content.experiences.map((x) => x.role),
      input.content.summary,
    ].join(" "),
  );
  const titleScore = titleRelevance(input.jobTitle, titleHaystack);
  const projectRequirementCoverage = sectionCoverage(all, ["projects"]);
  const projectScore =
    input.content.projects.length && projectRequirementCoverage > 0
      ? 50 + projectRequirementCoverage / 2
      : 0;
  const educationScore =
    (input.content.education.length ? 70 : 0) +
    (input.content.certifications.length ? 30 : 0);
  const impactText = [
    ...input.content.experiences.flatMap((x) => x.bullets),
    ...input.content.projects.flatMap((x) => x.bullets),
    ...input.content.achievements.map((x) => x.text),
  ].join(" ");
  const qualityScore = impactText.trim()
    ? clamp(
        (impactText.match(/\b\d+(?:[.,]\d+)?%?\b/g)?.length ?? 0) * 25 +
          Math.min(50, impactText.length / 12),
      )
    : 0;
  const raw: Record<JobMatchCategoryKey, number> = {
    skills: skillScore,
    experience: experienceScore,
    title: titleScore,
    projects: projectScore,
    education: educationScore,
    quality: qualityScore,
  };
  const categories = JOB_MATCH_CATEGORIES.map((category) => ({
    ...category,
    score: clamp(raw[category.key]),
    earnedPoints: Math.round(category.weight * clamp(raw[category.key])) / 100,
  }));
  const overallScore = clamp(
    categories.reduce((sum, category) => sum + category.earnedPoints, 0),
  );
  const priorityOrder: Record<RequirementPriority, number> = {
    required: 0,
    unspecified: 1,
    preferred: 2,
  };
  const suggestions = missingKeywords
    .slice()
    .sort(
      (a, b) =>
        priorityOrder[a.priority] - priorityOrder[b.priority] ||
        a.keyword.localeCompare(b.keyword),
    )
    .slice(0, 6)
    .map(
      (item) =>
        `Add truthful evidence of ${item.keyword}${item.priority === "required" ? " (required)" : ""} to the most relevant section.`,
    );
  if (!input.content.experiences.length)
    suggestions.unshift(
      "Add relevant work experience; no experience relevance credit was awarded.",
    );
  if (!/\b\d+(?:[.,]\d+)?%?\b/.test(impactText))
    suggestions.push(
      "Quantify truthful outcomes in experience or project bullets.",
    );
  return {
    rulesetVersion: JOB_MATCH_RULESET_VERSION,
    overallScore,
    categories,
    matchedKeywords,
    missingKeywords,
    suggestions: [...new Set(suggestions)].slice(0, 8),
    inputSignature: createJobMatchSignature(input),
  };
}
