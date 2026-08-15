import type { ResumeContent } from "./resume-content";
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

const EMAIL_RE = /^[^\s@]{1,254}@[^\s@]{1,254}\.[^\s@]{2,}$/;

const ACTION_VERB_RE =
  /^(developed|built|designed|implemented|led|improved|created|migrated|architected|automated|optimized|reduced|delivered|launched)/i;

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

export function analyzeContact(content: ResumeContent): CategoryResult {
  const findings: AtsFinding[] = [];
  const contacts = content.contacts;

  if (!contacts.fullName.trim()) {
    add(
      findings,
      "contact",
      "Contact information",
      "contact.name.missing",
      "error",
      "Your full name is missing from the contact block.",
      "Add your legal name so recruiters can match you to your application.",
      4,
      { fieldPath: "contacts.fullName", evidence: missingOf(["fullName"]) },
    );
  }

  const email = contacts.email.trim();
  if (!email) {
    add(
      findings,
      "contact",
      "Contact information",
      "contact.email.missing",
      "error",
      "No email address is listed.",
      "Add an email address you check regularly.",
      5,
      { fieldPath: "contacts.email", evidence: missingOf(["email"]) },
    );
  } else if (!EMAIL_RE.test(email)) {
    add(
      findings,
      "contact",
      "Contact information",
      "contact.email.invalid",
      "error",
      "The email address looks invalid.",
      "Correct the email format, for example name@example.com.",
      5,
      { fieldPath: "contacts.email", evidence: patternOf(email) },
    );
  }

  if (!contacts.phone.trim()) {
    add(
      findings,
      "contact",
      "Contact information",
      "contact.phone.missing",
      "warning",
      "No phone number is listed.",
      "Add a phone number with the country code.",
      3,
      { fieldPath: "contacts.phone", evidence: missingOf(["phone"]) },
    );
  }

  if (!contacts.location.trim()) {
    add(
      findings,
      "contact",
      "Contact information",
      "contact.location.missing",
      "warning",
      "No location is listed.",
      "Add your city and country so ATS filters can match your region.",
      3,
      { fieldPath: "contacts.location", evidence: missingOf(["location"]) },
    );
  }

  return { findings, penalty: sumPenalty(findings) };
}

export function analyzeSummary(content: ResumeContent): CategoryResult {
  const findings: AtsFinding[] = [];
  const summary = content.summary.trim();

  if (!summary) {
    add(
      findings,
      "summary",
      "Professional summary",
      "summary.missing",
      "error",
      "The professional summary is empty.",
      "Write two to four sentences covering your role, years of experience and top skills.",
      6,
      { fieldPath: "summary", evidence: missingOf(["summary"]) },
    );
    return { findings, penalty: sumPenalty(findings) };
  }

  if (summary.length < 40) {
    add(
      findings,
      "summary",
      "Professional summary",
      "summary.tooShort",
      "warning",
      "The professional summary is only a few words long.",
      "Expand it to two to four sentences so ATS keyword matching has material to use.",
      3,
      { fieldPath: "summary", evidence: countOf(summary.length) },
    );
  } else if (summary.length > 1200) {
    add(
      findings,
      "summary",
      "Professional summary",
      "summary.tooLong",
      "warning",
      "The professional summary is a large block of text.",
      "Trim it to two to four sentences; recruiters skim this section.",
      2,
      { fieldPath: "summary", evidence: countOf(summary.length) },
    );
  } else {
    const sentences = (summary.match(/[.!?](?:\s|$)/g) ?? []).length;
    if (sentences < 2 && !/[0-9]/.test(summary)) {
      add(
        findings,
        "summary",
        "Professional summary",
        "summary.weak",
        "info",
        "The summary has no measurable or concrete detail.",
        "Add a metric such as years of experience or scale of impact.",
        1,
        { fieldPath: "summary", evidence: patternOf(summary.slice(0, 80)) },
      );
    }
  }

  return { findings, penalty: sumPenalty(findings) };
}

export function analyzeExperience(content: ResumeContent): CategoryResult {
  const findings: AtsFinding[] = [];
  const experiences = content.experiences;

  if (experiences.length === 0) {
    add(
      findings,
      "experience",
      "Work experience",
      "experience.none",
      "error",
      "No work experience entries are present.",
      "Add at least one role with measurable achievement bullets.",
      20,
      { evidence: missingOf(["experience"]) },
    );
    return { findings, penalty: sumPenalty(findings) };
  }

  let missingCompany = 0;
  let missingRole = 0;
  let missingDates = 0;
  let missingBullets = 0;
  let bullets = 0;
  let measurable = 0;
  let actionVerbs = 0;

  for (const entry of experiences) {
    if (!entry.company.trim()) missingCompany += 1;
    if (!entry.role.trim()) missingRole += 1;
    if (!entry.startDate.trim() && !entry.endDate.trim() && !entry.current)
      missingDates += 1;
    if (entry.bullets.length === 0) missingBullets += 1;
    for (const bullet of entry.bullets) {
      bullets += 1;
      if (/[0-9]/.test(bullet)) measurable += 1;
      if (ACTION_VERB_RE.test(bullet.trim())) actionVerbs += 1;
    }
  }

  const measurableRatio = bullets > 0 ? measurable / bullets : 0;
  const actionVerbRatio = bullets > 0 ? actionVerbs / bullets : 0;

  if (missingCompany > 0) {
    add(
      findings,
      "experience",
      "Work experience",
      "experience.company.missing",
      "warning",
      `${missingCompany} work experience entr${missingCompany === 1 ? "y is" : "ies are"} missing a company name.`,
      "Add the company for every role.",
      3,
      { evidence: countOf(missingCompany) },
    );
  }
  if (missingRole > 0) {
    add(
      findings,
      "experience",
      "Work experience",
      "experience.role.missing",
      "warning",
      `${missingRole} work experience entr${missingRole === 1 ? "y is" : "ies are"} missing a job title.`,
      "Add the job title for every role.",
      3,
      { evidence: countOf(missingRole) },
    );
  }
  if (missingDates > 0) {
    add(
      findings,
      "experience",
      "Work experience",
      "experience.dates.missing",
      "warning",
      `${missingDates} work experience entr${missingDates === 1 ? "y is" : "ies are"} missing dates.`,
      "Add start and end month/year to each role.",
      3,
      { evidence: countOf(missingDates) },
    );
  }
  if (missingBullets > 0) {
    add(
      findings,
      "experience",
      "Work experience",
      "experience.bullets.missing",
      "warning",
      `${missingBullets} work experience entr${missingBullets === 1 ? "y has" : "ies have"} no achievement bullets.`,
      "Add two to four bullets describing what you did and the result.",
      3,
      { evidence: countOf(missingBullets) },
    );
  }
  if (bullets > 0 && measurableRatio < 0.5) {
    add(
      findings,
      "experience",
      "Work experience",
      "experience.bullets.measurable",
      "warning",
      "Fewer than half of the experience bullets are measurable.",
      'Add numbers, percentages or scale (for example, "cut load time 40%").',
      4,
      { evidence: patternOf(`${Math.round(measurableRatio * 100)}%`) },
    );
  }
  if (bullets > 0 && actionVerbRatio < 0.4) {
    add(
      findings,
      "experience",
      "Work experience",
      "experience.bullets.actionVerbs",
      "info",
      "Few bullets start with a strong action verb.",
      "Open each bullet with a verb such as developed, led, or automated.",
      1,
      { evidence: patternOf(`${Math.round(actionVerbRatio * 100)}%`) },
    );
  }

  return { findings, penalty: sumPenalty(findings) };
}

export function analyzeSkills(content: ResumeContent): CategoryResult {
  const findings: AtsFinding[] = [];
  const present = content.skills
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (present.length === 0) {
    add(
      findings,
      "skills",
      "Skills",
      "skills.none",
      "error",
      "No skills are listed.",
      "Add the technologies and tools you are confident using.",
      8,
      { fieldPath: "skills", evidence: missingOf(["skills"]) },
    );
    return { findings, penalty: sumPenalty(findings) };
  }

  const seen = new Set<string>();
  let duplicates = 0;
  let empty = 0;
  for (const raw of content.skills) {
    const skill = raw.trim();
    if (!skill) empty += 1;
    else if (seen.has(skill)) duplicates += 1;
    else seen.add(skill);
  }

  if (duplicates > 0) {
    add(
      findings,
      "skills",
      "Skills",
      "skills.duplicates",
      "warning",
      `${duplicates} duplicate skill${duplicates === 1 ? "" : "s"} listed.`,
      "Remove repeated entries so the list stays scannable.",
      3,
      { evidence: countOf(duplicates) },
    );
  }
  if (empty > 0) {
    add(
      findings,
      "skills",
      "Skills",
      "skills.emptyEntries",
      "warning",
      `${empty} skill entr${empty === 1 ? "y is" : "ies are"} blank.`,
      "Remove or complete empty skill entries.",
      2,
      { evidence: countOf(empty) },
    );
  }
  if (seen.size < 3) {
    add(
      findings,
      "skills",
      "Skills",
      "skills.sparse",
      "info",
      "Fewer than three distinct skills are listed.",
      "Add more keyword-rich skills relevant to your target role.",
      2,
      { evidence: countOf(seen.size) },
    );
  }
  if (present.length > 30) {
    add(
      findings,
      "skills",
      "Skills",
      "skills.tooMany",
      "info",
      "A very long skills list makes the resume hard to scan.",
      "Trim to the 8–15 most relevant skills for the job.",
      1,
      { evidence: countOf(present.length) },
    );
  }

  return { findings, penalty: sumPenalty(findings) };
}

export function analyzeEducation(content: ResumeContent): CategoryResult {
  const findings: AtsFinding[] = [];
  const education = content.education;

  if (education.length === 0) {
    add(
      findings,
      "education",
      "Education",
      "education.none",
      "info",
      "No education entries are present.",
      "Add your degrees and certifications; many ATS filters screen on education.",
      1,
      { evidence: missingOf(["education"]) },
    );
    return { findings, penalty: sumPenalty(findings) };
  }

  let missingInstitution = 0;
  let missingDegree = 0;
  let missingDates = 0;
  for (const entry of education) {
    if (!entry.institution.trim()) missingInstitution += 1;
    if (!entry.degree.trim() && !entry.field.trim()) missingDegree += 1;
    if (!entry.startDate.trim() && !entry.endDate.trim()) missingDates += 1;
  }

  if (missingInstitution > 0) {
    add(
      findings,
      "education",
      "Education",
      "education.institution.missing",
      "warning",
      `${missingInstitution} education entr${missingInstitution === 1 ? "y is" : "ies are"} missing an institution.`,
      "Add the school, college or university name.",
      2,
      { evidence: countOf(missingInstitution) },
    );
  }
  if (missingDegree > 0) {
    add(
      findings,
      "education",
      "Education",
      "education.degree.missing",
      "warning",
      `${missingDegree} education entr${missingDegree === 1 ? "y is" : "ies are"} missing a degree or field of study.`,
      'Add the qualification and field, for example "B.E. Computer Science".',
      2,
      { evidence: countOf(missingDegree) },
    );
  }
  if (missingDates > 0) {
    add(
      findings,
      "education",
      "Education",
      "education.dates.missing",
      "info",
      `${missingDates} education entr${missingDates === 1 ? "y is" : "ies are"} missing dates.`,
      "Add the year range for each qualification.",
      1,
      { evidence: countOf(missingDates) },
    );
  }

  return { findings, penalty: sumPenalty(findings) };
}
