import { AuthSession } from '../../models/auth.model';
import { Resume, ResumeContent, ResumeVersion } from '../../models/resume.model';
import { ResumeTemplate, JobDescription, MatchAnalysis } from '../../models/analysis.model';
import { User } from '../../models/auth.model';
import { AtsAnalysis } from '../../models/ats.model';

const NOW = '2026-01-15T09:00:00.000Z';

/** Stable id of the single populated seeded version (see `masterVersion`). */
export const MASTER_VERSION_ID = 'v-master';

export interface MockUserRecord extends User {
  password: string;
}

const demoUser: MockUserRecord = {
  id: 'u-demo',
  name: 'Arun Kumar',
  email: 'arun@example.com',
  password: 'Password123!',
  role: 'admin',
  createdAt: NOW,
};

const demoSession: AuthSession = {
  accessToken: 'mock-access-token',
  refreshToken: 'mock-refresh-token',
  expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
  user: {
    id: demoUser.id,
    name: demoUser.name,
    email: demoUser.email,
    role: demoUser.role,
    createdAt: demoUser.createdAt,
  },
};

export const emptyContent: ResumeContent = {
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
  achievements: [],
  awards: [],
  languages: [],
  customSections: [],
};

const masterVersion: ResumeVersion = {
  id: MASTER_VERSION_ID,
  resumeId: 'r-master',
  name: 'Master Resume',
  published: true,
  isMaster: true,
  isTailored: false,
  templateId: 't-classic-ats-navy',
  createdAt: NOW,
  updatedAt: NOW,
  content: {
    contacts: {
      fullName: 'Arun Kumar',
      email: 'arun@example.com',
      phone: '+91 98765 43210',
      location: 'Bengaluru, India',
      linkedinUrl: 'https://linkedin.com/in/arunkumar',
      githubUrl: 'https://github.com/arunkumar',
      portfolioUrl: '',
    },
    summary:
      'Full-stack developer with 5 years of experience building Angular applications and Node.js REST APIs, with Oracle Database as the backend of choice.',
    skills: [
      'Angular',
      'TypeScript',
      'Node.js',
      'Express',
      'Oracle SQL',
      'PL/SQL',
      'REST APIs',
      'Docker',
    ],
    experiences: [
      {
        id: 'e-1',
        company: 'Acme Tech',
        role: 'Full-Stack Developer',
        location: 'Bengaluru, India',
        startDate: '2021-01',
        endDate: '',
        current: true,
        bullets: [
          'Developed Node.js REST APIs for employee and leave-management workflows using Oracle Database.',
          'Built Angular dashboards used by 500+ internal users.',
        ],
      },
      {
        id: 'e-2',
        company: 'TechNova',
        role: 'Frontend Developer',
        location: 'Chennai, India',
        startDate: '2019-06',
        endDate: '2020-12',
        current: false,
        bullets: ['Implemented responsive UI components with Angular and SCSS.'],
      },
    ],
    projects: [
      {
        id: 'p-1',
        name: 'Employee Management System',
        role: 'Full-Stack Developer',
        startDate: '2021-03',
        endDate: '',
        description: 'Full-stack app managing employee records and leave workflows.',
        technologies: 'Angular, Node.js, Oracle, REST APIs',
        link: '',
        bullets: ['Built CRUD APIs and an Angular front-end for HR operations.'],
      },
    ],
    education: [
      {
        id: 'edu-1',
        institution: 'Anna University',
        degree: 'B.E.',
        field: 'Computer Science',
        startDate: '2015-08',
        endDate: '2019-05',
        gpa: '8.2',
      },
    ],
    certifications: [],
    achievements: [],
    awards: [],
    languages: [],
    customSections: [],
  },
};

const masterResume: Resume = {
  id: 'r-master',
  userId: 'u-demo',
  name: 'Master Resume',
  primary: true,
  status: 'saved',
  createdAt: NOW,
  updatedAt: NOW,
};

export const templates: ResumeTemplate[] = [
  {
    id: 't-classic-ats-navy',
    name: 'Classic ATS — Navy',
    description: 'Clean single-column layout with navy accent. ATS-friendly.',
    category: 'ats',
    onePage: true,
    twoPage: true,
    style: {
      fontFamily: "'Inter', sans-serif",
      fontSize: 10,
      primaryColor: '#0f172a',
      showLinks: true,
    },
    definitionId: 't-classic-ats-navy',
  },
  {
    id: 't-premium-sidebar-navy',
    name: 'Premium Sidebar — Navy',
    description: 'Two-column sidebar layout with navy accent. Professional design.',
    category: 'modern',
    onePage: true,
    twoPage: true,
    style: {
      fontFamily: "'Segoe UI', sans-serif",
      fontSize: 10.5,
      primaryColor: '#0f172a',
      showLinks: true,
    },
    definitionId: 't-premium-sidebar-navy',
  },
  {
    id: 't-developer-console-navy',
    name: 'Developer Console — Navy',
    description: 'Terminal-inspired layout with navy accent. Code-centric design.',
    category: 'developer',
    onePage: true,
    twoPage: true,
    style: {
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 9.5,
      primaryColor: '#0f172a',
      showLinks: true,
    },
    definitionId: 't-developer-console-navy',
  },
];

export const fixtures = {
  users: [demoUser] as MockUserRecord[],
  session: demoSession,
  resumes: [masterResume],
  versions: [masterVersion],
  templates,
  jobDescriptions: [] as JobDescription[],
  matches: [] as MatchAnalysis[],
};

/**
 * Fixed ATS report for the populated seeded version (`v-master`). Deliberately
 * NOT computed from the resume content: the browser never runs scoring logic,
 * so the mock returns the same deterministic fixture regardless of edits. The
 * findings mirror the seeded content (portfolio URL empty, one single-bullet
 * role, "Oracle" repeated 4 times) so the panel's messages stay truthful.
 */
export function buildAtsAnalysisFixture(): Omit<AtsAnalysis, 'versionId'> {
  return {
    rulesetVersion: 'ats-rules-v1',
    overallScore: 97,
    categories: [
      {
        key: 'contact',
        label: 'Contact information',
        weight: 15,
        earnedPoints: 15,
        maxPoints: 15,
        score: 100,
      },
      {
        key: 'summary',
        label: 'Professional summary',
        weight: 10,
        earnedPoints: 10,
        maxPoints: 10,
        score: 100,
      },
      {
        key: 'experience',
        label: 'Work experience',
        weight: 20,
        earnedPoints: 20,
        maxPoints: 20,
        score: 100,
      },
      { key: 'skills', label: 'Skills', weight: 10, earnedPoints: 10, maxPoints: 10, score: 100 },
      {
        key: 'education',
        label: 'Education',
        weight: 5,
        earnedPoints: 5,
        maxPoints: 5,
        score: 100,
      },
      {
        key: 'structure',
        label: 'Structure & sections',
        weight: 10,
        earnedPoints: 10,
        maxPoints: 10,
        score: 100,
      },
      { key: 'links', label: 'Links', weight: 5, earnedPoints: 4, maxPoints: 5, score: 80 },
      {
        key: 'template',
        label: 'Template',
        weight: 10,
        earnedPoints: 10,
        maxPoints: 10,
        score: 100,
      },
      {
        key: 'contentQuality',
        label: 'Content quality',
        weight: 15,
        earnedPoints: 13,
        maxPoints: 15,
        score: 87,
      },
    ],
    findings: [
      {
        code: 'content.bulletDensity',
        severity: 'warning',
        category: 'contentQuality',
        section: 'Work experience',
        fieldPath: 'experiences[1].bullets',
        message: 'One or more work experience entries have only a single bullet point.',
        evidence: { kind: 'count', value: 1 },
        suggestion: 'Add at least two bullet points per role, ideally with a measurable impact.',
        pointsLost: 1,
      },
      {
        code: 'links.profile.portfolio.missing',
        severity: 'info',
        category: 'links',
        section: 'Links',
        fieldPath: 'contacts.portfolioUrl',
        message: 'No portfolio URL is listed.',
        suggestion: 'Add a portfolio URL so recruiters can see your work in depth.',
        pointsLost: 1,
      },
      {
        code: 'content.repeatedWords',
        severity: 'info',
        category: 'contentQuality',
        section: 'Content quality',
        message: '"Oracle" is repeated 4 times.',
        evidence: { kind: 'count', value: 4 },
        suggestion: 'Vary the wording to make the resume read more naturally.',
        pointsLost: 1,
      },
    ],
    summary: { errors: 0, warnings: 1, info: 2 },
  };
}
