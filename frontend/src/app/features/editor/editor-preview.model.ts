import { ResumeContent } from '../../core/models/resume.model';

export interface PreviewSection {
  title: string;
  entries: PreviewEntry[];
}

export interface PreviewEntry {
  key: string;
  heading: string;
  subheading: string;
  meta: string;
  bullets: string[];
}

export interface PreviewData {
  name: string;
  contactLines: string[];
  links: string[];
  summary: string;
  skills: string[];
  sections: PreviewSection[];
}

/**
 * Pure form -> preview mapping. Sections with no content are omitted so the
 * rendered A4 page stays clean. Edit-mode guidance lives in the forms, not here.
 */
export function buildPreview(content: ResumeContent): PreviewData {
  const c = content.contacts;

  const contactLines = [c.email, c.phone, c.location].filter((x) => x.trim().length > 0);
  const links = [c.linkedinUrl, c.githubUrl, c.portfolioUrl].filter((x) => x.trim().length > 0);

  const sections: PreviewSection[] = [];

  if (content.experiences.length > 0) {
    sections.push({
      title: 'Experience',
      entries: content.experiences.map((e) => ({
        key: e.id,
        heading: e.role,
        subheading: e.company,
        meta: formatDateRange(e.startDate, e.endDate, e.current),
        bullets: e.bullets,
      })),
    });
  }

  if (content.projects.length > 0) {
    sections.push({
      title: 'Projects',
      entries: content.projects.map((p) => ({
        key: p.id,
        heading: p.name,
        subheading: p.technologies,
        meta: formatDateRange(p.startDate, p.endDate, false),
        bullets: p.description ? [p.description, ...p.bullets] : p.bullets,
      })),
    });
  }

  if (content.education.length > 0) {
    sections.push({
      title: 'Education',
      entries: content.education.map((e) => ({
        key: e.id,
        heading: e.institution,
        subheading: e.degree,
        meta: formatDateRange(e.startDate, e.endDate, false),
        bullets: [e.field, e.gpa ? `GPA: ${e.gpa}` : ''].filter(Boolean),
      })),
    });
  }

  if (content.certifications.length > 0) {
    sections.push({
      title: 'Certifications',
      entries: content.certifications.map((c) => ({
        key: c.id,
        heading: c.name,
        subheading: c.issuer,
        meta: [
          formatMonth(c.issueDate),
          c.doesNotExpire ? 'Does not expire' : formatMonth(c.expiryDate),
          c.credentialId,
        ]
          .filter(Boolean)
          .join('  ·  '),
        bullets: c.credentialUrl ? [c.credentialUrl] : [],
      })),
    });
  }

  if (content.awards.length > 0) {
    sections.push({
      title: 'Awards & Achievements',
      entries: content.awards.map((a) => ({
        key: a.id,
        heading: a.title,
        subheading: a.issuer,
        meta: a.date,
        bullets: a.description ? [a.description] : [],
      })),
    });
  }

  if (content.achievements.length > 0) {
    sections.push({
      title: 'Achievements',
      entries: content.achievements.map((a) => ({
        key: a.id,
        heading: a.text,
        subheading: '',
        meta: '',
        bullets: [],
      })),
    });
  }

  return {
    name: c.fullName.trim(),
    contactLines,
    links,
    summary: content.summary.trim(),
    skills: [...content.skills],
    sections,
  };
}

function formatDateRange(start: string, end: string, current: boolean): string {
  const s = formatMonth(start);
  const e = current ? 'Present' : formatMonth(end);
  if (!s && !e) {
    return '';
  }
  return [s, e].filter(Boolean).join(' – ');
}

function formatMonth(value: string): string {
  if (!value) {
    return '';
  }
  const [year, month] = value.split('-');
  const monthNames = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const m = Number(month);
  const label = Number.isInteger(m) && m >= 1 && m <= 12 ? monthNames[m - 1] : '';
  return [label, year].filter(Boolean).join(' ');
}
