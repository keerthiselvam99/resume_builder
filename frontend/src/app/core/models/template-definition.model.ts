export enum LayoutFamilyId {
  ClassicAts = 'classic-ats',
  CompactAts = 'compact-ats',
  CorporateStandard = 'corporate-standard',
  AcademicCv = 'academic-cv',
  LegalFormal = 'legal-formal',
  PremiumSidebar = 'premium-sidebar',
  ModernSplit = 'modern-split',
  CenteredHeader = 'centered-header',
  AccentTimeline = 'accent-timeline',
  CleanCards = 'clean-cards',
  DeveloperConsole = 'developer-console',
  ProductEngineer = 'product-engineer',
  DataAnalyst = 'data-analyst',
  CloudArchitect = 'cloud-architect',
  Cybersecurity = 'cybersecurity',
  ExecutiveBanner = 'executive-banner',
  LeadershipProfile = 'leadership-profile',
  Boardroom = 'boardroom',
  StrategyConsultant = 'strategy-consultant',
  FinanceProfessional = 'finance-professional',
  SwissMinimal = 'swiss-minimal',
  Editorial = 'editorial',
  GeometricAccent = 'geometric-accent',
  SoftNeutral = 'soft-neutral',
  CreativePortfolio = 'creative-portfolio',
}

export enum ColorThemeId {
  Navy = 'navy',
  Charcoal = 'charcoal',
  Teal = 'teal',
  Burgundy = 'burgundy',
}

export enum TemplateCategory {
  AtsFormal = 'ATS & Formal',
  Modern = 'Modern',
  Technical = 'Technical',
  Executive = 'Executive',
  CreativeMinimal = 'Creative & Minimal',
}

export type HeaderAlignment = 'left' | 'center' | 'right';

export interface TypographyPreset {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  headingWeight: number;
  bodyWeight: number;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  layoutFamily: LayoutFamilyId;
  colorTheme: ColorThemeId;
  category: TemplateCategory;
  columnCount: 1 | 2 | 3;
  headerAlignment: HeaderAlignment;
  typography: TypographyPreset;
  twoPage: boolean;
  onePage: boolean;
  isAtsFriendly: boolean;
  isVisual: boolean;
}
