export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface UserRecord extends User {
  passwordHash: string;
  updatedAt: string;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
  revokedAt: string | null;
  replacedById: string | null;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  actorUserId: string | null;
  action: string;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

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

export interface ResumeVersion {
  id: string;
  resumeId: string;
  name: string;
  published: boolean;
  isMaster: boolean;
  isTailored: boolean;
  templateId: string;
  createdAt: string;
  updatedAt: string;
  content: ResumeContent;
}

export type ResumeStatus = 'draft' | 'saved';

export interface Resume {
  id: string;
  userId: string;
  name: string;
  primary: boolean;
  status: ResumeStatus;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_TEMPLATE_ID = 't-classic-ats-navy';

export const emptyResumeContent: ResumeContent = {
  contacts: {
    fullName: '',
    title: '',
    email: '',
    phone: '',
    location: '',
    linkedinUrl: '',
    githubUrl: '',
    portfolioUrl: '',
  },
  summary: '',
  skills: [],
  experiences: [],
  projects: [],
  education: [],
  certifications: [],
  awards: [],
  achievements: [],
  languages: [],
  customSections: [],
};
