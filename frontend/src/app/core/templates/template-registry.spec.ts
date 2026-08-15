import { TestBed } from '@angular/core/testing';
import { TemplateRegistry } from './template-registry';
import {
  LayoutFamilyId,
  ColorThemeId,
  TemplateCategory,
} from '../models/template-definition.model';
import { LAYOUT_ORDER, THEMES, buildDefinitions } from './template-catalogue';

describe('TemplateRegistry', () => {
  let registry: TemplateRegistry;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [TemplateRegistry] });
    registry = TestBed.inject(TemplateRegistry);
  });

  it('lists all 100 template definitions', () => {
    const list = registry.list();
    expect(list.length).toBe(100);
  });

  it('returns a definition by id', () => {
    const def = registry.get('t-classic-ats-navy');
    expect(def.id).toBe('t-classic-ats-navy');
    expect(def.name).toBe('Classic ATS — Navy');
  });

  it('returns fallback for unknown id', () => {
    const def = registry.get('t-unknown');
    expect(def.id).toBe('t-classic-ats-navy');
  });

  it('returns the fallback id', () => {
    expect(registry.getFallbackId()).toBe('t-classic-ats-navy');
  });

  it('all definitions have valid layout family and color theme', () => {
    registry.list().forEach((def) => {
      expect(Object.values(LayoutFamilyId)).toContain(def.layoutFamily);
      expect(Object.values(ColorThemeId)).toContain(def.colorTheme);
    });
  });

  it('all definitions have a valid category', () => {
    registry.list().forEach((def) => {
      expect(Object.values(TemplateCategory)).toContain(def.category);
    });
  });

  it('all definitions have typography presets', () => {
    registry.list().forEach((def) => {
      expect(def.typography.fontFamily).toBeTruthy();
      expect(def.typography.fontSize).toBeGreaterThan(0);
      expect(def.typography.lineHeight).toBeGreaterThan(0);
      expect(def.typography.headingWeight).toBeGreaterThan(0);
      expect(def.typography.bodyWeight).toBeGreaterThan(0);
    });
  });

  it('all 25 layout families are represented', () => {
    const layouts = new Set(registry.list().map((d) => d.layoutFamily));
    expect(layouts.size).toBe(25);
    expect(LAYOUT_ORDER.length).toBe(25);
    LAYOUT_ORDER.forEach((slug) => expect(layouts).toContain(slug));
  });

  it('all 4 color themes are represented', () => {
    const themes = new Set(registry.list().map((d) => d.colorTheme));
    expect(themes.size).toBe(4);
    THEMES.forEach((theme) => expect(themes).toContain(theme));
  });

  it('each layout family has exactly 4 theme variants', () => {
    const byLayout = new Map<LayoutFamilyId, number>();
    registry.list().forEach((d) => {
      byLayout.set(d.layoutFamily, (byLayout.get(d.layoutFamily) ?? 0) + 1);
    });
    expect(byLayout.size).toBe(25);
    byLayout.forEach((count) => expect(count).toBe(4));
  });

  it('each color theme has exactly 25 layout variants', () => {
    const byTheme = new Map<ColorThemeId, number>();
    registry.list().forEach((d) => {
      byTheme.set(d.colorTheme, (byTheme.get(d.colorTheme) ?? 0) + 1);
    });
    byTheme.forEach((count) => expect(count).toBe(25));
  });

  it('all definitions have unique ids using the canonical t-{layout}-{theme} format', () => {
    const ids = registry.list().map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach((id) => {
      expect(id).toMatch(/^t-[a-z0-9-]+-(navy|charcoal|teal|burgundy)$/);
    });
  });

  it('every family has all four themes present (no missing theme variants)', () => {
    LAYOUT_ORDER.forEach((slug) => {
      THEMES.forEach((theme) => {
        const def = registry.getByLayoutAndTheme(slug, theme);
        expect(def).toBeDefined();
        expect(def!.id).toBe(`t-${slug}-${theme}`);
      });
    });
  });

  it('getByLayoutAndTheme returns matching definition', () => {
    const def = registry.getByLayoutAndTheme(LayoutFamilyId.ClassicAts, ColorThemeId.Teal);
    expect(def).toBeDefined();
    expect(def!.layoutFamily).toBe(LayoutFamilyId.ClassicAts);
    expect(def!.colorTheme).toBe(ColorThemeId.Teal);
  });

  it('getByLayoutAndTheme returns undefined for missing combo', () => {
    const def = registry.getByLayoutAndTheme('nonexistent' as LayoutFamilyId, ColorThemeId.Navy);
    expect(def).toBeUndefined();
  });

  it('columnCount is 1 or 2 across all definitions', () => {
    registry.list().forEach((def) => {
      expect([1, 2]).toContain(def.columnCount);
    });
  });

  it('headerAlignment is left, center, or right', () => {
    registry.list().forEach((def) => {
      expect(['left', 'center', 'right']).toContain(def.headerAlignment);
    });
  });

  it('badges: ATS & Formal designs are ATS-friendly; the rest are visual', () => {
    registry.list().forEach((def) => {
      if (def.category === TemplateCategory.AtsFormal) {
        expect(def.isAtsFriendly).toBe(true);
        expect(def.isVisual).toBe(false);
      } else {
        expect(def.isVisual).toBe(true);
        expect(def.isAtsFriendly).toBe(false);
      }
    });
  });

  it('all definitions have isAtsFriendly or isVisual set', () => {
    registry.list().forEach((def) => {
      expect(def.isAtsFriendly || def.isVisual).toBe(true);
    });
  });

  it('buildDefinitions produces 100 definitions with no duplicates', () => {
    const defs = buildDefinitions();
    expect(defs.length).toBe(100);
    const ids = defs.map((d) => d.id);
    expect(new Set(ids).size).toBe(100);
  });

  it('idFor builds canonical ids', () => {
    expect(registry.idFor(LayoutFamilyId.SwissMinimal, ColorThemeId.Burgundy)).toBe(
      't-swiss-minimal-burgundy',
    );
  });

  it('layoutOrder returns the canonical 25-family order', () => {
    expect(registry.layoutOrder().length).toBe(25);
    expect(registry.layoutOrder()[0]).toBe(LayoutFamilyId.ClassicAts);
    expect(registry.layoutOrder()[24]).toBe(LayoutFamilyId.CreativePortfolio);
  });
});
