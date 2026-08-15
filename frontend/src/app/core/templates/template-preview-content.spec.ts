import { TestBed } from '@angular/core/testing';
import { TemplateRegistry } from './template-registry';
import { buildTemplatePreviewHtml, templatePreviewSampleContent } from './template-preview-content';
import { renderResumeHtml } from './resume-template-renderer';
import { LayoutFamilyId, ColorThemeId } from '../models/template-definition.model';

function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&mdash;/g, '—')
    .replace(/&middot;/g, '·')
    .replace(/\s+/g, ' ')
    .trim();
}

function headings(html: string): string[] {
  return [...html.matchAll(/<h2>([^<]*)<\/h2>/g)].map((m) => m[1].replace(/&amp;/g, '&'));
}

describe('templatePreviewSampleContent (shared canonical preview fixture)', () => {
  let registry: TemplateRegistry;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    registry = TestBed.inject(TemplateRegistry);
  });

  it('is the canonical content used to build the preview HTML', () => {
    const def = registry.get('t-academic-cv-navy');
    expect(buildTemplatePreviewHtml(def)).toBe(
      renderResumeHtml(templatePreviewSampleContent, def, {}),
    );
  });

  it('returns identical normalized HTML for the same template ID and theme', () => {
    const a = registry.getByLayoutAndTheme(LayoutFamilyId.AcademicCv, ColorThemeId.Navy)!;
    const b = registry.get('t-academic-cv-navy');
    const htmlA = buildTemplatePreviewHtml(a);
    const htmlB = buildTemplatePreviewHtml(b);
    expect(htmlA).toBe(htmlB);
  });

  it('changes the preview consistently when the theme changes', () => {
    const navy = registry.get('t-academic-cv-navy');
    const burgundy = registry.getByLayoutAndTheme(
      LayoutFamilyId.AcademicCv,
      ColorThemeId.Burgundy,
    )!;
    const navyHtml = buildTemplatePreviewHtml(navy);
    const burgundyHtml = buildTemplatePreviewHtml(burgundy);

    expect(burgundyHtml).not.toBe(navyHtml);
    // Theme CSS variables switch (Navy primary → Burgundy primary).
    expect(navyHtml).toContain('#0a1c4c');
    expect(burgundyHtml).toContain('#7f1d1d');
    // The canonical visible content stays the same on every theme.
    expect(visibleText(burgundyHtml)).toBe(visibleText(navyHtml));
  });

  it('renders the Academic CV sections in the canonical layout order', () => {
    const html = buildTemplatePreviewHtml(registry.get('t-academic-cv-navy'));
    expect(headings(html)).toEqual([
      'Education',
      'Experience',
      'Projects',
      'Awards & Achievements',
      'Certifications',
      'Languages',
      'Open Source',
      'Summary',
    ]);
  });

  it('renders the full canonical visible preview text', () => {
    const html = buildTemplatePreviewHtml(registry.get('t-academic-cv-navy'));
    const text = visibleText(html);
    for (const expected of [
      'Jane Doe',
      'Senior Software Engineer',
      'University of Washington',
      'Acme Corp',
      'Enterprise Dashboard',
      'AWS Solutions Architect',
      'Employee of the Year',
      'English',
      'Spanish',
      'Open Source',
      'Contributed to Angular CLI.',
    ]) {
      expect(text).toContain(expected);
    }
  });
});
