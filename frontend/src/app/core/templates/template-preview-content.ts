import { ResumeContent } from '../models/resume.model';
import { TemplateDefinition } from '../models/template-definition.model';
import { renderResumeHtml } from './resume-template-renderer';

/**
 * Canonical preview-only sample content shared by Template Preview and
 * Create Resume. Both pages render the exact same content object, so for the
 * same template and theme their generated resume HTML is identical.
 *
 * IMPORTANT: This is visual preview data only. It is never saved into a user's
 * resume — a newly created resume starts from the product's empty default
 * content.
 */
export const templatePreviewSampleContent: ResumeContent = {
  contacts: {
    fullName: 'Jane Doe',
    title: 'Senior Software Engineer',
    email: 'jane@example.com',
    phone: '+1 555 0100',
    location: 'Seattle, WA',
    linkedinUrl: 'https://linkedin.com/in/janedoe',
    githubUrl: 'https://github.com/janedoe',
    portfolioUrl: '',
  },
  summary:
    'Results-driven Senior Software Engineer with 8+ years of experience building scalable web applications. ' +
    'Proven track record of delivering high-quality software solutions in fast-paced environments. ' +
    'Skilled in full-stack development, cloud architecture, and cross-functional team leadership.',
  skills: [
    'Angular',
    'TypeScript',
    'Node.js',
    'Python',
    'AWS',
    'React',
    'PostgreSQL',
    'Docker',
    'Kubernetes',
  ],
  experiences: [
    {
      id: 'e-1',
      company: 'Acme Corp',
      role: 'Senior Software Engineer',
      location: 'Seattle, WA',
      startDate: '2021-01',
      endDate: '',
      current: true,
      bullets: [
        'Led architecture for customer portal serving 500k+ monthly active users.',
        'Mentored a team of 5 engineers, improving team velocity by 30%.',
        'Migrated legacy system to microservices, reducing downtime by 99.9%.',
      ],
    },
    {
      id: 'e-2',
      company: 'TechStart Inc',
      role: 'Software Engineer',
      location: 'Portland, OR',
      startDate: '2019-06',
      endDate: '2020-12',
      current: false,
      bullets: [
        'Developed REST APIs using Node.js and Express, handling 10k+ requests daily.',
        'Implemented CI/CD pipelines with GitHub Actions, cutting deployment time by 50%.',
      ],
    },
  ],
  projects: [
    {
      id: 'p-1',
      name: 'Enterprise Dashboard',
      role: 'Lead Frontend Engineer',
      startDate: '2023-01',
      endDate: '',
      description:
        'A real-time analytics dashboard for enterprise clients with role-based access control and customizable widgets.',
      technologies: 'Angular, NgRx, D3.js, Socket.IO, AWS',
      link: 'https://example.com/enterprise-dashboard',
      bullets: ['Designed and implemented 20+ reusable components.'],
    },
  ],
  education: [
    {
      id: 'edu-1',
      institution: 'University of Washington',
      degree: 'B.S.',
      field: 'Computer Science',
      startDate: '2014-09',
      endDate: '2018-06',
      gpa: '3.8',
    },
  ],
  certifications: [
    {
      id: 'c-1',
      name: 'AWS Solutions Architect – Associate',
      issuer: 'Amazon Web Services',
      issueDate: '2023-01',
      doesNotExpire: false,
      expiryDate: '2026-01',
      credentialId: 'AWS-123ABC',
      credentialUrl: 'https://aws.amazon.com/certification',
    },
  ],
  awards: [
    {
      id: 'a-1',
      title: 'Employee of the Year',
      issuer: 'Acme Corp',
      date: '2023',
      description:
        'Awarded for outstanding performance, technical leadership, and mentoring contributions.',
    },
  ],
  achievements: [
    { id: 'ach-1', text: 'Shipped 10+ features in Q1 2024, all with zero production bugs.' },
  ],
  languages: [
    { id: 'lang-1', name: 'English', proficiency: 'Native' },
    { id: 'lang-2', name: 'Spanish', proficiency: 'Conversational' },
  ],
  customSections: [
    {
      id: 'cs-1',
      heading: 'Open Source',
      items: ['Contributed to Angular CLI.', 'Maintained an open-source resume library.'],
    },
  ],
};

/**
 * Canonical helper producing the resume preview HTML for a template
 * definition. Template Preview and Create Resume share the exact same
 * content/definition pairing, so the same template ID and theme always return
 * the same HTML.
 */
export function buildTemplatePreviewHtml(templateDefinition: TemplateDefinition): string {
  return renderResumeHtml(templatePreviewSampleContent, templateDefinition, {});
}
