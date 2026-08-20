import { renderResumeHtml } from './resume-template-renderer';
import { ResumeContent } from '../models/resume.model';
import {
  TemplateDefinition,
  LayoutFamilyId,
  ColorThemeId,
  TemplateCategory,
} from '../models/template-definition.model';
import { buildDefinitions } from './template-catalogue';

const baseContent: ResumeContent = {
  contacts: {
    fullName: 'Jane Doe',
    title: 'Senior Software Engineer',
    email: 'jane@example.com',
    phone: '+1 555 0100',
    location: 'Seattle, WA',
    linkedinUrl: '',
    githubUrl: '',
    portfolioUrl: '',
  },
  summary: 'Senior engineer with 5 years of experience.',
  skills: ['Angular', 'TypeScript', 'Node.js'],
  experiences: [
    {
      id: 'e-1',
      company: 'Acme Corp',
      role: 'Software Engineer',
      location: 'Seattle, WA',
      startDate: '2021-01',
      endDate: '',
      current: true,
      bullets: ['Built scalable apps.', 'Led team of 3.'],
    },
  ],
  projects: [
    {
      id: 'p-1',
      name: 'Resume Builder',
      role: 'Lead Developer',
      startDate: '2023-01',
      endDate: '',
      description: 'A resume builder application.',
      technologies: 'Angular, Node.js',
      link: 'https://example.com/resume-builder',
      bullets: ['Designed UI.', 'Implemented PDF export.'],
    },
  ],
  education: [
    {
      id: 'edu-1',
      institution: 'UW',
      degree: 'B.S.',
      field: 'Computer Science',
      startDate: '2016-09',
      endDate: '2020-06',
      gpa: '3.8',
    },
  ],
  certifications: [
    {
      id: 'c-1',
      name: 'AWS Solutions Architect',
      issuer: 'AWS',
      issueDate: '2023-01',
      doesNotExpire: true,
      expiryDate: '',
      credentialId: 'AWS-123',
      credentialUrl: 'https://aws.amazon.com/certification',
    },
  ],
  awards: [
    {
      id: 'a-1',
      title: 'Employee of the Year',
      issuer: 'Acme Corp',
      date: '2023',
      description: 'Awarded for outstanding performance.',
    },
  ],
  achievements: [{ id: 'ach-1', text: 'Shipped 10+ features in Q1.' }],
  languages: [
    { id: 'lang-1', name: 'English', proficiency: 'Native' },
    { id: 'lang-2', name: 'Spanish', proficiency: 'Conversational' },
  ],
  customSections: [{ id: 'cs-1', heading: 'Open Source', items: ['Contributed to Angular CLI.'] }],
};

function makeDef(overrides: Partial<TemplateDefinition> = {}): TemplateDefinition {
  return {
    id: 't-classic-ats-navy',
    name: 'Classic ATS — Navy',
    description: 'Clean single-column layout.',
    layoutFamily: LayoutFamilyId.ClassicAts,
    colorTheme: ColorThemeId.Navy,
    category: TemplateCategory.AtsFormal,
    columnCount: 1,
    headerAlignment: 'left',
    typography: {
      fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
      fontSize: 10,
      lineHeight: 1.5,
      headingWeight: 700,
      bodyWeight: 400,
    },
    onePage: true,
    twoPage: true,
    isAtsFriendly: true,
    isVisual: false,
    ...overrides,
  };
}

describe('renderResumeHtml — family renderers', () => {
  it('Classic ATS renders in single-column with conservative markup', () => {
    const def = makeDef({ layoutFamily: LayoutFamilyId.ClassicAts });
    const html = renderResumeHtml(baseContent, def);
    expect(html).toContain('Jane Doe');
    expect(html).toContain('Senior Software Engineer');
    expect(html).toContain('Experience');
    expect(html).toContain('Projects');
    expect(html).toContain('Education');
    expect(html).toContain('Awards &amp; Achievements');
  });

  it('Premium Sidebar renders two-column layout with sidebar', () => {
    const def = makeDef({ layoutFamily: LayoutFamilyId.PremiumSidebar, columnCount: 2 });
    const html = renderResumeHtml(baseContent, def);
    expect(html).toContain('layout-sidebar');
    expect(html).toContain('sidebar');
    expect(html).toContain('main-content');
    expect(html).toContain('background: #f8fafc');
  });

  it('Modern Split renders genuine two-column asymmetric layout', () => {
    const def = makeDef({ layoutFamily: LayoutFamilyId.ModernSplit, columnCount: 2 });
    const html = renderResumeHtml(baseContent, def);
    expect(html).toContain('layout-modern-split');
    expect(html).toContain('split-main');
    expect(html).toContain('split-accent');
    expect(html).toContain('border-top: 4px solid');
  });

  it('Developer Console renders skills and projects before experience', () => {
    const def = makeDef({ layoutFamily: LayoutFamilyId.DeveloperConsole });
    const html = renderResumeHtml(baseContent, def);
    const skillsPos = html.indexOf('Skills');
    const experiencePos = html.indexOf('Experience');
    const projectsPos = html.indexOf('Projects');
    expect(skillsPos).toBeLessThan(experiencePos);
    expect(projectsPos).toBeLessThan(experiencePos);
  });

  it('Executive Banner renders centered banner with summary before experience', () => {
    const def = makeDef({
      layoutFamily: LayoutFamilyId.ExecutiveBanner,
      headerAlignment: 'center',
    });
    const html = renderResumeHtml(baseContent, def);
    expect(html).toContain('Jane Doe');
    expect(html).toContain('banner');
    const summaryPos = html.indexOf('Summary');
    const experiencePos = html.indexOf('Experience');
    expect(summaryPos).toBeLessThan(experiencePos);
  });
});

describe('renderResumeHtml — formatting', () => {
  it('wraps content in a resume-page div with A4 dimensions', () => {
    const html = renderResumeHtml(baseContent, makeDef({}));
    expect(html).toContain('class="resume-page"');
    expect(html).toContain('width: 210mm');
    expect(html).toContain('min-height: 297mm');
    expect(html).toContain('padding: 14mm 16mm');
  });

  it('renders the professional title beneath the name', () => {
    const html = renderResumeHtml(baseContent, makeDef({}));
    expect(html).toContain('Senior Software Engineer');
  });

  it('formats dates as "Mon YYYY"', () => {
    const html = renderResumeHtml(baseContent, makeDef({}));
    expect(html).toContain('Jan 2021');
  });

  it('renders right-aligned dates in entry headers', () => {
    const html = renderResumeHtml(baseContent, makeDef({}));
    expect(html).toContain('entry__header-right');
    expect(html).toContain('entry__header-left');
  });

  it('combines Awards and Achievements into one section', () => {
    const html = renderResumeHtml(baseContent, makeDef({}));
    expect(html).toContain('Awards &amp; Achievements');
  });

  it('renders contact links without default browser underlines', () => {
    const html = renderResumeHtml(baseContent, makeDef({}));
    expect(html).toContain('text-decoration: underline');
    expect(html).toContain('text-underline-offset: 1px');
  });

  it('adds min-width: 0 and overflow protection to columns', () => {
    const html = renderResumeHtml(
      baseContent,
      makeDef({ layoutFamily: LayoutFamilyId.PremiumSidebar, columnCount: 2 }),
    );
    expect(html).toContain('min-width: 0');
    expect(html).toContain('overflow: hidden');
  });
});

describe('renderResumeHtml — security', () => {
  it('escapes HTML in content to prevent XSS', () => {
    const malicious: ResumeContent = {
      ...baseContent,
      summary: '<script>alert("xss")</script>',
    };
    const html = renderResumeHtml(malicious, makeDef({}));
    expect(html).not.toContain('<script>alert("xss")</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('strips javascript: URLs from link href attributes', () => {
    const maliciousLink: ResumeContent = {
      ...baseContent,
      projects: [
        {
          ...baseContent.projects[0],
          link: 'javascript:alert("xss")',
        },
      ],
    };
    const html = renderResumeHtml(maliciousLink, makeDef({}));
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('href=""');
  });

  it('strips data: URLs from link href attributes', () => {
    const maliciousLink: ResumeContent = {
      ...baseContent,
      projects: [
        {
          ...baseContent.projects[0],
          link: 'data:text/html,<script>alert(1)</script>',
        },
      ],
    };
    const html = renderResumeHtml(maliciousLink, makeDef({}));
    expect(html).not.toContain('href="data:');
  });

  it('allows mailto: and tel: URLs', () => {
    const html = renderResumeHtml(baseContent, makeDef({}));
    expect(html).toContain('mailto:');
    expect(html).toContain('tel:');
  });

  it('allows http/https URLs', () => {
    const html = renderResumeHtml(baseContent, makeDef({}));
    expect(html).toContain('https://');
  });

  it('strips vbscript: URLs', () => {
    const maliciousLink: ResumeContent = {
      ...baseContent,
      contacts: {
        ...baseContent.contacts,
        email: 'vbscript:alert(1)',
      },
    };
    const html = renderResumeHtml(maliciousLink, makeDef({}));
    expect(html).not.toContain('href="vbscript:');
    expect(html).not.toContain('href="mailto:vbscript:');
  });
});

describe('renderResumeHtml — theme independence', () => {
  it('renders correctly across all color themes', () => {
    Object.values(ColorThemeId).forEach((theme) => {
      const def = makeDef({ colorTheme: theme });
      const html = renderResumeHtml(baseContent, def);
      expect(html).toContain('Jane Doe');
      expect(html).toContain('Experience');
    });
  });

  it('keeps the paper white in the Burgundy theme and applies burgundy accents', () => {
    const html = renderResumeHtml(baseContent, makeDef({ colorTheme: ColorThemeId.Burgundy }));
    // Paper stays white (no pale-yellow wash).
    expect(html).toContain('background: #ffffff');
    expect(html).not.toContain('background: #fef3c7');
    // Burgundy is used for the primary accent (headings, links, rules).
    expect(html).toContain('color: #7f1d1d');
    expect(html).toContain('border-bottom-color: #7f1d1d');
    // No internal iframe scrollbars in the generated document.
    expect(html).toContain('overflow: hidden');
  });

  it('renders correctly across all 5 layout families', () => {
    Object.values(LayoutFamilyId).forEach((family) => {
      const def = makeDef({ layoutFamily: family });
      const html = renderResumeHtml(baseContent, def);
      expect(html).toContain('Jane Doe');
    });
  });
});

describe('renderResumeHtml — optional sections', () => {
  it('hides empty sections without leaving blank space', () => {
    const emptyContent: ResumeContent = {
      ...baseContent,
      summary: '',
      skills: [],
      projects: [],
      education: [],
      certifications: [],
      awards: [],
      achievements: [],
      languages: [],
      customSections: [],
    };
    const html = renderResumeHtml(emptyContent, makeDef({}));
    expect(html).not.toContain('>Summary<');
    expect(html).not.toContain('>Skills<');
    expect(html).not.toContain('>Projects<');
  });

  it('shows sections when content is present', () => {
    const html = renderResumeHtml(baseContent, makeDef({}));
    expect(html).toContain('>Summary<');
    expect(html).toContain('>Skills<');
  });
});

describe('renderResumeHtml — sparse content across the catalogue', () => {
  it('removes whitespace-only entries and empty layout slots across all 100 templates', () => {
    const sparse: ResumeContent = {
      ...baseContent,
      summary: 'Focused engineer.',
      skills: [' ', 'TypeScript'],
      experiences: [],
      projects: [{ ...baseContent.projects[0], name: ' ', description: ' ' }],
      education: [],
      certifications: [{ ...baseContent.certifications[0], name: ' ', issuer: ' ' }],
      awards: [],
      achievements: [],
      languages: [],
      customSections: [{ id: 'empty', heading: ' ', items: [' '] }],
    };
    const definitions = buildDefinitions();
    expect(definitions).toHaveLength(100);
    for (const definition of definitions) {
      const html = renderResumeHtml(sparse, definition);
      expect(html).not.toContain('>Projects<');
      expect(html).not.toContain('>Certifications<');
      expect(html).not.toContain('<h2></h2>');
      expect(html).not.toMatch(/<div class="(?:sidebar|split-accent|cards-col)"><\/div>/);
    }
  });

  it('omits entries with future or reversed dates from every template', () => {
    const futureYear = String(new Date().getFullYear() + 1);
    const invalid: ResumeContent = {
      ...baseContent,
      experiences: [{ ...baseContent.experiences[0], startDate: `${futureYear}-01`, endDate: '' }],
      projects: [{ ...baseContent.projects[0], startDate: '2024-06', endDate: '2024-05' }],
      education: [],
      certifications: [],
      awards: [],
    };
    for (const definition of buildDefinitions()) {
      const html = renderResumeHtml(invalid, definition);
      expect(html).not.toContain('>Experience<');
      expect(html).not.toContain('>Projects<');
    }
  });
});

describe('renderResumeHtml — content boundaries', () => {
  it('handles very long summary text', () => {
    const longSummary = 'A'.repeat(500);
    const content: ResumeContent = { ...baseContent, summary: longSummary };
    const html = renderResumeHtml(content, makeDef({}));
    expect(html).toContain(longSummary);
  });

  it('handles very long company name', () => {
    const longName = 'A'.repeat(200);
    const content: ResumeContent = {
      ...baseContent,
      experiences: [
        {
          id: 'e-1',
          company: longName,
          role: 'Engineer',
          location: '',
          startDate: '2021-01',
          endDate: '',
          current: true,
          bullets: ['Did work.'],
        },
      ],
    };
    const html = renderResumeHtml(content, makeDef({}));
    expect(html).toContain(longName);
  });

  it('handles many skills', () => {
    const manySkills = Array.from({ length: 50 }, (_, i) => `Skill${i}`);
    const content: ResumeContent = { ...baseContent, skills: manySkills };
    const html = renderResumeHtml(content, makeDef({}));
    manySkills.forEach((s) => expect(html).toContain(s));
  });
});

describe('renderResumeHtml — framework neutrality', () => {
  it('does not import Angular-specific attributes or components', () => {
    const html = renderResumeHtml(baseContent, makeDef({}));
    expect(html).not.toContain('ng-version');
    expect(html).not.toContain('ng-content');
    expect(html).not.toContain('ng-container');
    expect(html).not.toContain('[ng:');
  });

  it('produces a complete HTML document', () => {
    const html = renderResumeHtml(baseContent, makeDef({}));
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('<html>');
    expect(html).toContain('</html>');
    expect(html).toContain('<style>');
    expect(html).toContain('</style>');
    expect(html).toContain('<body>');
    expect(html).toContain('</body>');
  });
});
