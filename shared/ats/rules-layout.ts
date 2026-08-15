import type { ResumeContent } from "./resume-content";
import type { TemplateAtsProfile } from "../ats-template-catalogue";
import { hasUnsafeUrlScheme } from "./url-scheme";
import {
  AtsCategoryKey,
  AtsFinding,
  CategoryResult,
  countOf,
  finding,
  missingOf,
  patternOf,
  sumPenalty,
} from "./model";

function add(
  findings: AtsFinding[],
  category: AtsCategoryKey,
  section: string,
  code: string,
  severity: AtsFinding["severity"],
  message: string,
  suggestion: string,
  pointsLost: number,
  input: { fieldPath?: string; evidence?: AtsFinding["evidence"] } = {},
): void {
  findings.push(
    finding(
      category,
      section,
      code,
      severity,
      message,
      suggestion,
      pointsLost,
      input,
    ),
  );
}

const PROFILE_URLS: {
  field: "linkedinUrl" | "githubUrl" | "portfolioUrl";
  label: string;
}[] = [
  { field: "linkedinUrl", label: "LinkedIn" },
  { field: "githubUrl", label: "GitHub" },
  { field: "portfolioUrl", label: "Portfolio" },
];

const CONTROL_CHARS_RE = (() => {
  let chars = "";
  const ranges: [number, number][] = [
    [0x00, 0x08],
    [0x0b, 0x0c],
    [0x0e, 0x1f],
    [0x7f, 0x9f],
  ];
  for (const [start, end] of ranges) {
    chars += Array.from({ length: end - start + 1 }, (_, i) =>
      String.fromCharCode(start + i),
    ).join("");
  }
  return new RegExp(`[${chars}]`);
})();

// Valid Unicode (accented Latin, Indic scripts, CJK, emoji, …) is ATS-compatible
// and must never be penalized. Only these explicitly problematic codepoints are:
//   • replacement character U+FFFD (corrupted/unsupported input)
//   • every private-use plane: BMP U+E000–U+F8FF and supplementary U+F0000–U+FFFFD,
//     U+100000–U+10FFFD (platform-specific glyphs with no stable text semantics)
const REPLACEMENT_CHAR_RE = /\uFFFD/;
const PRIVATE_USE_RE =
  /[\uE000-\uF8FF\u{F0000}-\u{FFFFD}\u{100000}-\u{10FFFD}]/u;

export function analyzeStructure(content: ResumeContent): CategoryResult {
  const findings: AtsFinding[] = [];

  const sections = [
    {
      label: "Professional summary",
      name: "summary",
      present: content.summary.trim().length > 0,
    },
    {
      label: "Work experience",
      name: "experience",
      present: content.experiences.length > 0,
    },
    {
      label: "Skills",
      name: "skills",
      present: content.skills.some((s) => s.trim().length > 0),
    },
    {
      label: "Education",
      name: "education",
      present: content.education.length > 0,
    },
  ];
  const missingSectionLabels = sections
    .filter((s) => !s.present)
    .map((s) => s.label);

  if (missingSectionLabels.length > 1) {
    add(
      findings,
      "structure",
      "Sections",
      "structure.sections.sparse",
      "error",
      "Several standard resume sections are missing.",
      "Add the standard sections recruiters and ATS systems expect.",
      7,
      { evidence: missingOf(missingSectionLabels) },
    );
  } else if (missingSectionLabels.length === 1) {
    add(
      findings,
      "structure",
      "Sections",
      "structure.sections.missing",
      "warning",
      `The ${missingSectionLabels[0]} section is missing.`,
      `Add the ${missingSectionLabels[0].toLowerCase()} section.`,
      4,
      { evidence: missingOf(missingSectionLabels) },
    );
  }

  let emptyHeadings = 0;
  let duplicateHeadings = 0;
  const seenHeadings = new Set<string>();
  for (const custom of content.customSections) {
    const heading = custom.heading.trim();
    if (!heading) emptyHeadings += 1;
    else if (seenHeadings.has(heading.toLowerCase())) duplicateHeadings += 1;
    else seenHeadings.add(heading.toLowerCase());
  }

  if (emptyHeadings > 0) {
    add(
      findings,
      "structure",
      "Sections",
      "structure.customHeading.empty",
      "warning",
      `${emptyHeadings} custom section heading${emptyHeadings === 1 ? " is" : "s are"} blank.`,
      "Give every custom section a clear, standard heading.",
      1,
      { evidence: countOf(emptyHeadings) },
    );
  }
  if (duplicateHeadings > 0) {
    add(
      findings,
      "structure",
      "Sections",
      "structure.customHeading.duplicate",
      "warning",
      "Two custom sections share the same heading.",
      "Rename one of the duplicated headings.",
      1,
      { evidence: countOf(duplicateHeadings) },
    );
  }

  return { findings, penalty: sumPenalty(findings) };
}

export function analyzeLinks(content: ResumeContent): CategoryResult {
  const findings: AtsFinding[] = [];
  let missingCount = 0;

  for (const profile of PROFILE_URLS) {
    const raw = (content.contacts[profile.field] ?? "").trim();
    if (!raw) {
      missingCount += 1;
      continue;
    }
    const fieldPath = `contacts.${profile.field}`;

    if (hasUnsafeUrlScheme(raw)) {
      add(
        findings,
        "links",
        "Links",
        "links.unsafeScheme",
        "error",
        `The ${profile.label} link uses a blocked scheme.`,
        "Use a normal https:// link.",
        5,
        { fieldPath, evidence: patternOf(raw) },
      );
      continue;
    }

    if (/^https?:\/\//i.test(raw)) {
      if (/^https?:\/\/[^/@\s]+@/i.test(raw)) {
        add(
          findings,
          "links",
          "Links",
          "links.includesCredentials",
          "warning",
          `The ${profile.label} link embeds login credentials.`,
          "Remove the username and password from the URL.",
          2,
          { fieldPath, evidence: patternOf(raw) },
        );
      }
      continue;
    }

    if (/^\/\//.test(raw)) {
      add(
        findings,
        "links",
        "Links",
        "links.protocolRelative",
        "error",
        `The ${profile.label} link is protocol-relative.`,
        "Start the URL with https://",
        3,
        { fieldPath, evidence: patternOf(raw) },
      );
    } else if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) {
      add(
        findings,
        "links",
        "Links",
        "links.invalidProtocol",
        "error",
        `The ${profile.label} link uses a non-web protocol.`,
        "Use an https:// URL.",
        3,
        { fieldPath, evidence: patternOf(raw) },
      );
    } else {
      add(
        findings,
        "links",
        "Links",
        "links.missingProtocol",
        "error",
        `The ${profile.label} link has no protocol.`,
        "Start the URL with https://",
        3,
        { fieldPath, evidence: patternOf(raw) },
      );
    }
  }

  if (missingCount === PROFILE_URLS.length) {
    add(
      findings,
      "links",
      "Links",
      "links.profile.none",
      "info",
      "No profile links are listed.",
      "Add LinkedIn, GitHub or a portfolio URL so recruiters can verify your work.",
      1,
      { evidence: missingOf(["LinkedIn", "GitHub", "Portfolio"]) },
    );
  }

  return { findings, penalty: sumPenalty(findings) };
}

export function analyzeTemplate(
  _content: ResumeContent,
  templateProfile: TemplateAtsProfile | undefined,
): CategoryResult {
  const findings: AtsFinding[] = [];

  if (!templateProfile) {
    add(
      findings,
      "template",
      "Template",
      "template.unknown",
      "error",
      "The saved template is not in the template catalogue.",
      "Choose a known template from the template gallery.",
      10,
      { evidence: missingOf(["template"]) },
    );
    return { findings, penalty: sumPenalty(findings) };
  }

  if (!templateProfile.isAtsFriendly) {
    // A "visual" template's styling is the reason it is not ATS-friendly, so a
    // single finding covers both facts. An extra isVisual finding would deduct
    // points twice for the same underlying issue.
    add(
      findings,
      "template",
      "Template",
      "template.notAtsFriendly",
      "error",
      "The selected template is not ATS-friendly.",
      "Switch to a single-column, plain-text ATS template.",
      6,
      { evidence: patternOf(templateProfile.id) },
    );
  }

  if (templateProfile.isAtsFriendly && templateProfile.columnCount >= 2) {
    add(
      findings,
      "template",
      "Template",
      "template.multiColumn",
      "warning",
      "The template uses a multi-column layout.",
      "A single-column layout parses more reliably in ATS systems.",
      2,
      { evidence: countOf(templateProfile.columnCount) },
    );
  }

  return { findings, penalty: sumPenalty(findings) };
}

function bodyText(content: ResumeContent): string {
  const parts: string[] = [];
  if (content.summary.trim()) parts.push(content.summary);
  for (const skill of content.skills) if (skill.trim()) parts.push(skill);
  for (const entry of content.experiences) {
    if (entry.role.trim()) parts.push(entry.role);
    for (const bullet of entry.bullets) if (bullet.trim()) parts.push(bullet);
  }
  for (const project of content.projects) {
    if (project.description.trim()) parts.push(project.description);
    if (project.technologies.trim()) parts.push(project.technologies);
    for (const bullet of project.bullets) if (bullet.trim()) parts.push(bullet);
  }
  for (const entry of content.education) {
    if (entry.institution.trim()) parts.push(entry.institution);
    if (entry.degree.trim()) parts.push(entry.degree);
    if (entry.field.trim()) parts.push(entry.field);
  }
  for (const cert of content.certifications) {
    if (cert.name.trim()) parts.push(cert.name);
    if (cert.issuer.trim()) parts.push(cert.issuer);
  }
  for (const award of content.awards)
    if (award.title.trim()) parts.push(award.title);
  for (const achievement of content.achievements)
    if (achievement.text.trim()) parts.push(achievement.text);
  for (const language of content.languages)
    if (language.name.trim()) parts.push(language.name);
  for (const custom of content.customSections) {
    for (const item of custom.items) if (item.trim()) parts.push(item);
  }
  return parts.join(" ");
}

export function analyzeContentQuality(content: ResumeContent): CategoryResult {
  const findings: AtsFinding[] = [];
  const text = bodyText(content);

  if (text.length > 25000) {
    add(
      findings,
      "contentQuality",
      "Content quality",
      "content.length.tooLong",
      "warning",
      "The resume contains a very large amount of text.",
      "Trim to two pages; ATS parsers ignore content beyond a readable length.",
      3,
      { evidence: countOf(text.length) },
    );
  }

  if (CONTROL_CHARS_RE.test(text)) {
    add(
      findings,
      "contentQuality",
      "Content quality",
      "content.controlCharacters",
      "warning",
      "The resume contains control characters that may not extract correctly.",
      "Remove hidden formatting characters.",
      3,
      { evidence: patternOf("control characters") },
    );
  }

  if (REPLACEMENT_CHAR_RE.test(text)) {
    add(
      findings,
      "contentQuality",
      "Content quality",
      "content.replacementCharacters",
      "warning",
      "The resume contains replacement characters (U+FFFD).",
      "Replace corrupted characters with the intended text.",
      2,
      { evidence: patternOf("U+FFFD") },
    );
  }

  if (PRIVATE_USE_RE.test(text)) {
    add(
      findings,
      "contentQuality",
      "Content quality",
      "content.privateUseCharacters",
      "warning",
      "The resume contains private-use Unicode characters that may not extract correctly.",
      "Replace private-use characters with standard text.",
      2,
      {
        evidence: patternOf(
          "private-use U+E000–U+F8FF, U+F0000–U+FFFFD, U+100000–U+10FFFD",
        ),
      },
    );
  }

  let longBullets = 0;
  const bulletSource = [
    ...content.experiences.flatMap((e) => e.bullets),
    ...content.projects.flatMap((p) => p.bullets),
  ];
  for (const bullet of bulletSource) {
    if (bullet.length > 300) longBullets += 1;
  }
  if (longBullets > 0) {
    add(
      findings,
      "contentQuality",
      "Content quality",
      "content.bullets.tooLong",
      "warning",
      `${longBullets} bullet${longBullets === 1 ? "" : "s"} exceed${longBullets === 1 ? "s" : ""} 300 characters.`,
      "Split long bullets or trim them to one line each.",
      3,
      { evidence: countOf(longBullets) },
    );
  }

  const counts = new Map<string, number>();
  let topWord = "";
  let topCount = 0;
  for (const match of text.toLowerCase().match(/[a-z0-9+#.-]{4,}/g) ?? []) {
    const next = (counts.get(match) ?? 0) + 1;
    counts.set(match, next);
    if (next > topCount) {
      topCount = next;
      topWord = match;
    }
  }
  if (topCount >= 6) {
    add(
      findings,
      "contentQuality",
      "Content quality",
      "content.repeatedWords",
      "info",
      `"${topWord}" is repeated ${topCount} times.`,
      "Vary the wording to look more natural.",
      2,
      { evidence: countOf(topCount) },
    );
  }

  return { findings, penalty: sumPenalty(findings) };
}
