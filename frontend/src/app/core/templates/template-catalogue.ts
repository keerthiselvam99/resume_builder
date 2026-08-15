import {
  ColorThemeId,
  HeaderAlignment,
  LayoutFamilyId,
  TemplateCategory,
  TemplateDefinition,
  TypographyPreset,
} from '../models/template-definition.model';

/**
 * Shared catalogue for every resume layout family. This file is deliberately
 * framework-free so that both the Angular application and the standalone CLI
 * scripts (thumbnail/preview generation) read from one source of truth.
 */

export type SectionKey =
  | 'summary'
  | 'skills'
  | 'experience'
  | 'projects'
  | 'education'
  | 'certifications'
  | 'awards'
  | 'languages'
  | 'custom';

export type SkillsPresentation = 'text' | 'tags' | 'rows' | 'grid';

export type LayoutShell = 'single' | 'sidebar' | 'split' | 'cards';

export type HeaderStyle = 'standard' | 'band' | 'center' | 'letterhead';

export interface LayoutMeta {
  slug: LayoutFamilyId;
  category: TemplateCategory;
  name: string;
  description: string;
  badge: 'ats' | 'visual';
  columnCount: 1 | 2 | 3;
  headerAlignment: HeaderAlignment;
  headerStyle: HeaderStyle;
  typography: TypographyPreset;
  onePage: boolean;
  twoPage: boolean;
  shell: LayoutShell;
  order: SectionKey[];
  sideOrder?: SectionKey[];
  accentOrder?: SectionKey[];
  skills: SkillsPresentation;
  /** Human-readable key describing the distinctive decorative treatment. */
  decor: string;
  sidebarDark?: boolean;
  accentFirst?: boolean;
  carded?: boolean;
  timeline?: boolean;
}

function typography(
  fontFamily: string,
  fontSize: number,
  lineHeight: number,
  headingWeight: number,
  bodyWeight: number,
): TypographyPreset {
  return { fontFamily, fontSize, lineHeight, headingWeight, bodyWeight };
}

const SIDEBAR_SIDE_ORDER: SectionKey[] = ['skills', 'languages', 'certifications'];
const SPLIT_ACCENT_ORDER: SectionKey[] = [
  'skills',
  'certifications',
  'languages',
  'awards',
  'custom',
];

export const LAYOUT_META: Record<LayoutFamilyId, LayoutMeta> = {
  // ── ATS & Formal ─────────────────────────────────────────────────────────
  [LayoutFamilyId.ClassicAts]: {
    slug: LayoutFamilyId.ClassicAts,
    category: TemplateCategory.AtsFormal,
    name: 'Classic ATS',
    description:
      'Clean single-column layout built for applicant tracking systems. Conservative typography and simple rules.',
    badge: 'ats',
    columnCount: 1,
    headerAlignment: 'left',
    headerStyle: 'standard',
    typography: typography("'Inter', 'Segoe UI', system-ui, sans-serif", 10, 1.5, 700, 400),
    onePage: true,
    twoPage: true,
    shell: 'single',
    order: [
      'summary',
      'skills',
      'experience',
      'projects',
      'education',
      'certifications',
      'awards',
      'languages',
      'custom',
    ],
    skills: 'text',
    decor: 'clean-single',
  },
  [LayoutFamilyId.CompactAts]: {
    slug: LayoutFamilyId.CompactAts,
    category: TemplateCategory.AtsFormal,
    name: 'Compact ATS',
    description:
      'High-density single-column layout for experienced candidates. Letterhead header, two-column skills grid and hairline rules.',
    badge: 'ats',
    columnCount: 1,
    headerAlignment: 'left',
    headerStyle: 'letterhead',
    typography: typography("'Inter', 'Segoe UI', system-ui, sans-serif", 8.5, 1.35, 700, 400),
    onePage: true,
    twoPage: true,
    shell: 'single',
    order: [
      'summary',
      'experience',
      'projects',
      'skills',
      'education',
      'certifications',
      'awards',
      'languages',
      'custom',
    ],
    skills: 'grid',
    decor: 'dense-grid',
  },
  [LayoutFamilyId.CorporateStandard]: {
    slug: LayoutFamilyId.CorporateStandard,
    category: TemplateCategory.AtsFormal,
    name: 'Corporate Standard',
    description:
      'Letterhead-style single-column layout. Name and contacts split left/right with numbered section headings.',
    badge: 'ats',
    columnCount: 1,
    headerAlignment: 'left',
    headerStyle: 'letterhead',
    typography: typography("'Segoe UI', system-ui, sans-serif", 10, 1.45, 600, 400),
    onePage: true,
    twoPage: true,
    shell: 'single',
    order: [
      'summary',
      'experience',
      'skills',
      'education',
      'certifications',
      'projects',
      'awards',
      'languages',
      'custom',
    ],
    skills: 'grid',
    decor: 'letterhead-numbered',
  },
  [LayoutFamilyId.AcademicCv]: {
    slug: LayoutFamilyId.AcademicCv,
    category: TemplateCategory.AtsFormal,
    name: 'Academic CV',
    description:
      'Serif single-column CV with education and research first. Centred small-caps header and formal dotted skill list.',
    badge: 'ats',
    columnCount: 1,
    headerAlignment: 'center',
    headerStyle: 'center',
    typography: typography("Georgia, 'Times New Roman', serif", 10, 1.5, 700, 400),
    onePage: true,
    twoPage: true,
    shell: 'single',
    order: [
      'education',
      'experience',
      'projects',
      'awards',
      'certifications',
      'languages',
      'custom',
      'summary',
    ],
    skills: 'rows',
    decor: 'serif-centre',
  },
  [LayoutFamilyId.LegalFormal]: {
    slug: LayoutFamilyId.LegalFormal,
    category: TemplateCategory.AtsFormal,
    name: 'Legal Formal',
    description:
      'Formal serif layout with double rules and centred uppercase headings. Suited to legal and governance profiles.',
    badge: 'ats',
    columnCount: 1,
    headerAlignment: 'center',
    headerStyle: 'center',
    typography: typography(
      "'Libre Baskerville', Georgia, 'Times New Roman', serif",
      10.5,
      1.55,
      700,
      400,
    ),
    onePage: true,
    twoPage: true,
    shell: 'single',
    order: [
      'summary',
      'experience',
      'education',
      'certifications',
      'awards',
      'projects',
      'languages',
      'custom',
      'skills',
    ],
    skills: 'rows',
    decor: 'formal-double-rule',
  },

  // ── Modern ───────────────────────────────────────────────────────────────
  [LayoutFamilyId.PremiumSidebar]: {
    slug: LayoutFamilyId.PremiumSidebar,
    category: TemplateCategory.Modern,
    name: 'Premium Sidebar',
    description:
      'Two-column sidebar layout with a light side rail for contacts, skills and certifications.',
    badge: 'visual',
    columnCount: 2,
    headerAlignment: 'left',
    headerStyle: 'standard',
    typography: typography("'Inter', 'Segoe UI', system-ui, sans-serif", 10.5, 1.55, 600, 400),
    onePage: true,
    twoPage: true,
    shell: 'sidebar',
    order: ['summary', 'experience', 'projects', 'education', 'awards', 'custom'],
    sideOrder: SIDEBAR_SIDE_ORDER,
    skills: 'tags',
    decor: 'sidebar-light',
  },
  [LayoutFamilyId.ModernSplit]: {
    slug: LayoutFamilyId.ModernSplit,
    category: TemplateCategory.Modern,
    name: 'Modern Split',
    description:
      'Asymmetric two-column layout with a header band and a right accent column for skills and credentials.',
    badge: 'visual',
    columnCount: 2,
    headerAlignment: 'left',
    headerStyle: 'standard',
    typography: typography("'Segoe UI', system-ui, sans-serif", 11, 1.55, 600, 400),
    onePage: true,
    twoPage: true,
    shell: 'split',
    order: ['summary', 'experience', 'projects', 'education'],
    accentOrder: SPLIT_ACCENT_ORDER,
    skills: 'tags',
    decor: 'split-band',
  },
  [LayoutFamilyId.CenteredHeader]: {
    slug: LayoutFamilyId.CenteredHeader,
    category: TemplateCategory.Modern,
    name: 'Centered Header',
    description:
      'Centred headline header with a ruled baseline, over a two-column body with a right accent rail.',
    badge: 'visual',
    columnCount: 2,
    headerAlignment: 'center',
    headerStyle: 'center',
    typography: typography("'Inter', 'Segoe UI', system-ui, sans-serif", 10, 1.5, 600, 400),
    onePage: true,
    twoPage: true,
    shell: 'split',
    order: ['summary', 'experience', 'projects'],
    accentOrder: ['skills', 'education', 'certifications', 'languages', 'awards', 'custom'],
    skills: 'tags',
    decor: 'centre-rule',
  },
  [LayoutFamilyId.AccentTimeline]: {
    slug: LayoutFamilyId.AccentTimeline,
    category: TemplateCategory.Modern,
    name: 'Accent Timeline',
    description:
      'Single-column layout with a vertical timeline rail and dated nodes for every experience entry.',
    badge: 'visual',
    columnCount: 1,
    headerAlignment: 'left',
    headerStyle: 'standard',
    typography: typography("'Inter', 'Segoe UI', system-ui, sans-serif", 10, 1.55, 600, 400),
    onePage: true,
    twoPage: true,
    shell: 'single',
    order: [
      'summary',
      'experience',
      'projects',
      'education',
      'skills',
      'certifications',
      'awards',
      'languages',
      'custom',
    ],
    skills: 'tags',
    decor: 'timeline',
    timeline: true,
  },
  [LayoutFamilyId.CleanCards]: {
    slug: LayoutFamilyId.CleanCards,
    category: TemplateCategory.Modern,
    name: 'Clean Cards',
    description:
      'Card-based two-column layout with rounded panels for experience, skills, projects and credentials.',
    badge: 'visual',
    columnCount: 2,
    headerAlignment: 'center',
    headerStyle: 'center',
    typography: typography("'Inter', 'Segoe UI', system-ui, sans-serif", 10, 1.5, 600, 400),
    onePage: true,
    twoPage: true,
    shell: 'cards',
    order: ['summary', 'experience', 'projects', 'education'],
    accentOrder: ['skills', 'certifications', 'awards', 'languages', 'custom'],
    skills: 'tags',
    decor: 'cards',
    carded: true,
  },

  // ── Technical ────────────────────────────────────────────────────────────
  [LayoutFamilyId.DeveloperConsole]: {
    slug: LayoutFamilyId.DeveloperConsole,
    category: TemplateCategory.Technical,
    name: 'Developer Console',
    description:
      'Terminal-inspired monospace layout that surfaces skills and projects before experience.',
    badge: 'visual',
    columnCount: 1,
    headerAlignment: 'left',
    headerStyle: 'standard',
    typography: typography(
      "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
      9.5,
      1.5,
      600,
      400,
    ),
    onePage: true,
    twoPage: true,
    shell: 'single',
    order: [
      'skills',
      'projects',
      'experience',
      'education',
      'certifications',
      'awards',
      'languages',
      'custom',
    ],
    skills: 'tags',
    decor: 'terminal',
  },
  [LayoutFamilyId.ProductEngineer]: {
    slug: LayoutFamilyId.ProductEngineer,
    category: TemplateCategory.Technical,
    name: 'Product Engineer',
    description:
      'Impact-focused two-column layout with a right metric rail, bar-underlined headings and outcome bullets.',
    badge: 'visual',
    columnCount: 2,
    headerAlignment: 'left',
    headerStyle: 'standard',
    typography: typography("'Inter', 'Segoe UI', system-ui, sans-serif", 10, 1.5, 600, 400),
    onePage: true,
    twoPage: true,
    shell: 'split',
    order: ['summary', 'experience', 'projects'],
    accentOrder: ['skills', 'education', 'certifications', 'awards', 'languages', 'custom'],
    skills: 'rows',
    decor: 'metric-accent',
  },
  [LayoutFamilyId.DataAnalyst]: {
    slug: LayoutFamilyId.DataAnalyst,
    category: TemplateCategory.Technical,
    name: 'Data Analyst',
    description:
      'Sidebar layout with quantified skill bars and data-glyph section markers for analytics profiles.',
    badge: 'visual',
    columnCount: 2,
    headerAlignment: 'left',
    headerStyle: 'standard',
    typography: typography("'Inter', 'Segoe UI', system-ui, sans-serif", 9.5, 1.5, 600, 400),
    onePage: true,
    twoPage: true,
    shell: 'sidebar',
    order: ['summary', 'experience', 'projects', 'education', 'awards', 'custom'],
    sideOrder: ['skills', 'certifications', 'languages'],
    skills: 'rows',
    decor: 'bars-sidebar',
  },
  [LayoutFamilyId.CloudArchitect]: {
    slug: LayoutFamilyId.CloudArchitect,
    category: TemplateCategory.Technical,
    name: 'Cloud Architect',
    description:
      'Two-column layout with contact chips in the header and a grouped skills grid for architecture profiles.',
    badge: 'visual',
    columnCount: 2,
    headerAlignment: 'left',
    headerStyle: 'center',
    typography: typography("'Inter', 'Segoe UI', system-ui, sans-serif", 9.5, 1.45, 600, 400),
    onePage: true,
    twoPage: true,
    shell: 'split',
    order: ['summary', 'experience', 'projects', 'education'],
    accentOrder: ['skills', 'certifications', 'languages', 'awards', 'custom'],
    skills: 'grid',
    decor: 'chips-header',
  },
  [LayoutFamilyId.Cybersecurity]: {
    slug: LayoutFamilyId.Cybersecurity,
    category: TemplateCategory.Technical,
    name: 'Cybersecurity',
    description:
      'Security-styled single-column layout with terminal-style headings and a shield-marked skills list.',
    badge: 'visual',
    columnCount: 1,
    headerAlignment: 'left',
    headerStyle: 'standard',
    typography: typography("'Space Grotesk', 'Inter', 'Segoe UI', sans-serif", 10, 1.5, 700, 400),
    onePage: true,
    twoPage: true,
    shell: 'single',
    order: [
      'summary',
      'skills',
      'certifications',
      'experience',
      'projects',
      'education',
      'awards',
      'languages',
      'custom',
    ],
    skills: 'rows',
    decor: 'terminal-shield',
  },

  // ── Executive ────────────────────────────────────────────────────────────
  [LayoutFamilyId.ExecutiveBanner]: {
    slug: LayoutFamilyId.ExecutiveBanner,
    category: TemplateCategory.Executive,
    name: 'Executive Banner',
    description:
      'Single-column layout with a full-width banner header and centred contact line for executives.',
    badge: 'visual',
    columnCount: 1,
    headerAlignment: 'center',
    headerStyle: 'band',
    typography: typography("'Inter', 'Segoe UI', system-ui, sans-serif", 10, 1.5, 700, 400),
    onePage: true,
    twoPage: true,
    shell: 'single',
    order: [
      'summary',
      'experience',
      'awards',
      'projects',
      'skills',
      'education',
      'certifications',
      'languages',
      'custom',
    ],
    skills: 'text',
    decor: 'banner-band',
  },
  [LayoutFamilyId.LeadershipProfile]: {
    slug: LayoutFamilyId.LeadershipProfile,
    category: TemplateCategory.Executive,
    name: 'Leadership Profile',
    description:
      'Executive two-column layout with a large serif headline and a right rail for leadership skills and credentials.',
    badge: 'visual',
    columnCount: 2,
    headerAlignment: 'left',
    headerStyle: 'center',
    typography: typography("'Inter', 'Segoe UI', system-ui, sans-serif", 10.5, 1.5, 700, 400),
    onePage: true,
    twoPage: true,
    shell: 'split',
    order: ['summary', 'experience', 'projects', 'awards'],
    accentOrder: ['skills', 'education', 'certifications', 'languages', 'custom'],
    skills: 'tags',
    decor: 'exec-headline',
  },
  [LayoutFamilyId.Boardroom]: {
    slug: LayoutFamilyId.Boardroom,
    category: TemplateCategory.Executive,
    name: 'Boardroom',
    description:
      'Formal serif layout with a dark side rail and restrained single-rule headings for board-level profiles.',
    badge: 'visual',
    columnCount: 2,
    headerAlignment: 'left',
    headerStyle: 'standard',
    typography: typography("Georgia, 'Times New Roman', serif", 10, 1.5, 700, 400),
    onePage: true,
    twoPage: true,
    shell: 'sidebar',
    order: ['summary', 'experience', 'awards', 'education', 'projects', 'custom'],
    sideOrder: SIDEBAR_SIDE_ORDER,
    skills: 'rows',
    decor: 'dark-sidebar',
    sidebarDark: true,
  },
  [LayoutFamilyId.StrategyConsultant]: {
    slug: LayoutFamilyId.StrategyConsultant,
    category: TemplateCategory.Executive,
    name: 'Strategy Consultant',
    description:
      'Reversed two-column consulting layout with engagements in the main column and a left expertise rail.',
    badge: 'visual',
    columnCount: 2,
    headerAlignment: 'left',
    headerStyle: 'standard',
    typography: typography("'Inter', 'Segoe UI', system-ui, sans-serif", 10, 1.55, 600, 400),
    onePage: true,
    twoPage: true,
    shell: 'split',
    order: ['summary', 'experience', 'projects'],
    accentOrder: ['skills', 'certifications', 'education', 'languages', 'awards', 'custom'],
    skills: 'tags',
    decor: 'reversed-rail',
    accentFirst: true,
  },
  [LayoutFamilyId.FinanceProfessional]: {
    slug: LayoutFamilyId.FinanceProfessional,
    category: TemplateCategory.Executive,
    name: 'Finance Professional',
    description:
      'Formal single-column layout with a letterhead header, double top rule and tabular contact figures.',
    badge: 'visual',
    columnCount: 1,
    headerAlignment: 'right',
    headerStyle: 'letterhead',
    typography: typography("'Inter', 'Segoe UI', system-ui, sans-serif", 9.5, 1.45, 700, 400),
    onePage: true,
    twoPage: true,
    shell: 'single',
    order: [
      'summary',
      'experience',
      'education',
      'certifications',
      'skills',
      'awards',
      'projects',
      'languages',
      'custom',
    ],
    skills: 'rows',
    decor: 'tabular-letterhead',
  },

  // ── Creative & Minimal ───────────────────────────────────────────────────
  [LayoutFamilyId.SwissMinimal]: {
    slug: LayoutFamilyId.SwissMinimal,
    category: TemplateCategory.CreativeMinimal,
    name: 'Swiss Minimal',
    description:
      'Grid-led Swiss-style layout with oversized typography, index numbers and strong horizontal rules.',
    badge: 'visual',
    columnCount: 1,
    headerAlignment: 'left',
    headerStyle: 'standard',
    typography: typography("'Helvetica Neue', Arial, sans-serif", 10, 1.4, 700, 400),
    onePage: true,
    twoPage: true,
    shell: 'single',
    order: [
      'summary',
      'experience',
      'skills',
      'education',
      'certifications',
      'projects',
      'awards',
      'languages',
      'custom',
    ],
    skills: 'grid',
    decor: 'swiss-grid',
  },
  [LayoutFamilyId.Editorial]: {
    slug: LayoutFamilyId.Editorial,
    category: TemplateCategory.CreativeMinimal,
    name: 'Editorial',
    description:
      'Magazine-style serif layout with a narrow metadata rail, drop-cap summary and italic pull accents.',
    badge: 'visual',
    columnCount: 2,
    headerAlignment: 'left',
    headerStyle: 'standard',
    typography: typography("Georgia, 'Times New Roman', serif", 10.5, 1.55, 700, 400),
    onePage: true,
    twoPage: true,
    shell: 'sidebar',
    order: ['summary', 'experience', 'projects', 'education', 'awards'],
    sideOrder: ['skills', 'languages', 'certifications', 'custom'],
    skills: 'tags',
    decor: 'magazine-dropcap',
  },
  [LayoutFamilyId.GeometricAccent]: {
    slug: LayoutFamilyId.GeometricAccent,
    category: TemplateCategory.CreativeMinimal,
    name: 'Geometric Accent',
    description:
      'Single-column layout with geometric section markers, diamond bullets and segmented skill chips.',
    badge: 'visual',
    columnCount: 1,
    headerAlignment: 'left',
    headerStyle: 'standard',
    typography: typography("'Inter', 'Segoe UI', system-ui, sans-serif", 10, 1.55, 700, 400),
    onePage: true,
    twoPage: true,
    shell: 'single',
    order: [
      'summary',
      'experience',
      'skills',
      'projects',
      'education',
      'certifications',
      'awards',
      'languages',
      'custom',
    ],
    skills: 'tags',
    decor: 'geometric-marks',
  },
  [LayoutFamilyId.SoftNeutral]: {
    slug: LayoutFamilyId.SoftNeutral,
    category: TemplateCategory.CreativeMinimal,
    name: 'Soft Neutral',
    description:
      'Two-column layout with a softly tinted header band, rounded accents and gentle skill chips.',
    badge: 'visual',
    columnCount: 2,
    headerAlignment: 'center',
    headerStyle: 'center',
    typography: typography("'Inter', 'Segoe UI', system-ui, sans-serif", 10, 1.5, 600, 400),
    onePage: true,
    twoPage: true,
    shell: 'split',
    order: ['summary', 'experience', 'projects'],
    accentOrder: ['skills', 'education', 'certifications', 'languages', 'custom'],
    skills: 'grid',
    decor: 'soft-tint',
  },
  [LayoutFamilyId.CreativePortfolio]: {
    slug: LayoutFamilyId.CreativePortfolio,
    category: TemplateCategory.CreativeMinimal,
    name: 'Creative Portfolio',
    description:
      'Bold single-column portfolio layout with an offset header, creative rule and colourful skill chips.',
    badge: 'visual',
    columnCount: 1,
    headerAlignment: 'left',
    headerStyle: 'standard',
    typography: typography("'Poppins', 'Inter', 'Segoe UI', sans-serif", 10, 1.5, 700, 400),
    onePage: true,
    twoPage: true,
    shell: 'single',
    order: [
      'summary',
      'experience',
      'projects',
      'skills',
      'education',
      'certifications',
      'awards',
      'languages',
      'custom',
    ],
    skills: 'tags',
    decor: 'bold-rule',
  },
};

export const LAYOUT_ORDER: readonly LayoutFamilyId[] = [
  LayoutFamilyId.ClassicAts,
  LayoutFamilyId.CompactAts,
  LayoutFamilyId.CorporateStandard,
  LayoutFamilyId.AcademicCv,
  LayoutFamilyId.LegalFormal,
  LayoutFamilyId.PremiumSidebar,
  LayoutFamilyId.ModernSplit,
  LayoutFamilyId.CenteredHeader,
  LayoutFamilyId.AccentTimeline,
  LayoutFamilyId.CleanCards,
  LayoutFamilyId.DeveloperConsole,
  LayoutFamilyId.ProductEngineer,
  LayoutFamilyId.DataAnalyst,
  LayoutFamilyId.CloudArchitect,
  LayoutFamilyId.Cybersecurity,
  LayoutFamilyId.ExecutiveBanner,
  LayoutFamilyId.LeadershipProfile,
  LayoutFamilyId.Boardroom,
  LayoutFamilyId.StrategyConsultant,
  LayoutFamilyId.FinanceProfessional,
  LayoutFamilyId.SwissMinimal,
  LayoutFamilyId.Editorial,
  LayoutFamilyId.GeometricAccent,
  LayoutFamilyId.SoftNeutral,
  LayoutFamilyId.CreativePortfolio,
];

export const THEMES: readonly ColorThemeId[] = [
  ColorThemeId.Navy,
  ColorThemeId.Charcoal,
  ColorThemeId.Teal,
  ColorThemeId.Burgundy,
];

export const CATEGORY_ORDER: readonly TemplateCategory[] = [
  TemplateCategory.AtsFormal,
  TemplateCategory.Modern,
  TemplateCategory.Technical,
  TemplateCategory.Executive,
  TemplateCategory.CreativeMinimal,
];

export function definitionId(slug: LayoutFamilyId, theme: ColorThemeId): string {
  return `t-${slug}-${theme}`;
}

export function templateName(slug: LayoutFamilyId, theme: ColorThemeId): string {
  const meta = LAYOUT_META[slug];
  const themeLabel = theme.charAt(0).toUpperCase() + theme.slice(1);
  return `${meta.name} — ${themeLabel}`;
}

export function buildDefinitions(): TemplateDefinition[] {
  const definitions: TemplateDefinition[] = [];
  for (const slug of LAYOUT_ORDER) {
    const meta = LAYOUT_META[slug];
    for (const theme of THEMES) {
      const id = definitionId(slug, theme);
      definitions.push({
        id,
        name: templateName(slug, theme),
        description:
          `${meta.description} ${theme === ColorThemeId.Navy ? '' : `Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}.`}`.trim(),
        layoutFamily: slug,
        colorTheme: theme,
        category: meta.category,
        columnCount: meta.columnCount,
        headerAlignment: meta.headerAlignment,
        typography: meta.typography,
        onePage: meta.onePage,
        twoPage: meta.twoPage,
        isAtsFriendly: meta.badge === 'ats',
        isVisual: meta.badge === 'visual',
      });
    }
  }
  return definitions;
}
