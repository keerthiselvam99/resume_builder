/**
 * Browser-safe resume content model consumed by the shared ATS rules engine.
 * Structurally identical to the backend's `backend/src/types/domain.ts`
 * `ResumeContent` and the frontend's `resume.model.ts`, so either concrete
 * type satisfies these interfaces.
 */

export interface ContactInfo {
  fullName: string;
  title?: string;
  email: string;
  phone: string;
  location: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
}

export interface ExperienceEntry {
  id: string;
  company: string;
  role: string;
  location: string;
  startDate: string;
  endDate: string;
  current: boolean;
  bullets: string[];
}

export interface ProjectEntry {
  id: string;
  name: string;
  role: string;
  startDate: string;
  endDate: string;
  description: string;
  technologies: string;
  link: string;
  bullets: string[];
}

export interface EducationEntry {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  gpa: string;
}

export interface CertificationEntry {
  id: string;
  name: string;
  issuer: string;
  issueDate: string;
  doesNotExpire: boolean;
  expiryDate: string;
  credentialId: string;
  credentialUrl: string;
}

export interface AwardEntry {
  id: string;
  title: string;
  issuer: string;
  date: string;
  description: string;
}

export interface CustomSection {
  id: string;
  heading: string;
  items: string[];
}

export interface AchievementEntry {
  id: string;
  text: string;
}

export interface LanguageEntry {
  id: string;
  name: string;
  proficiency: string;
}

export interface ResumeContent {
  contacts: ContactInfo;
  summary: string;
  skills: string[];
  experiences: ExperienceEntry[];
  projects: ProjectEntry[];
  education: EducationEntry[];
  certifications: CertificationEntry[];
  awards: AwardEntry[];
  achievements: AchievementEntry[];
  languages: LanguageEntry[];
  customSections: CustomSection[];
}
