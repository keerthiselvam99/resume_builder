import { ResumeContent } from '../models/resume.model';
import {
  TemplateDefinition,
  ColorThemeId,
  LayoutFamilyId,
} from '../models/template-definition.model';
import { LAYOUT_META, LayoutMeta, SectionKey } from './template-catalogue';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Width of one A4 page in CSS pixels (210mm at 96dpi). */
const A4_PAGE_WIDTH_PX = 794;
/** Height of one A4 page in CSS pixels (297mm at 96dpi), excluding margins. */
const A4_PAGE_HEIGHT_PX = 1123;

export interface RenderResumeOptions {
  /**
   * When provided, the generated document is scaled so one complete A4 page
   * fits inside a viewport of the given size without internal scrollbars or
   * clipped content. Used by fixed-size preview thumbnails.
   */
  fitTo?: { width: number; height: number };
}

export function renderResumeHtml(
  content: ResumeContent,
  definition: TemplateDefinition,
  options: RenderResumeOptions = {},
): string {
  const css = buildCss(definition);
  const fitCss = buildFitCss(options.fitTo);
  const body = buildBody(normalizeResumeContent(content), definition);
  const shell = LAYOUT_META[definition.layoutFamily].shell;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${css}${fitCss}</style></head><body><div class="resume-page" data-shell="${shell}">${body}</div>${PAGINATION_SCRIPT}</body></html>`;
}

function buildFitCss(fitTo?: { width: number; height: number }): string {
  if (!fitTo || fitTo.width <= 0 || fitTo.height <= 0) {
    return '';
  }
  const scale = Math.min(fitTo.width / A4_PAGE_WIDTH_PX, fitTo.height / A4_PAGE_HEIGHT_PX);
  return `
    @media screen {
      html, body { overflow: hidden !important; }
      #resume-pages {
        transform: scale(${scale});
        transform-origin: top center;
        margin: 0 auto;
      }
    }
  `;
}

function buildCss(definition: TemplateDefinition): string {
  const themeVars = getThemeVariables(definition.colorTheme);
  const alignment =
    definition.headerAlignment === 'center'
      ? 'center'
      : definition.headerAlignment === 'right'
        ? 'right'
        : 'left';
  const primary = themeVars['primary'];

  const familyCss = getFamilyCss(definition, themeVars);

  return `
    html, body { overflow: hidden; }
    body {
      font-family: ${definition.typography.fontFamily};
      font-size: ${definition.typography.fontSize}pt;
      line-height: ${definition.typography.lineHeight};
      color: ${themeVars.text};
      background: ${themeVars.bg};
      margin: 0;
      padding: 0;
    }
    .resume-page {
      width: 210mm;
      min-height: 297mm;
      padding: 14mm 16mm;
      box-sizing: border-box;
      margin: 0 auto;
      background: ${themeVars.bg};
      position: relative;
    }
    h1, h2, h3 {
      font-weight: ${definition.typography.headingWeight};
      color: ${primary};
    }
    h1 { font-size: ${definition.typography.fontSize * 2.8}pt; margin: 0 0 2pt; }
    h2 { font-size: ${definition.typography.fontSize * 1.4}pt; margin: 0 0 3pt; padding-bottom: 1pt; }
    h3 { font-size: ${definition.typography.fontSize * 1.1}pt; margin: 0 0 2pt; }
    a { color: ${primary}; text-decoration: underline; text-underline-offset: 1px; }
    a:hover { opacity: 0.8; }
    .section { margin-bottom: 8pt; }
    .section__title { border-bottom: 1px solid ${themeVars['border']}; padding-bottom: 1pt; margin-bottom: 4pt; text-align: ${alignment}; font-size: ${definition.typography.fontSize * 1.15}pt; font-weight: ${definition.typography.headingWeight}; }
    .entry { margin-bottom: 3pt; }
    .entry__header { display: flex; justify-content: space-between; align-items: baseline; gap: 8pt; }
    .entry__header-left { flex: 1; min-width: 0; }
    .entry__header-right { flex-shrink: 0; text-align: right; font-size: ${definition.typography.fontSize * 0.9}pt; color: ${themeVars.text}; opacity: 0.8; }
    .contact-row { display: flex; flex-wrap: wrap; gap: 4pt 12pt; align-items: center; margin-top: 2pt; font-size: ${definition.typography.fontSize * 0.85}pt; }
    .contact-row a { text-decoration: none; }
    .contact-row a:hover { text-decoration: underline; }
    .contact-row .contact-sep { opacity: 0.5; }
    .header-title { font-size: ${definition.typography.fontSize * 1.1}pt; font-weight: ${definition.typography.bodyWeight}; color: ${themeVars.text}; opacity: 0.85; margin: 1pt 0 3pt; }
    .layout-sidebar { display: grid; grid-template-columns: 30% 1fr; gap: 14pt; }
    .sidebar { min-width: 0; overflow: hidden; }
    .main-content { min-width: 0; overflow: hidden; }
    .layout-modern-split { display: grid; grid-template-columns: 62% 38%; gap: 16pt; }
    .split-main { min-width: 0; overflow: hidden; }
    .split-accent { min-width: 0; overflow: hidden; border-left: 3px solid ${primary}; padding-left: 12pt; }
    .banner { text-align: center; margin-bottom: 10pt; }
    .header-center { text-align: center; }
    .header-center .contact-row { justify-content: center; }
    .header-letterhead { display: grid; grid-template-columns: 1fr auto; gap: 12pt; align-items: end; }
    .hl-main { min-width: 0; }
    .hl-side { min-width: 0; }
    .cards-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8pt; align-items: start; }
    .cards-grid--single { grid-template-columns: 1fr; }
    .cards-col { min-width: 0; display: flex; flex-direction: column; gap: 8pt; overflow: hidden; }
    .card { border-radius: 6pt; }
    .skills-row { display: flex; flex-wrap: wrap; gap: 3pt 8pt; align-items: center; }
    .skill-tag { display: inline-block; padding: 1pt 6pt; border-radius: 3pt; font-size: ${definition.typography.fontSize * 0.85}pt; font-weight: ${definition.typography.bodyWeight}; }
    .skill-text { display: inline; }
    .skill-text .skill-sep { opacity: 0.5; margin: 0 2pt; }
    .skill-rows { display: flex; flex-direction: column; gap: 3pt; }
    .skill-row { display: grid; grid-template-columns: auto 1fr; gap: 4pt; align-items: center; }
    .skill-name { font-size: ${definition.typography.fontSize * 0.9}pt; }
    .skill-bar { display: inline-block; height: 3pt; background: ${primary}; border-radius: 2pt; opacity: 0.8; }
    .skill-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2pt 8pt; }
    .skill-cell { display: inline-block; font-size: ${definition.typography.fontSize * 0.9}pt; }
    ${familyCss}
    ${themeVars.custom}
  `;
}

function getFamilyCss(definition: TemplateDefinition, themeVars: Record<string, string>): string {
  const family = definition.layoutFamily;
  const baseFontSize = definition.typography.fontSize;
  const primary = themeVars['primary'];
  const bg = themeVars['bg'];
  const border = themeVars['border'];

  switch (family) {
    case LayoutFamilyId.ClassicAts:
      return `
        .section__title { border-bottom-width: 1.5px; }
        .entry { padding-left: 0; }
        .entry__header-left { padding-left: 0; }
        .skill-tag { display: none; }
        .skill-text { display: block; }
        ul { padding-left: 18pt; }
      `;
    case LayoutFamilyId.PremiumSidebar:
      return `
        .layout-sidebar { grid-template-columns: 30% 1fr; }
        .sidebar { background: #f8fafc; padding-right: 12pt; border-right: 1px solid ${border}; }
        .main-content { padding-left: 14pt; }
        .sidebar .section { margin-bottom: 10pt; }
        .sidebar .section__title { font-size: ${baseFontSize * 1.05}pt; border-bottom: 1px solid ${border}; }
        h2 { font-size: ${baseFontSize * 1.5}pt; }
        .section__title { border-bottom-width: 1.5px; }
        .entry__header-left { padding-left: 6pt; border-left: 2px solid ${primary}; }
        .skill-tag { background: ${primary}; color: ${bg}; }
        ul { padding-left: 16pt; }
      `;
    case LayoutFamilyId.ModernSplit:
      return `
        .resume-page { border-top: 4px solid ${primary}; padding-top: 8pt; }
        h1 { font-size: ${baseFontSize * 3.0}pt; margin-bottom: 0; }
        h2 { font-size: ${baseFontSize * 1.5}pt; margin-top: 12pt; margin-bottom: 5pt; }
        .section__title { border-bottom-width: 2px; padding-bottom: 3pt; margin-bottom: 6pt; }
        .entry { margin-bottom: 5pt; padding-left: 0; }
        .entry__header-left { padding-left: 8pt; border-left: 2px solid ${primary}; }
        .banner { border-bottom: 1px solid ${border}; padding-bottom: 6pt; margin-bottom: 8pt; }
        .skill-tag { background: ${primary}; color: ${bg}; border-radius: 3pt; }
        ul { padding-left: 18pt; }
      `;
    case LayoutFamilyId.DeveloperConsole:
      return `
        h2 { font-size: ${baseFontSize * 1.3}pt; font-family: ${definition.typography.fontFamily}; }
        .section__title { border-bottom: 1.5px solid ${primary}; font-family: ${definition.typography.fontFamily}; }
        .entry { font-size: ${baseFontSize * 0.95}pt; font-family: ${definition.typography.fontFamily}; }
        .entry__header-left { padding-left: 6pt; border-left: 1.5px solid ${primary}; }
        .skill-tag { background: ${primary}; color: ${bg}; border-radius: 3pt; font-family: ${definition.typography.fontFamily}; font-size: ${baseFontSize * 0.85}pt; }
        ul { padding-left: 18pt; }
      `;
    case LayoutFamilyId.ExecutiveBanner:
      return `
        .resume-page { padding: 10mm 16mm; border-top: 5px solid ${primary}; }
        .banner { text-align: center; margin-bottom: 10pt; background: ${primary}; margin-left: -16mm; margin-right: -16mm; padding: 10mm 16mm 6mm; }
        .banner h1 { color: white; }
        .banner .header-title { color: white; }
        .banner .contact-row { color: white; border-top: 0.5px solid rgba(255,255,255,0.3); padding-top: 4pt; }
        .banner .contact-sep { color: rgba(255,255,255,0.5); }
        h1 { font-size: ${baseFontSize * 2.8}pt; margin: 0; }
        h2 { font-size: ${baseFontSize * 1.2}pt; margin-top: 6pt; margin-bottom: 2pt; }
        .section { margin-bottom: 4pt; }
        .section__title { border-bottom: 0.5px solid ${border}; padding-bottom: 1pt; margin-bottom: 2pt; font-size: ${baseFontSize * 1.05}pt; }
        .entry { margin-bottom: 2pt; font-size: ${baseFontSize * 0.92}pt; }
        .entry__header-left { padding-left: 4pt; border-left: 0.5px solid ${border}; }
        .skill-tag { display: none; }
        .skill-text { display: block; }
        ul { padding-left: 14pt; margin-top: 1pt; }
      `;

    // ── ATS & Formal (new) ────────────────────────────────────────────────
    case LayoutFamilyId.CompactAts:
      return `
        .resume-page { padding: 9mm 11mm; }
        h1 { font-size: 16pt; letter-spacing: 0.2px; }
        .header-title { font-size: 9pt; }
        .section { margin-bottom: 5pt; }
        .section__title { text-transform: uppercase; letter-spacing: 0.6px; font-size: 8pt; border-bottom: none; padding-bottom: 0; margin-bottom: 3pt; }
        .section__title::after { content: ''; display: block; height: 1px; background: ${border}; margin-top: 1pt; }
        .entry { margin-bottom: 2.5pt; }
        .entry__header-left strong { font-weight: 600; }
        .entry__header-right { font-size: 7.5pt; }
        ul { padding-left: 12pt; margin: 1pt 0; }
        .skill-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1pt 10pt; }
        .skill-cell { font-size: 8pt; }
      `;
    case LayoutFamilyId.CorporateStandard:
      return `
        body { counter-reset: section; }
        .resume-page { padding: 12mm 14mm; }
        .header-letterhead { border-bottom: 2px solid ${primary}; padding-bottom: 6pt; margin-bottom: 8pt; }
        .hl-main h1 { font-size: 18pt; margin: 0; }
        .hl-main .header-title { font-size: 10pt; }
        .hl-side .contact-row { justify-content: flex-end; margin-top: 0; }
        .section__title { font-size: 9.5pt; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid ${border}; }
        .section__title::before { counter-increment: section; content: '0' counter(section) ' / '; font-size: 0.8em; color: ${primary}; }
        .skill-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1pt 10pt; }
        .skill-cell { font-size: 9pt; }
        .entry__header-left { font-weight: 600; }
        ul { padding-left: 16pt; }
      `;
    case LayoutFamilyId.AcademicCv:
      return `
        .resume-page { padding: 13mm 16mm; }
        .header-center { border-bottom: 1px solid ${border}; padding-bottom: 6pt; margin-bottom: 8pt; }
        .header-center h1 { font-variant: small-caps; letter-spacing: 1px; font-size: 16pt; }
        .header-center .header-title { font-style: italic; font-size: 10.5pt; }
        .header-center .contact-row { justify-content: center; }
        .section__title { text-transform: uppercase; letter-spacing: 1.5px; font-size: 9pt; text-align: center; border-bottom: 0.5px solid ${border}; }
        .entry { margin-bottom: 4pt; }
        .entry__header-left strong { font-variant: small-caps; letter-spacing: 0.4px; }
        .skill-text { font-size: 9.5pt; text-align: justify; }
        ul { padding-left: 14pt; }
      `;
    case LayoutFamilyId.LegalFormal:
      return `
        .resume-page { padding: 12mm 15mm; }
        .header-center { border-top: 3px double ${primary}; border-bottom: 3px double ${primary}; padding: 8pt 0; margin-bottom: 10pt; }
        .header-center h1 { text-transform: uppercase; letter-spacing: 2px; font-size: 15pt; margin: 0; }
        .header-center .header-title { font-style: italic; font-size: 10pt; margin-bottom: 3pt; }
        .header-center .contact-row { justify-content: center; }
        .section__title { text-align: center; text-transform: uppercase; letter-spacing: 2px; font-size: 9.5pt; border-bottom: none; margin-bottom: 3pt; }
        .section { margin-bottom: 6pt; }
        .section p { text-align: justify; }
        .skill-text { font-size: 9pt; text-align: center; }
        .entry__header-left { font-weight: 600; }
        ul { padding-left: 14pt; }
      `;

    // ── Modern (new) ──────────────────────────────────────────────────────
    case LayoutFamilyId.CenteredHeader:
      return `
        .resume-page { padding: 12mm 14mm; }
        .header-center { margin-bottom: 10pt; }
        .header-center h1 { font-size: 22pt; letter-spacing: -0.5px; margin-bottom: 1pt; }
        .header-center .header-title { font-size: 11pt; margin-bottom: 4pt; }
        .header-center::after { content: ''; display: block; width: 56pt; height: 3px; background: ${primary}; margin: 6pt auto 0; }
        .layout-modern-split { grid-template-columns: 60% 1fr; gap: 16pt; }
        .split-accent { border-left: 1px solid ${border}; padding-left: 12pt; }
        .section__title { text-transform: uppercase; letter-spacing: 0.6px; font-size: 9pt; text-align: left; border-bottom: 1px solid ${border}; }
        .skill-tag { background: ${primary}; color: ${bg}; border-radius: 3pt; }
        ul { padding-left: 16pt; }
      `;
    case LayoutFamilyId.AccentTimeline:
      return `
        .resume-page { padding: 12mm 14mm; }
        .section--timeline { border-left: 2px solid ${border}; padding-left: 16pt; margin-left: 4pt; }
        .section--timeline .section__title { margin-left: 0; }
        .section--timeline .entry { position: relative; margin-bottom: 5pt; }
        .section--timeline .entry::before { content: ''; position: absolute; left: -19pt; top: 3pt; width: 8pt; height: 8pt; border-radius: 50%; background: ${primary}; box-shadow: 0 0 0 2px ${bg}; }
        .section__title { text-transform: uppercase; letter-spacing: 0.6px; font-size: 9pt; border-bottom: 1px solid ${border}; }
        .entry__header-left { padding-left: 0; }
        .skill-tag { background: ${primary}; color: ${bg}; }
        ul { padding-left: 16pt; }
      `;
    case LayoutFamilyId.CleanCards:
      return `
        .resume-page { padding: 12mm 13mm; }
        .header-center { margin-bottom: 10pt; }
        .header-center h1 { font-size: 21pt; }
        .header-center .header-title { font-size: 10.5pt; }
        .card { background: #f8fafc; border: 1px solid ${border}; padding: 7pt 8pt; }
        .card .section { margin-bottom: 0; }
        .card .section__title { border-bottom: 1px solid ${border}; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.5px; }
        .skill-tag { background: ${primary}; color: ${bg}; }
        ul { padding-left: 14pt; }
      `;

    // ── Technical (new) ───────────────────────────────────────────────────
    case LayoutFamilyId.ProductEngineer:
      return `
        .resume-page { padding: 12mm 14mm; }
        .section__title { border-bottom: none; padding-bottom: 0; font-size: 10pt; }
        .section__title::after { content: ''; display: block; width: 28pt; height: 2px; background: ${primary}; margin-top: 1pt; }
        .layout-modern-split { grid-template-columns: 58% 1fr; }
        .split-accent { border-left: none; border-top: 3px solid ${primary}; padding-left: 0; padding-top: 8pt; }
        .skill-rows { gap: 4pt; }
        .skill-row { display: block; }
        .skill-name { display: block; font-weight: 600; font-size: 9pt; }
        .skill-bar { height: 3pt; margin-top: 1pt; }
        .entry__header-left { padding-left: 0; }
        .entry__header-right { font-weight: 600; color: ${primary}; }
        .entry ul { list-style: none; padding-left: 12pt; }
        .entry ul li::before { content: '→'; color: ${primary}; margin-left: -12pt; padding-right: 4pt; font-weight: 700; }
        ul { padding-left: 16pt; }
      `;
    case LayoutFamilyId.DataAnalyst:
      return `
        .layout-sidebar { grid-template-columns: 30% 1fr; }
        .sidebar { background: #f8fafc; padding-right: 12pt; border-right: 1px solid ${border}; }
        .main-content { padding-left: 14pt; }
        .sidebar .section__title { font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.5px; }
        .sidebar .section__title::before { content: '▮ '; color: ${primary}; }
        .main-content .section__title::before { content: '▮ '; color: ${primary}; }
        .skill-rows { gap: 4pt; }
        .skill-name { font-size: 8.5pt; font-weight: 600; }
        .skill-bar { height: 4pt; }
        .section__title { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid ${border}; }
        .entry__header-right { font-family: 'Cascadia Code', 'Consolas', monospace; font-size: 8pt; color: ${primary}; font-variant-numeric: tabular-nums; }
        ul { padding-left: 16pt; }
      `;
    case LayoutFamilyId.CloudArchitect:
      return `
        .resume-page { padding: 12mm 14mm; border-top: 4px solid ${primary}; }
        .header-center { margin-bottom: 8pt; }
        .header-center h1 { font-size: 20pt; }
        .header-center .header-title { font-size: 10pt; }
        .header-center .contact-row { gap: 4pt 6pt; justify-content: center; }
        .header-center .contact-row > a,
        .header-center .contact-row > span:not(.contact-sep) { background: ${primary}; color: ${bg}; border-radius: 999px; padding: 1pt 6pt; font-size: 8pt; }
        .header-center .contact-sep { display: none; }
        .layout-modern-split { grid-template-columns: 55% 1fr; }
        .split-accent { border-left: none; background: #f8fafc; padding: 8pt 10pt; border-radius: 4pt; }
        .split-accent .section__title { text-align: left; }
        .section__title { text-transform: uppercase; letter-spacing: 0.5px; font-size: 9pt; border-bottom: 1px solid ${border}; }
        .skill-grid { grid-template-columns: 1fr 1fr; gap: 3pt 6pt; }
        .skill-cell { font-size: 8.5pt; background: #eef2f7; border-radius: 3pt; padding: 1pt 5pt; }
        ul { padding-left: 16pt; }
      `;
    case LayoutFamilyId.Cybersecurity:
      return `
        .resume-page { padding: 12mm 14mm; }
        h1 { font-size: 18pt; }
        .section__title { font-family: 'Fira Code', 'Cascadia Code', 'Consolas', monospace; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid ${primary}; font-size: 9pt; }
        .section__title::before { content: '> '; color: ${primary}; font-weight: 700; }
        .entry__header-left { border-left: 3px solid ${primary}; padding-left: 6pt; }
        .skill-rows { display: grid; grid-template-columns: 1fr 1fr; gap: 2pt 10pt; }
        .skill-row { display: flex; align-items: center; gap: 4pt; }
        .skill-name { font-size: 9pt; }
        .skill-name::before { content: '◆'; color: ${primary}; margin-right: 4pt; font-size: 6pt; }
        .skill-bar { display: none; }
        ul { padding-left: 14pt; }
      `;

    // ── Executive (new) ───────────────────────────────────────────────────
    case LayoutFamilyId.LeadershipProfile:
      return `
        .resume-page { padding: 12mm 15mm; }
        .header-center { position: relative; border-bottom: 2px solid ${primary}; padding-bottom: 8pt; margin-bottom: 10pt; }
        .header-center h1 { font-size: 22pt; font-family: Georgia, 'Times New Roman', serif; letter-spacing: 0.5px; }
        .header-center .header-title { font-style: italic; font-size: 11pt; }
        .header-center::after { content: ''; position: absolute; left: 50%; transform: translateX(-50%); bottom: -3px; width: 40pt; height: 3px; background: ${primary}; }
        .layout-modern-split { grid-template-columns: 62% 1fr; }
        .split-accent { border-left: 1px solid ${border}; }
        .section__title { font-size: 9.5pt; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid ${border}; }
        .skill-tag { background: ${primary}; color: ${bg}; }
        ul { padding-left: 16pt; }
      `;
    case LayoutFamilyId.Boardroom:
      return `
        .resume-page { padding: 12mm 13mm; }
        .layout-sidebar { grid-template-columns: 28% 1fr; gap: 14pt; }
        .sidebar { background: ${primary}; color: var(--on-primary, #ffffff); padding: 10pt 10pt; border-right: none; border-radius: 4pt; }
        .sidebar .section__title { color: var(--on-primary, #ffffff); border-bottom: 1px solid rgba(255,255,255,0.35); }
        .sidebar a { color: var(--on-primary, #ffffff); }
        .sidebar .skill-name { color: var(--on-primary, #ffffff); }
        .sidebar .skill-bar { background: var(--on-primary, #ffffff); opacity: 0.7; }
        .sidebar .contact-row { color: var(--on-primary, #ffffff); }
        .main-content { padding-left: 4pt; }
        .section__title { font-size: 9pt; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid ${border}; }
        .entry__header-left { padding-left: 6pt; border-left: 1px solid ${border}; }
        ul { padding-left: 16pt; }
      `;
    case LayoutFamilyId.StrategyConsultant:
      return `
        .resume-page { padding: 12mm 14mm; }
        .layout-modern-split { grid-template-columns: 30% 1fr; gap: 14pt; }
        .layout-modern-split--accent-first .split-accent { order: 1; border-left: none; border-right: 1px solid ${border}; padding-right: 12pt; padding-left: 0; }
        .layout-modern-split--accent-first .split-main { order: 2; padding-left: 12pt; }
        .split-accent .section__title { text-align: right; }
        .section__title { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1px solid ${border}; }
        .entry__header-left { padding-left: 6pt; border-left: 2px solid ${primary}; }
        .skill-tag { background: ${primary}; color: ${bg}; }
        ul { padding-left: 16pt; }
      `;
    case LayoutFamilyId.FinanceProfessional:
      return `
        .resume-page { padding: 12mm 14mm; border-top: 3px double ${primary}; }
        .header-letterhead { padding-top: 8pt; margin-bottom: 8pt; }
        .hl-main h1 { font-size: 18pt; font-variant-numeric: tabular-nums; }
        .hl-main .header-title { font-size: 9.5pt; }
        .hl-side { text-align: right; font-family: 'Cascadia Code', 'Consolas', monospace; font-size: 8pt; }
        .hl-side .contact-row { justify-content: flex-end; margin-top: 0; font-variant-numeric: tabular-nums; }
        .section__title { font-size: 9pt; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: none; }
        .section__title::after { content: ''; display: block; height: 1px; background: ${primary}; margin-top: 2pt; }
        .entry__header { border-bottom: 1px dotted ${border}; padding-bottom: 1pt; margin-bottom: 1pt; }
        .entry__header-right { font-variant-numeric: tabular-nums; }
        .skill-rows { display: grid; grid-template-columns: 1fr 1fr; gap: 2pt 10pt; }
        .skill-row { display: flex; align-items: center; gap: 4pt; }
        .skill-name { font-size: 9pt; }
        .skill-bar { display: none; }
        .entry__header-left { font-weight: 600; }
        ul { padding-left: 16pt; }
      `;

    // ── Creative & Minimal (new) ──────────────────────────────────────────
    case LayoutFamilyId.SwissMinimal:
      return `
        body { counter-reset: section; }
        .resume-page { padding: 12mm 13mm; }
        h1 { font-size: 26pt; text-transform: uppercase; letter-spacing: -1px; }
        .header-title { font-size: 10pt; text-transform: uppercase; letter-spacing: 1px; }
        .contact-row { font-size: 8pt; }
        .section { border-top: 2px solid ${primary}; padding-top: 4pt; margin-bottom: 8pt; }
        .section__title { display: flex; align-items: baseline; justify-content: space-between; border-bottom: none; font-size: 9pt; text-transform: uppercase; letter-spacing: 1.5px; }
        .section__title::before { counter-increment: section; content: counter(section, decimal-leading-zero) ' / '; color: ${primary}; font-weight: 700; font-size: 0.85em; }
        .entry__header-left { padding-left: 0; }
        .skill-grid { grid-template-columns: repeat(3, 1fr); gap: 2pt 8pt; }
        .skill-cell { font-size: 8.5pt; text-transform: uppercase; letter-spacing: 0.3px; }
        ul { list-style: none; padding-left: 0; }
        ul li { margin-bottom: 1pt; }
      `;
    case LayoutFamilyId.Editorial:
      return `
        .resume-page { padding: 12mm 14mm; }
        .layout-sidebar { grid-template-columns: 26% 1fr; gap: 16pt; }
        .sidebar { border-right: 1px solid ${border}; padding-right: 10pt; background: transparent; }
        .sidebar .section__title { text-align: right; font-style: italic; }
        .sidebar a { color: ${primary}; }
        .main-content { padding-left: 4pt; }
        h1 { font-family: Georgia, 'Times New Roman', serif; font-size: 26pt; }
        .header-title { font-style: italic; font-size: 11pt; }
        .section__title { font-family: Georgia, 'Times New Roman', serif; font-size: 11pt; font-weight: 700; border-bottom: 1px solid ${border}; }
        .section--summary p:first-of-type::first-letter { font-family: Georgia, 'Times New Roman', serif; font-size: 2.4em; line-height: 1; float: left; padding-right: 2pt; color: ${primary}; }
        .entry__header-left strong { font-family: Georgia, 'Times New Roman', serif; }
        .skill-tag { background: ${primary}; color: ${bg}; }
        ul { padding-left: 14pt; }
      `;
    case LayoutFamilyId.GeometricAccent:
      return `
        .resume-page { padding: 12mm 14mm; }
        .section__title { display: flex; align-items: center; gap: 6pt; border-bottom: none; font-size: 10pt; font-weight: 700; }
        .section__title::before { content: '◆'; color: ${primary}; font-size: 7pt; transform: rotate(45deg); }
        .section__title::after { content: ''; flex: 1; height: 1px; background: linear-gradient(90deg, ${border}, transparent); }
        .entry ul { list-style: none; padding-left: 12pt; }
        .entry ul li::before { content: '◆'; color: ${primary}; margin-left: -12pt; padding-right: 5pt; font-size: 5pt; }
        .entry li { margin-bottom: 1.5pt; }
        .entry__header-left { padding-left: 8pt; border-left: 1px solid ${border}; }
        .skill-tag { background: transparent; border: 1px solid ${primary}; color: ${primary}; border-radius: 2pt; }
        ul { padding-left: 16pt; }
      `;
    case LayoutFamilyId.SoftNeutral:
      return `
        .resume-page { padding: 12mm 14mm; }
        .header-center { background: ${primary}14; border-radius: 8pt; padding: 12pt 10pt 10pt; margin-bottom: 10pt; }
        .header-center h1 { font-size: 20pt; }
        .header-center .header-title { font-size: 10.5pt; }
        .layout-modern-split { grid-template-columns: 58% 1fr; }
        .split-accent { border-left: none; background: ${primary}14; border-radius: 8pt; padding: 8pt 10pt; }
        .split-accent .section__title { text-align: left; }
        .section__title { text-transform: uppercase; letter-spacing: 0.5px; font-size: 9pt; border-bottom: none; font-weight: 600; }
        .entry__header-left { padding-left: 0; }
        .skill-tag { background: ${primary}; color: var(--on-primary, #ffffff); border-radius: 999px; }
        ul { padding-left: 16pt; }
      `;
    case LayoutFamilyId.CreativePortfolio:
      return `
        .resume-page { padding: 12mm 14mm; }
        h1 { font-size: 24pt; line-height: 1.05; }
        .header-title { display: inline-block; background: ${primary}; color: ${bg}; padding: 1pt 7pt; border-radius: 999px; font-weight: 600; }
        .contact-row { border-top: 1px solid ${border}; padding-top: 4pt; }
        .section__title { border-bottom: 3px solid ${primary}; padding-bottom: 1pt; font-size: 10pt; text-transform: uppercase; letter-spacing: 1px; }
        .entry__header-left { border-left: 3px solid ${primary}; padding-left: 6pt; }
        .skills-row .skill-tag { color: #ffffff; }
        .skills-row .skill-tag:nth-child(4n+1) { background: ${primary}; }
        .skills-row .skill-tag:nth-child(4n+2) { background: ${primary}d9; }
        .skills-row .skill-tag:nth-child(4n+3) { background: ${primary}aa; }
        .skills-row .skill-tag:nth-child(4n+4) { background: ${primary}80; }
        ul { padding-left: 16pt; }
      `;
    default:
      return '';
  }
}

function buildBody(content: ResumeContent, definition: TemplateDefinition): string {
  const meta = LAYOUT_META[definition.layoutFamily];
  switch (meta.shell) {
    case 'sidebar':
      return renderSidebar(content, meta);
    case 'split':
      return renderSplit(content, meta);
    case 'cards':
      return renderCards(content, meta);
    case 'single':
    default:
      return renderSingle(content, meta);
  }
}

function renderSingle(content: ResumeContent, meta: LayoutMeta): string {
  const parts: string[] = [renderHeaderBlock(content, meta)];
  for (const key of meta.order) {
    parts.push(renderSectionByKey(key, content, meta));
  }
  return parts.filter((part) => part.trim()).join('\n');
}

function renderSidebar(content: ResumeContent, meta: LayoutMeta): string {
  const sideParts: string[] = [renderContactSidebar(content.contacts)];
  for (const key of meta.sideOrder ?? []) {
    sideParts.push(renderSectionByKey(key, content, meta));
  }
  const sidebarHtml = sideParts
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .join('\n');

  const mainParts: string[] = [renderHeaderBlock(content, meta)];
  for (const key of meta.order) {
    mainParts.push(renderSectionByKey(key, content, meta));
  }
  const mainHtml = mainParts.filter((part) => part.trim()).join('\n');

  if (!sidebarHtml) {
    return mainHtml;
  }
  if (!mainHtml) return sidebarHtml;
  return `<div class="layout-sidebar"><div class="sidebar">${sidebarHtml}</div><div class="main-content">${mainHtml}</div></div>`;
}

function renderSplit(content: ResumeContent, meta: LayoutMeta): string {
  const headerHtml = renderHeaderBlock(content, meta);
  const headerOutside = meta.headerStyle === 'center' || meta.headerStyle === 'band';

  const mainParts: string[] = [];
  if (!headerOutside) {
    mainParts.push(headerHtml);
  }
  for (const key of meta.order) {
    mainParts.push(renderSectionByKey(key, content, meta));
  }
  const mainHtml = mainParts.join('\n');

  const accentHtml = (meta.accentOrder ?? [])
    .map((key) => renderSectionByKey(key, content, meta))
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .join('\n');

  if (!accentHtml) {
    return mainHtml;
  }
  if (!mainHtml) return headerOutside && headerHtml ? `${headerHtml}\n${accentHtml}` : accentHtml;

  const accentFirstClass = meta.accentFirst ? ' layout-modern-split--accent-first' : '';
  const grid = `<div class="layout-modern-split${accentFirstClass}"><div class="split-main">${mainHtml}</div><div class="split-accent">${accentHtml}</div></div>`;
  return headerOutside ? `${headerHtml}\n${grid}` : grid;
}

function renderCards(content: ResumeContent, meta: LayoutMeta): string {
  const headerHtml = renderHeaderBlock(content, meta);

  const leftHtml = meta.order
    .map((key) => renderSectionByKey(key, content, meta))
    .map((p) => (p.trim() ? `<div class="card">${p}</div>` : ''))
    .join('\n')
    .trim();

  const rightHtml = (meta.accentOrder ?? [])
    .map((key) => renderSectionByKey(key, content, meta))
    .map((p) => (p.trim() ? `<div class="card">${p}</div>` : ''))
    .join('\n')
    .trim();

  if (!leftHtml && !rightHtml) {
    return headerHtml;
  }
  if (!leftHtml) {
    return `${headerHtml}\n<div class="cards-grid cards-grid--single"><div class="cards-col">${rightHtml}</div></div>`;
  }
  if (!rightHtml) {
    return `${headerHtml}\n<div class="cards-grid cards-grid--single"><div class="cards-col">${leftHtml}</div></div>`;
  }
  return `${headerHtml}\n<div class="cards-grid"><div class="cards-col">${leftHtml}</div><div class="cards-col">${rightHtml}</div></div>`;
}

function renderHeaderBlock(content: ResumeContent, meta: LayoutMeta): string {
  switch (meta.headerStyle) {
    case 'band':
      return renderBannerHeaderWhite(content);
    case 'letterhead':
      return renderLetterheadHeader(content);
    case 'center':
      return `<div class="header-center">${renderHeader(content)}</div>`;
    default:
      return renderHeader(content);
  }
}

function renderSectionByKey(key: SectionKey, content: ResumeContent, meta: LayoutMeta): string {
  switch (key) {
    case 'summary':
      return renderSection('Summary', content.summary, 'section--summary');
    case 'skills':
      return renderSkillsByPresentation(content.skills, meta);
    case 'experience':
      return renderExperience(content.experiences, meta.timeline ? 'section--timeline' : '');
    case 'projects':
      return renderProjects(content.projects);
    case 'education':
      return renderEducation(content.education);
    case 'certifications':
      return renderCertifications(content.certifications);
    case 'awards':
      return renderAwardsAndAchievements(content.awards, content.achievements);
    case 'languages':
      return renderLanguages(content.languages);
    case 'custom':
      return renderCustomSections(content.customSections);
    default:
      return '';
  }
}

function renderSkillsByPresentation(skills: string[], meta: LayoutMeta): string {
  switch (meta.skills) {
    case 'tags':
      return renderSkills(skills);
    case 'rows':
      return renderSkillRows(skills);
    case 'grid':
      return renderSkillGrid(skills);
    case 'text':
    default:
      return renderSkillsText(skills);
  }
}

function renderBannerHeaderWhite(content: ResumeContent): string {
  const parts: string[] = [];
  parts.push('<div class="banner">');
  if (content.contacts.fullName) {
    parts.push(
      `<h1 style="color: white; margin-bottom: 2pt;">${escapeHtml(content.contacts.fullName)}</h1>`,
    );
  }
  if (content.contacts.title) {
    parts.push(
      `<p class="header-title" style="color: white; opacity: 0.9; margin: 0 0 4pt;">${escapeHtml(content.contacts.title)}</p>`,
    );
  }
  const contactHtml = renderContactRow(content, 'white');
  if (contactHtml.trim()) {
    parts.push(
      `<div class="contact-row" style="justify-content: center; color: white; border-top: 0.5px solid rgba(255,255,255,0.3); padding-top: 4pt;">${contactHtml}</div>`,
    );
  }
  if (parts.length === 1) return '';
  parts.push('</div>');
  return parts.join('\n');
}

function renderLetterheadHeader(content: ResumeContent): string {
  const mainParts: string[] = [];
  if (content.contacts.fullName) {
    mainParts.push(`<h1>${escapeHtml(content.contacts.fullName)}</h1>`);
  }
  if (content.contacts.title) {
    mainParts.push(`<p class="header-title">${escapeHtml(content.contacts.title)}</p>`);
  }
  const contact = renderContactRow(content);
  if (!mainParts.length && !contact) return '';
  if (!mainParts.length) return `<div class="contact-row">${contact}</div>`;
  if (!contact) return `<div class="header">${mainParts.join('\n')}</div>`;
  return `<div class="header-letterhead"><div class="hl-main">${mainParts.join('\n')}</div><div class="hl-side">${contact}</div></div>`;
}

function renderHeader(content: ResumeContent): string {
  const parts: string[] = [];
  if (content.contacts.fullName) {
    parts.push(`<h1>${escapeHtml(content.contacts.fullName)}</h1>`);
  }
  if (content.contacts.title) {
    parts.push(`<p class="header-title">${escapeHtml(content.contacts.title)}</p>`);
  }
  const contactHtml = renderContactRow(content);
  if (contactHtml.trim()) {
    parts.push(`<div class="contact-row">${contactHtml}</div>`);
  }
  return parts.length ? `<div class="header">${parts.join('\n')}</div>` : '';
}

function renderContactRow(content: ResumeContent, color?: 'white'): string {
  const linkStyle = color === 'white' ? ' style="color: white;"' : '';
  const spanStyle = color === 'white' ? ' style="color: white;"' : '';
  const contactParts: string[] = [];
  if (content.contacts.email && !/^(javascript|data|vbscript):/i.test(content.contacts.email))
    contactParts.push(
      `<a href="mailto:${escapeHtml(content.contacts.email)}"${linkStyle}>${escapeHtml(content.contacts.email)}</a>`,
    );
  if (content.contacts.phone && !/^(javascript|data|vbscript):/i.test(content.contacts.phone))
    contactParts.push(
      `<a href="tel:${content.contacts.phone.replace(/[^0-9+#]/g, '')}"${linkStyle}>${escapeHtml(content.contacts.phone)}</a>`,
    );
  if (content.contacts.location)
    contactParts.push(`<span${spanStyle}>${escapeHtml(content.contacts.location)}</span>`);
  if (content.contacts.linkedinUrl)
    contactParts.push(
      `<a href="${safeUrl(content.contacts.linkedinUrl)}"${linkStyle}>in/${extractLinkedInSlug(content.contacts.linkedinUrl)}</a>`,
    );
  if (content.contacts.githubUrl)
    contactParts.push(
      `<a href="${safeUrl(content.contacts.githubUrl)}"${linkStyle}>${extractGithubSlug(content.contacts.githubUrl)}</a>`,
    );
  if (content.contacts.portfolioUrl)
    contactParts.push(
      `<a href="${safeUrl(content.contacts.portfolioUrl)}"${linkStyle}>Portfolio</a>`,
    );
  return contactParts.join('<span class="contact-sep">&middot;</span>');
}

function renderSection(title: string, content: string, className = ''): string {
  if (!content || !content.trim()) {
    return '';
  }
  const cls = className ? `section ${className}` : 'section';
  return `<div class="${cls}"><h2>${escapeHtml(title)}</h2><p>${escapeHtml(content)}</p></div>`;
}

function renderSkills(skills: string[]): string {
  if (!skills.length) {
    return '';
  }
  return `<div class="section"><h2>Skills</h2><div class="skills-row">${skills.map((s) => `<span class="skill-tag">${escapeHtml(s)}</span>`).join('')}</div></div>`;
}

function renderSkillsText(skills: string[]): string {
  if (!skills.length) {
    return '';
  }
  return `<div class="section"><h2>Skills</h2><p class="skill-text">${skills.map((s) => escapeHtml(s)).join(' · ')}</p></div>`;
}

function renderSkillRows(skills: string[]): string {
  if (!skills.length) {
    return '';
  }
  const rows = skills
    .map((s, i) => {
      const width = 55 + ((i * 11) % 41);
      return `<div class="skill-row"><span class="skill-name">${escapeHtml(s)}</span><span class="skill-bar" style="width:${width}%"></span></div>`;
    })
    .join('');
  return `<div class="section"><h2>Skills</h2><div class="skill-rows">${rows}</div></div>`;
}

function renderSkillGrid(skills: string[]): string {
  if (!skills.length) {
    return '';
  }
  return `<div class="section"><h2>Skills</h2><div class="skill-grid">${skills.map((s) => `<span class="skill-cell">${escapeHtml(s)}</span>`).join('')}</div></div>`;
}

function renderExperience(experiences: ResumeContent['experiences'], extraClass = ''): string {
  if (!experiences.length) {
    return '';
  }
  const cls = extraClass ? `section ${extraClass}` : 'section';
  const parts: string[] = [`<div class="${cls}"><h2>Experience</h2>`];
  experiences.forEach((exp) => {
    parts.push(
      `<div class="entry"><div class="entry__header"><div class="entry__header-left"><strong>${escapeHtml(exp.company)}</strong> &mdash; <strong>${escapeHtml(exp.role)}</strong></div><div class="entry__header-right">${formatDateRange(exp.startDate, exp.endDate, exp.current)}</div></div>`,
    );
    if (exp.location) {
      parts.push(
        `<div class="entry__header-left" style="font-size: 0.85em; opacity: 0.7;">${escapeHtml(exp.location)}</div>`,
      );
    }
    if (exp.bullets.length) {
      parts.push('<ul>' + exp.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('') + '</ul>');
    }
    parts.push('</div>');
  });
  parts.push('</div>');
  return parts.join('\n');
}

function renderProjects(projects: ResumeContent['projects']): string {
  if (!projects.length) {
    return '';
  }
  const parts: string[] = ['<div class="section"><h2>Projects</h2>'];
  projects.forEach((proj) => {
    parts.push(
      `<div class="entry"><div class="entry__header"><div class="entry__header-left"><strong>${escapeHtml(proj.name)}</strong> &mdash; <strong>${escapeHtml(proj.role)}</strong></div><div class="entry__header-right">${formatDateRange(proj.startDate, proj.endDate, proj.endDate === '')}</div></div>`,
    );
    if (proj.description) parts.push(`<p>${escapeHtml(proj.description)}</p>`);
    if (proj.technologies) parts.push(`<p><em>${escapeHtml(proj.technologies)}</em></p>`);
    if (proj.link) parts.push(`<p><a href="${safeUrl(proj.link)}">View project</a></p>`);
    parts.push('</div>');
  });
  parts.push('</div>');
  return parts.join('\n');
}

function renderEducation(education: ResumeContent['education']): string {
  if (!education.length) {
    return '';
  }
  const parts: string[] = ['<div class="section"><h2>Education</h2>'];
  education.forEach((edu) => {
    parts.push(
      `<div class="entry"><div class="entry__header"><div class="entry__header-left"><strong>${escapeHtml(edu.institution)}</strong> &mdash; ${escapeHtml(edu.degree)} ${edu.field ? `<span style="opacity: 0.7;">(${escapeHtml(edu.field)})</span>` : ''}</div><div class="entry__header-right">${formatDateRange(edu.startDate, edu.endDate, false)}</div></div>`,
    );
    if (edu.gpa)
      parts.push(
        `<div class="entry__header-left" style="font-size: 0.85em; opacity: 0.7;">GPA: ${escapeHtml(edu.gpa)}</div>`,
      );
    parts.push('</div>');
  });
  parts.push('</div>');
  return parts.join('\n');
}

function renderCertifications(certifications: ResumeContent['certifications']): string {
  if (!certifications.length) {
    return '';
  }
  const parts: string[] = ['<div class="section"><h2>Certifications</h2>'];
  certifications.forEach((cert) => {
    parts.push(
      `<div class="entry"><strong>${escapeHtml(cert.name)}</strong> &mdash; ${escapeHtml(cert.issuer)}`,
    );
    if (cert.credentialId) parts.push(` &middot; ID: ${escapeHtml(cert.credentialId)}`);
    if (cert.credentialUrl)
      parts.push(` &middot; <a href="${safeUrl(cert.credentialUrl)}">View</a>`);
    parts.push('</div>');
  });
  parts.push('</div>');
  return parts.join('\n');
}

function renderAwardsAndAchievements(
  awards: ResumeContent['awards'],
  achievements: ResumeContent['achievements'],
): string {
  const hasAwards = awards.length > 0;
  const hasAchievements = achievements.length > 0;
  if (!hasAwards && !hasAchievements) {
    return '';
  }
  const parts: string[] = ['<div class="section"><h2>Awards &amp; Achievements</h2>'];
  if (hasAwards) {
    awards.forEach((award) => {
      parts.push(
        `<div class="entry"><strong>${escapeHtml(award.title)}</strong> &mdash; ${escapeHtml(award.issuer)}`,
      );
      if (award.description) parts.push(`<p>${escapeHtml(award.description)}</p>`);
      parts.push('</div>');
    });
  }
  if (hasAchievements) {
    achievements.forEach((ach) => {
      parts.push(`<div class="entry">${escapeHtml(ach.text)}</div>`);
    });
  }
  parts.push('</div>');
  return parts.join('\n');
}

function renderLanguages(languages: ResumeContent['languages']): string {
  if (!languages.length) {
    return '';
  }
  return `<div class="section"><h2>Languages</h2><p>${languages.map((l) => escapeHtml(l.name)).join(', ')}</p></div>`;
}

function renderCustomSections(customSections: ResumeContent['customSections']): string {
  if (!customSections.length) {
    return '';
  }
  return customSections
    .map(
      (section) =>
        `<div class="section"><h2>${escapeHtml(section.heading)}</h2><ul>${section.items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul></div>`,
    )
    .join('\n');
}

export function normalizeResumeContent(content: ResumeContent): ResumeContent {
  const trim = (value: string | undefined) => (value ?? '').trim();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const validMonth = (value: string | undefined) => {
    const normalized = trim(value);
    const legacyYear = /^(19[5-9]\d|20\d{2})$/.test(normalized);
    return (
      !normalized ||
      (legacyYear && normalized <= String(now.getFullYear())) ||
      (/^\d{4}-(0[1-9]|1[0-2])$/.test(normalized) &&
        normalized >= '1950-01' &&
        normalized <= currentMonth)
    );
  };
  const validRange = (start: string | undefined, end: string | undefined, current = false) =>
    validMonth(start) &&
    (current || validMonth(end)) &&
    (current || !start || !end || end >= start);
  return {
    ...content,
    contacts: Object.fromEntries(
      Object.entries(content.contacts).map(([key, value]) => [key, trim(value)]),
    ) as unknown as ResumeContent['contacts'],
    summary: trim(content.summary),
    skills: content.skills.map(trim).filter(Boolean),
    experiences: content.experiences
      .filter(
        (entry) =>
          trim(entry.company) &&
          trim(entry.role) &&
          validRange(entry.startDate, entry.endDate, entry.current),
      )
      .map((entry) => ({
        ...entry,
        company: trim(entry.company),
        role: trim(entry.role),
        location: trim(entry.location),
        bullets: entry.bullets.map(trim).filter(Boolean),
      })),
    projects: content.projects
      .filter((entry) => trim(entry.name) && validRange(entry.startDate, entry.endDate))
      .map((entry) => ({
        ...entry,
        name: trim(entry.name),
        role: trim(entry.role),
        description: trim(entry.description),
        technologies: trim(entry.technologies),
        bullets: entry.bullets.map(trim).filter(Boolean),
      })),
    education: content.education.filter(
      (entry) =>
        trim(entry.institution) && trim(entry.degree) && validRange(entry.startDate, entry.endDate),
    ),
    certifications: content.certifications.filter(
      (entry) =>
        trim(entry.name) &&
        trim(entry.issuer) &&
        validMonth(entry.issueDate) &&
        (entry.doesNotExpire || validMonth(entry.expiryDate)) &&
        (entry.doesNotExpire ||
          !entry.issueDate ||
          !entry.expiryDate ||
          entry.expiryDate >= entry.issueDate),
    ),
    awards: content.awards.filter((entry) => trim(entry.title) && validMonth(entry.date)),
    achievements: content.achievements.filter((entry) => trim(entry.text)),
    languages: content.languages.filter((entry) => trim(entry.name)),
    customSections: content.customSections
      .map((section) => ({
        ...section,
        heading: trim(section.heading),
        items: section.items.map(trim).filter(Boolean),
      }))
      .filter((section) => section.heading && section.items.length),
  };
}

function renderContactSidebar(contacts: ResumeContent['contacts']): string {
  const parts: string[] = [];
  if (contacts.email) parts.push(`<p>${renderContactLink('email', contacts.email)}</p>`);
  if (contacts.phone) parts.push(`<p>${renderContactLink('tel', contacts.phone)}</p>`);
  if (contacts.location) parts.push(`<p>${escapeHtml(contacts.location)}</p>`);
  if (contacts.linkedinUrl)
    parts.push(`<p><a href="${safeUrl(contacts.linkedinUrl)}">LinkedIn</a></p>`);
  if (contacts.githubUrl) parts.push(`<p><a href="${safeUrl(contacts.githubUrl)}">GitHub</a></p>`);
  if (contacts.portfolioUrl)
    parts.push(`<p><a href="${safeUrl(contacts.portfolioUrl)}">Portfolio</a></p>`);
  return parts.join('\n');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeUrl(url: string): string {
  if (/^(javascript|data|vbscript):/i.test(url)) {
    return '';
  }
  if (url.startsWith('mailto:') || url.startsWith('tel:')) {
    return url;
  }
  try {
    const parsed = new URL(url, 'https://example.com');
    return parsed.href;
  } catch {
    return '';
  }
}

function renderContactLink(type: string, value: string): string {
  if (/^(javascript|data|vbscript):/i.test(value)) {
    return escapeHtml(value);
  }
  if (type === 'email') {
    const safe = `mailto:${value}`;
    return `<a href="${safe}">${escapeHtml(value)}</a>`;
  }
  if (type === 'tel') {
    const safe = `tel:${value.replace(/[^0-9+#]/g, '')}`;
    return `<a href="${safe}">${escapeHtml(value)}</a>`;
  }
  const safe = safeUrl(value);
  if (!safe) return escapeHtml(value);
  return `<a href="${safe}">${escapeHtml(value)}</a>`;
}

function extractLinkedInSlug(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] || 'LinkedIn';
  } catch {
    return 'LinkedIn';
  }
}

function extractGithubSlug(url: string): string {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split('/').filter(Boolean);
    return parts.length >= 2 ? parts[1] : 'GitHub';
  } catch {
    return 'GitHub';
  }
}

function formatDateRange(start: string, end: string, current: boolean): string {
  const startFormatted = formatDate(start);
  if (current) {
    return `${startFormatted} &ndash; Present`;
  }
  if (end) {
    return `${startFormatted} &ndash; ${formatDate(end)}`;
  }
  return startFormatted;
}

function formatDate(dateStr: string): string {
  if (!dateStr) {
    return '';
  }
  const parts = dateStr.split('-');
  if (parts.length < 2) {
    return dateStr;
  }
  const month = MONTHS[parseInt(parts[1], 10) - 1];
  const year = parts[0];
  if (month) {
    return `${month} ${year}`;
  }
  return year;
}

function getThemeVariables(theme: ColorThemeId): {
  text: string;
  bg: string;
  primary: string;
  border: string;
  custom: string;
} {
  switch (theme) {
    case ColorThemeId.Navy:
      return {
        text: '#1f2937',
        bg: '#ffffff',
        primary: '#0a1c4c',
        border: '#d1d5db',
        custom: 'body { --on-primary: #ffffff; }',
      };
    case ColorThemeId.Charcoal:
      return {
        text: '#e2e8f0',
        bg: '#1e293b',
        primary: '#94a3b8',
        border: '#334155',
        custom:
          'body { --on-primary: #0f172a; } body { color: #e2e8f0; } .section__title { border-bottom-color: #334155; } a { color: #94a3b8; } .header-title { color: #e2e8f0; }',
      };
    case ColorThemeId.Teal:
      return {
        text: '#1f2937',
        bg: '#ffffff',
        primary: '#0d9488',
        border: '#d1d5db',
        custom:
          'body { --on-primary: #ffffff; } .section__title { border-bottom-color: #0d9488; } a { color: #0d9488; }',
      };
    case ColorThemeId.Burgundy:
      return {
        text: '#1f2937',
        bg: '#ffffff',
        primary: '#7f1d1d',
        border: '#e8c4c4',
        custom:
          'body { --on-primary: #ffffff; } .section__title { border-bottom-color: #7f1d1d; } a { color: #7f1d1d; } .header-title { color: #1f2937; }',
      };
    default:
      return getThemeVariables(ColorThemeId.Navy);
  }
}

/**
 * Self-contained page-splitting script embedded in every generated resume.
 * Reflows the single `.resume-page` into a stacked set of `.resume-page`
 * elements that exactly fit A4. Sections split only at atomic boundaries
 * (entries, skill rows, cards); headings stay glued to the first content
 * block of their section. Exposes `window.__paginationReport` so CLI scripts
 * can assert there are no overflowed pages, orphaned headings, clipped text
 * blocks, or missing sections.
 */
const PAGINATION_SCRIPT = `
<script>
(function () {
  var PX_PER_MM = 96 / 25.4;
  var PAGE_H = 297 * PX_PER_MM;
  var TOL = 6;

  var root = document.querySelector('.resume-page');
  if (!root || document.getElementById('resume-pages')) { return; }

  var cs = window.getComputedStyle(root);
  var padTop = parseFloat(cs.paddingTop) || 0;
  var padBottom = parseFloat(cs.paddingBottom) || 0;
  var borderTop = parseFloat(cs.borderTopWidth) || 0;
  var borderBottom = parseFloat(cs.borderBottomWidth) || 0;
  var innerH = PAGE_H - padTop - padBottom - borderTop - borderBottom;
  var shell = root.getAttribute('data-shell') || 'single';

  function childrenOf(el) {
    var out = [];
    for (var i = 0; i < el.children.length; i += 1) { out.push(el.children[i]); }
    return out;
  }

  function marginOf(el, prop) {
    return parseFloat(window.getComputedStyle(el)[prop]) || 0;
  }

  function sectionUnits(section, wrapperClass, wrapperPad) {
    var kids = childrenOf(section);
    var h2 = null;
    var content = [];
    for (var i = 0; i < kids.length; i += 1) {
      if (kids[i].tagName === 'H2' && !h2) { h2 = kids[i]; } else { content.push(kids[i]); }
    }
    if (!content.length) { return []; }
    var sectionMargin = marginOf(section, 'marginBottom');
    if (content.length === 1) {
      return [{ whole: section, wrapper: wrapperClass || null, wrapperPad: wrapperPad || 0 }];
    }
    var units = [];
    if (h2) {
      units.push({
        headingHtml: h2.outerHTML,
        headingEl: h2,
        headingTop: marginOf(h2, 'marginTop'),
        headingBottom: marginOf(h2, 'marginBottom'),
        cls: section.className,
        sectionMargin: sectionMargin,
        wrapper: wrapperClass || null,
        wrapperPad: wrapperPad || 0
      });
    }
    for (var j = 0; j < content.length; j += 1) {
      units.push({
        content: content[j],
        cls: section.className,
        sectionMargin: sectionMargin,
        wrapper: wrapperClass || null,
        wrapperPad: wrapperPad || 0
      });
    }
    return units;
  }

  function flowUnits(flowEl) {
    var units = [];
    var kids = childrenOf(flowEl);
    for (var i = 0; i < kids.length; i += 1) {
      var child = kids[i];
      var cls = typeof child.className === 'string' ? child.className : '';
      var wrapperClass = null;
      var wrapperPad = 0;
      if (child.tagName === 'DIV' && cls.indexOf('card') >= 0) {
        var innerSection = child.querySelector(':scope > .section');
        if (innerSection) {
          var ws = window.getComputedStyle(child);
          wrapperPad =
            (parseFloat(ws.paddingTop) || 0) + (parseFloat(ws.paddingBottom) || 0);
          wrapperClass = child.className;
          child = innerSection;
          cls = typeof child.className === 'string' ? child.className : '';
        }
      }
      if (child.tagName === 'DIV' && cls.indexOf('section') >= 0) {
        var su = sectionUnits(child, wrapperClass, wrapperPad);
        if (su.length === 1 && su[0].whole) {
          units.push({ whole: wrapperClass ? child.parentNode : su[0].whole });
        } else {
          for (var k = 0; k < su.length; k += 1) { units.push(su[k]); }
        }
      } else {
        units.push({ whole: child });
      }
    }
    return units;
  }

  function collapseTop(el) {
    var fc = el.children[0];
    if (fc && fc.tagName === 'H2') { return marginOf(fc, 'marginTop'); }
    return marginOf(el, 'marginTop');
  }

  function collapseBottom(el) {
    var mb = marginOf(el, 'marginBottom');
    var lc = el.children[el.children.length - 1];
    if (lc) {
      var lmb = marginOf(lc, 'marginBottom');
      if (lmb > mb) { mb = lmb; }
    }
    return mb;
  }

  function pageBlocks(flowEl) {
    var units = flowUnits(flowEl);
    var blocks = [];
    for (var i = 0; i < units.length; i += 1) {
      var u = units[i];
      if (u.headingHtml) {
        var j = i + 1;
        if (j < units.length && units[j].content) {
          blocks.push({
            headingHtml: u.headingHtml,
            content: units[j].content,
            cls: u.cls,
            wrapper: u.wrapper
          });
          i = j;
        }
      } else if (u.content) {
        blocks.push({
          content: u.content,
          cls: u.cls,
          wrapper: u.wrapper
        });
      } else if (u.whole) {
        blocks.push({ whole: u.whole });
      }
    }
    return blocks;
  }

  function renderBlock(b) {
    var fragment;
    if (b.whole) { return b.whole.outerHTML; }
    if (b.headingHtml) {
      fragment = '<div class="' + b.cls + '">' + b.headingHtml + b.content.outerHTML + '</div>';
    } else {
      fragment = '<div class="' + b.cls + '">' + b.content.outerHTML + '</div>';
    }
    if (b.wrapper) {
      return '<div class="' + b.wrapper + '">' + fragment + '</div>';
    }
    return fragment;
  }

  function blocksToHtml(blocks) {
    var s = '';
    for (var i = 0; i < blocks.length; i += 1) { s += renderBlock(blocks[i]); }
    return s;
  }

  function placeBlocks(blocks, budget, measurer) {
    var pages = [];
    var current = [];
    var curHtml = '';
    for (var i = 0; i < blocks.length; i += 1) {
      var html = renderBlock(blocks[i]);
      var h = measurer(curHtml + html);
      if (current.length && h > budget - TOL) {
        pages.push(current);
        current = [];
        curHtml = '';
        budget = innerH;
        h = measurer(html);
      }
      current.push(blocks[i]);
      curHtml += html;
    }
    if (current.length) { pages.push(current); }
    return pages;
  }

  function detectShell(pageEl) {
    var result = { shell: 'single', grid: null, flows: [], headerEl: null };
    var s = pageEl.getAttribute('data-shell') || 'single';
    if (s === 'sidebar') {
      var grid = pageEl.querySelector('.layout-sidebar');
      var sb = grid && grid.querySelector('.sidebar');
      var mc = grid && grid.querySelector('.main-content');
      if (sb && mc) {
        result.shell = 'sidebar'; result.grid = grid; result.flows = [sb, mc];
      }
    } else if (s === 'split') {
      var grid2 = pageEl.querySelector('.layout-modern-split');
      var sm = grid2 && grid2.querySelector('.split-main');
      var sa = grid2 && grid2.querySelector('.split-accent');
      if (sm && sa) {
        result.shell = 'split'; result.grid = grid2; result.flows = [sm, sa];
        var hd = grid2.previousElementSibling;
        if (hd && hd.tagName === 'DIV') { result.headerEl = hd; }
      }
    } else if (s === 'cards') {
      var grid3 = pageEl.querySelector('.cards-grid');
      var colList = [];
      if (grid3) {
        var cols = childrenOf(grid3);
        for (var c = 0; c < cols.length; c += 1) {
          if (cols[c].className && cols[c].className.indexOf('cards-col') >= 0) { colList.push(cols[c]); }
        }
      }
      if (colList.length) {
        result.shell = 'cards'; result.grid = grid3; result.flows = colList;
        var hd2 = grid3.previousElementSibling;
        if (hd2 && hd2.tagName === 'DIV') { result.headerEl = hd2; }
      }
    } else {
      result.shell = 'single'; result.grid = null; result.flows = [pageEl];
    }
    if (result.shell === 'single' && !result.flows.length) { result.flows = [pageEl]; }
    return result;
  }

  var layout = detectShell(root);
  shell = layout.shell;
  var grid = layout.grid;
  var headerEl = layout.headerEl;

  var hiddenPage = root.cloneNode(true);
  hiddenPage.style.position = 'absolute';
  hiddenPage.style.visibility = 'hidden';
  hiddenPage.style.top = '0px';
  hiddenPage.style.left = '0px';
  document.body.appendChild(hiddenPage);
  var hiddenLayout = detectShell(hiddenPage);

  function flowMeasurer(hiddenFlow) {
    return function (html) {
      hiddenFlow.innerHTML = html;
      var last = hiddenFlow.lastElementChild;
      if (!last) { return 0; }
      var fcs = window.getComputedStyle(hiddenFlow);
      var top = hiddenFlow.getBoundingClientRect().top +
        (parseFloat(fcs.borderTopWidth) || 0) + (parseFloat(fcs.paddingTop) || 0);
      var lastMargin = (parseFloat(window.getComputedStyle(last).marginBottom) || 0);
      return last.getBoundingClientRect().bottom - top + lastMargin;
    };
  }

  var sourceHeadings = {};
  var hs = root.querySelectorAll('h2, .section__title');
  for (var hIdx = 0; hIdx < hs.length; hIdx += 1) {
    var t = hs[hIdx].textContent.trim();
    if (t) { sourceHeadings[t] = (sourceHeadings[t] || 0) + 1; }
  }

  var firstBudget = innerH;
  if (headerEl) {
    var headerH = headerEl.offsetHeight + collapseTop(headerEl) + collapseBottom(headerEl);
    if (headerH >= innerH - TOL) {
      firstBudget = innerH;
    } else {
      firstBudget = Math.max(innerH - headerH - TOL, 120);
    }
  }

  var flowPageLists = [];
  for (var f = 0; f < layout.flows.length; f += 1) {
    var flowVPad = 0;
    if (layout.shell !== 'single') {
      var fcs2 = window.getComputedStyle(layout.flows[f]);
      flowVPad =
        (parseFloat(fcs2.paddingTop) || 0) + (parseFloat(fcs2.paddingBottom) || 0) +
        (parseFloat(fcs2.borderTopWidth) || 0) + (parseFloat(fcs2.borderBottomWidth) || 0);
    }
    flowPageLists.push(placeBlocks(
      pageBlocks(layout.flows[f]),
      Math.max(firstBudget - flowVPad, 80),
      flowMeasurer(hiddenLayout.flows[f])
    ));
  }

  var pageCount = 1;
  for (var pf = 0; pf < flowPageLists.length; pf += 1) {
    if (flowPageLists[pf].length > pageCount) { pageCount = flowPageLists[pf].length; }
  }

  var pageHtmls = [];
  for (var p = 0; p < pageCount; p += 1) {
    var body = '';
    if (shell === 'sidebar') {
      body = '<div class="layout-sidebar"><div class="sidebar">' + blocksToHtml(flowPageLists[0][p] || []) + '</div><div class="main-content">' + blocksToHtml(flowPageLists[1][p] || []) + '</div></div>';
    } else if (shell === 'split') {
      body = '<div class="' + grid.className + '"><div class="split-main">' + blocksToHtml(flowPageLists[0][p] || []) + '</div><div class="split-accent">' + blocksToHtml(flowPageLists[1][p] || []) + '</div></div>';
      if (p === 0 && headerEl) { body = headerEl.outerHTML + body; }
    } else if (shell === 'cards') {
      body = '<div class="' + grid.className + '"><div class="cards-col">' + blocksToHtml(flowPageLists[0][p] || []) + '</div><div class="cards-col">' + blocksToHtml(flowPageLists[1][p] || []) + '</div></div>';
      if (p === 0 && headerEl) { body = headerEl.outerHTML + body; }
    } else {
      body = blocksToHtml(flowPageLists[0][p] || []);
    }
    var mb = p < pageCount - 1 ? ' style="margin-bottom: 6mm;"' : '';
    pageHtmls.push('<div class="resume-page"' + mb + '>' + body + '</div>');
  }

  var stack = document.createElement('div');
  stack.id = 'resume-pages';
  stack.innerHTML = pageHtmls.join('');
  root.parentNode.replaceChild(stack, root);
  if (hiddenPage.parentNode) { hiddenPage.parentNode.removeChild(hiddenPage); }

  document.documentElement.style.overflow = 'visible';
  document.body.style.overflow = 'visible';

  var report = { overflowingPages: 0, orphanedHeadings: 0, clippedBlocks: 0, missingSections: 0, pageCount: pageCount };
  var pageEls = childrenOf(stack);

  function blockContainers(pageEl) {
    var containers = [];
    if (shell === 'sidebar') {
      var sBox = pageEl.querySelector('.layout-sidebar .sidebar');
      var mBox = pageEl.querySelector('.layout-sidebar .main-content');
      if (sBox) { containers.push(sBox); }
      if (mBox) { containers.push(mBox); }
    } else if (shell === 'split') {
      var smBox = pageEl.querySelector('.split-main');
      var saBox = pageEl.querySelector('.split-accent');
      if (smBox) { containers.push(smBox); }
      if (saBox) { containers.push(saBox); }
    } else if (shell === 'cards') {
      var colBoxes = pageEl.querySelectorAll('.cards-col');
      for (var q = 0; q < colBoxes.length; q += 1) { containers.push(colBoxes[q]); }
    } else {
      containers.push(pageEl);
    }
    return containers;
  }

  function isHeading(el) {
    var cls = typeof el.className === 'string' ? el.className : '';
    return el.tagName === 'H2' || cls.indexOf('section__title') >= 0;
  }

  for (var i = 0; i < pageEls.length; i += 1) {
    var pageEl = pageEls[i];
    if (pageEl.offsetHeight > PAGE_H + 3) { report.overflowingPages += 1; }
    var containers = blockContainers(pageEl);
    var pr = pageEl.getBoundingClientRect();
    for (var c2 = 0; c2 < containers.length; c2 += 1) {
      var cont = containers[c2];
      var kids = childrenOf(cont);
      if (kids.length && isHeading(kids[kids.length - 1])) { report.orphanedHeadings += 1; }
      for (var k2 = 0; k2 < kids.length; k2 += 1) {
        var r = kids[k2].getBoundingClientRect();
        if (r.bottom > pr.bottom + 1 || r.top < pr.top - 1) { report.clippedBlocks += 1; }
      }
    }
  }

  var outHeadings = {};
  var ohs = stack.querySelectorAll('h2, .section__title');
  for (var o = 0; o < ohs.length; o += 1) {
    var ot = ohs[o].textContent.trim();
    if (ot) { outHeadings[ot] = (outHeadings[ot] || 0) + 1; }
  }
  for (var key in sourceHeadings) {
    if (Object.prototype.hasOwnProperty.call(sourceHeadings, key)) {
      if (outHeadings[key] !== 1) { report.missingSections += 1; }
    }
  }

  window.__paginationReport = report;
})();
</script>
`;
