import { Injectable } from '@angular/core';
import {
  TemplateDefinition,
  LayoutFamilyId,
  ColorThemeId,
} from '../models/template-definition.model';
import {
  buildDefinitions,
  definitionId,
  LAYOUT_META,
  LAYOUT_ORDER,
  THEMES,
} from './template-catalogue';

const DEFAULT_TEMPLATE_ID = 't-classic-ats-navy';

const definitions: TemplateDefinition[] = buildDefinitions();

@Injectable({ providedIn: 'root' })
export class TemplateRegistry {
  private readonly byId = new Map<string, TemplateDefinition>(definitions.map((d) => [d.id, d]));

  list(): readonly TemplateDefinition[] {
    return definitions;
  }

  get(id: string | undefined | null): TemplateDefinition {
    return this.byId.get(id ?? '') ?? this.byId.get(DEFAULT_TEMPLATE_ID)!;
  }

  getByLayoutAndTheme(
    layoutFamily: LayoutFamilyId,
    colorTheme: ColorThemeId,
  ): TemplateDefinition | undefined {
    return definitions.find((d) => d.layoutFamily === layoutFamily && d.colorTheme === colorTheme);
  }

  getFallbackId(): string {
    return DEFAULT_TEMPLATE_ID;
  }

  layoutMeta(layoutFamily: LayoutFamilyId): (typeof LAYOUT_META)[LayoutFamilyId] {
    return LAYOUT_META[layoutFamily];
  }

  /** Canonical order of layout families (one card per family in the gallery). */
  layoutOrder(): readonly LayoutFamilyId[] {
    return LAYOUT_ORDER;
  }

  themes(): readonly ColorThemeId[] {
    return THEMES;
  }

  idFor(slug: LayoutFamilyId, theme: ColorThemeId): string {
    return definitionId(slug, theme);
  }
}
