import { ResumeContent } from '../../core/models/resume.model';
import { buildPreview } from './editor-preview.model';

const content: ResumeContent = {
  contacts: {
    fullName: 'Arun Kumar',
    email: 'arun@example.com',
    phone: '+91 98765 43210',
    location: 'Bengaluru, India',
    linkedinUrl: 'https://linkedin.com/in/arunkumar',
    githubUrl: '',
    portfolioUrl: '',
  },
  summary: 'Full-stack developer with 5 years of experience.',
  skills: ['Angular', 'TypeScript', 'Node.js'],
  experiences: [
    {
      id: 'e-1',
      company: 'Acme Tech',
      role: 'Full-Stack Developer',
      location: 'Bengaluru',
      startDate: '2021-01',
      endDate: '',
      current: true,
      bullets: ['Built Angular dashboards.'],
    },
  ],
  projects: [
    {
      id: 'p-1',
      name: 'Employee Management System',
      role: 'Full-Stack Developer',
      startDate: '2021-03',
      endDate: '',
      description: 'Full-stack HR app.',
      technologies: 'Angular, Node.js',
      link: '',
      bullets: ['Built CRUD APIs.'],
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
};

describe('buildPreview', () => {
  it('maps a filled content into a preview model', () => {
    const p = buildPreview(content);
    expect(p.name).toBe('Arun Kumar');
    expect(p.contactLines).toEqual(['arun@example.com', '+91 98765 43210', 'Bengaluru, India']);
    expect(p.links).toEqual(['https://linkedin.com/in/arunkumar']);
    expect(p.summary).toBe(content.summary);
    expect(p.skills).toEqual(content.skills);
  });

  it('formats experience dates and renders entries', () => {
    const p = buildPreview(content);
    const exp = p.sections.find((s) => s.title === 'Experience');
    expect(exp?.entries[0].heading).toBe('Full-Stack Developer');
    expect(exp?.entries[0].subheading).toBe('Acme Tech');
    expect(exp?.entries[0].meta).toBe('Jan 2021 – Present');
  });

  it('formats education dates with month names', () => {
    const p = buildPreview(content);
    const edu = p.sections.find((s) => s.title === 'Education');
    expect(edu?.entries[0].meta).toBe('Aug 2015 – May 2019');
  });

  it('trims whitespace in summary and name', () => {
    const trimmed: ResumeContent = {
      ...content,
      contacts: { ...content.contacts, fullName: '  Jane Doe  ' },
      summary: '   Hello world   ',
    };
    const p = buildPreview(trimmed);
    expect(p.name).toBe('Jane Doe');
    expect(p.summary).toBe('Hello world');
  });

  it('omits empty sections', () => {
    const emptySummaryOnly: ResumeContent = {
      ...content,
      summary: '   ',
      skills: [],
      experiences: [],
      projects: [],
      education: [],
      contacts: {
        fullName: '',
        email: '',
        phone: '',
        location: '',
        linkedinUrl: '',
        githubUrl: '',
        portfolioUrl: '',
      },
    };
    const p = buildPreview(emptySummaryOnly);
    expect(p.sections).toHaveLength(0);
    expect(p.summary).toBe('');
    expect(p.skills).toHaveLength(0);
    expect(p.name).toBe('');
    expect(p.contactLines).toHaveLength(0);
  });

  it('omits experience section when there are no entries', () => {
    const p = buildPreview({ ...content, experiences: [] });
    expect(p.sections.find((s) => s.title === 'Experience')).toBeUndefined();
  });
});
