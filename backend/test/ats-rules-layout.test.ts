import { describe, expect, it } from 'vitest';
import {
  ATS_TEMPLATE_PROFILES,
  TemplateAtsProfile as SharedAtsProfile,
} from '../../shared/ats-template-catalogue';
import { emptyResumeContent, ResumeContent } from '../src/types/domain';
import { analyzeResume } from '../src/services/ats/ats-analysis';
import { TemplateAtsProfile } from '../src/services/template/template-catalogue';

const atsProfile: TemplateAtsProfile = {
  id: 't-classic-ats-navy',
  isAtsFriendly: true,
  isVisual: false,
  columnCount: 1,
};

const visualProfile = ATS_TEMPLATE_PROFILES.find((d) => d.isVisual);

function analyze(content: ResumeContent, profile: TemplateAtsProfile | undefined = atsProfile) {
  return analyzeResume(content, profile);
}

function contentWith(
  overrides: Omit<Partial<ResumeContent>, 'contacts'> & {
    contacts?: Partial<ResumeContent['contacts']>;
  } = {}
): ResumeContent {
  return {
    ...emptyResumeContent,
    ...overrides,
    contacts: { ...emptyResumeContent.contacts, ...(overrides.contacts ?? {}) },
  } as ResumeContent;
}

function codesOf(
  content: ResumeContent,
  profile: TemplateAtsProfile | undefined = atsProfile
): string[] {
  return analyze(content, profile).findings.map((f) => f.code);
}

describe('ATS rules engine — skills', () => {
  it('reports no skills as an error', () => {
    expect(codesOf(contentWith({ skills: [] }))).toContain('skills.none');
  });

  it('flags duplicate and blank entries', () => {
    const result = analyze(contentWith({ skills: ['Angular', 'Angular', '', 'Node.js'] }));
    const codes = result.findings.map((f) => f.code);
    expect(codes).toContain('skills.duplicates');
    expect(codes).toContain('skills.emptyEntries');
  });
});

describe('ATS rules engine — education', () => {
  it('treats missing education as a recommendation, not an error', () => {
    expect(codesOf(contentWith({ education: [] }))).toContain('education.none');
    expect(codesOf(contentWith({ education: [] }))).not.toContain('education.institution.missing');
  });

  it('warns when an entry misses its institution', () => {
    expect(
      codesOf(
        contentWith({
          education: [
            {
              id: 'ed-1',
              institution: '',
              degree: 'B.E.',
              field: 'CS',
              startDate: '2015',
              endDate: '2019',
              gpa: '',
            },
          ],
        })
      )
    ).toContain('education.institution.missing');
  });
});

describe('ATS rules engine — structure', () => {
  it('warns for one missing section and reports several as an error', () => {
    const oneMissing = contentWith({
      summary: 'A solid summary with enough length.',
      skills: ['Angular', 'Node.js'],
      experiences: [
        {
          id: 'e-1',
          company: 'Acme',
          role: 'Engineer',
          location: '',
          startDate: '2020',
          endDate: '',
          current: true,
          bullets: ['Shipped a feature.'],
        },
      ],
    });
    expect(codesOf(oneMissing)).toContain('structure.sections.missing');
    expect(codesOf(contentWith({}))).toContain('structure.sections.sparse');
  });

  it('flags blank custom section headings', () => {
    const content = contentWith({ customSections: [{ id: 'c-1', heading: '  ', items: ['x'] }] });
    expect(codesOf(content)).toContain('structure.customHeading.empty');
  });
});

describe('ATS rules engine — links', () => {
  it('rejects blocked schemes using the shared HTML validation', () => {
    const content = contentWith({ contacts: { linkedinUrl: 'javascript:alert(1)' } });
    expect(codesOf(content)).toContain('links.unsafeScheme');
  });

  it('rejects protocol-relative, non-web and bare-host links', () => {
    expect(codesOf(contentWith({ contacts: { githubUrl: '//github.com/x' } }))).toContain(
      'links.protocolRelative'
    );
    expect(
      codesOf(contentWith({ contacts: { linkedinUrl: 'ftp://linkedin.com/in/x' } }))
    ).toContain('links.invalidProtocol');
    expect(codesOf(contentWith({ contacts: { linkedinUrl: 'linkedin.com/in/x' } }))).toContain(
      'links.missingProtocol'
    );
  });

  it('warns about embedded credentials inside a valid https link', () => {
    const content = contentWith({ contacts: { portfolioUrl: 'https://user:pass@example.com' } });
    expect(codesOf(content)).toContain('links.includesCredentials');
  });

  it('accepts plain https profile links', () => {
    const content = contentWith({
      contacts: {
        linkedinUrl: 'https://linkedin.com/in/janedoe',
        githubUrl: 'https://github.com/janedoe',
      },
    });
    const codes = codesOf(content);
    expect(codes).not.toContain('links.unsafeScheme');
    expect(codes).not.toContain('links.missingProtocol');
  });
});

describe('ATS rules engine — template', () => {
  it('reports an unknown template using canonical metadata only', () => {
    const result = analyzeResume(contentWith({}), undefined);
    expect(result.findings.map((f) => f.code)).toContain('template.unknown');
  });

  it('accepts the ATS-friendly catalogue template', () => {
    expect(codesOf(contentWith({}))).not.toContain('template.notAtsFriendly');
  });

  it('flags a visual non-ATS template from the catalogue', () => {
    if (!visualProfile) {
      throw new Error('Expected a non-ATS template profile in the catalogue.');
    }
    const profile: TemplateAtsProfile = { ...(visualProfile as SharedAtsProfile) };
    expect(codesOf(contentWith({}), profile)).toContain('template.notAtsFriendly');
  });
});

describe('ATS rules engine — content quality', () => {
  it('flags long bullets', () => {
    const content = contentWith({
      summary: 'Plain ASCII summary text that is long enough to be fine.',
      experiences: [
        {
          id: 'e-1',
          company: 'Acme',
          role: 'Engineer',
          location: '',
          startDate: '2020',
          endDate: '',
          current: true,
          bullets: ['repeated long bullet '.repeat(28)],
        },
      ],
    });
    const codes = codesOf(content);
    expect(codes).toContain('content.bullets.tooLong');
  });

  it.each([
    ['accented Latin', 'José got a café in München for the résumé.'],
    ['Indic scripts', 'தமிழ் நமது மொழி. नमस्ते, मैं एक सॉफ्टवेयर इंजीनियर हूँ।'],
    ['CJK', '软件开发工程师，负责完整的系统设计。'],
    ['non-private-use astral (emoji)', 'Ship it 🚀 and keep the 🎯 sharp.'],
  ])('never penalizes valid Unicode: %s', (_label, summary) => {
    expect(
      codesOf(
        contentWith({
          summary,
          contacts: { fullName: 'Prīyañkǎ', email: 'priya@example.com' },
        })
      )
    ).not.toEqual(
      expect.arrayContaining([
        'content.nonAsciiText',
        'content.replacementCharacters',
        'content.privateUseCharacters',
        'content.controlCharacters',
      ])
    );
  });

  it('flags the replacement character U+FFFD', () => {
    expect(codesOf(contentWith({ summary: 'Waiting for data… \uFFFD signed off.' }))).toContain(
      'content.replacementCharacters'
    );
  });

  it('flags private-use Unicode characters on every plane', () => {
    const bmp = '\uE000';
    const plane15 = '\u{F0000}';
    const plane16 = '\u{100000}';
    expect(codesOf(contentWith({ summary: `Logo char ${bmp} in the summary text.` }))).toContain(
      'content.privateUseCharacters'
    );
    expect(codesOf(contentWith({ summary: `Astral logo char ${plane15} here.` }))).toContain(
      'content.privateUseCharacters'
    );
    expect(codesOf(contentWith({ summary: `Astral logo char ${plane16} here.` }))).toContain(
      'content.privateUseCharacters'
    );
  });

  it('does not flag a private-use char as control/replacement', () => {
    const codes = codesOf(contentWith({ summary: 'Logo char \uE000.' }));
    expect(codes).toContain('content.privateUseCharacters');
    expect(codes).not.toContain('content.controlCharacters');
    expect(codes).not.toContain('content.replacementCharacters');
  });

  it('flags control characters but not surrounding valid Unicode', () => {
    const codes = codesOf(contentWith({ summary: 'Heading\u0000Multilingual résumé தமிழ்.' }));
    expect(codes).toContain('content.controlCharacters');
    expect(codes).not.toContain('content.nonAsciiText');
    expect(codes).not.toContain('content.replacementCharacters');
  });
});
