import { ColorThemeId, TemplateCategory } from '../../core/models/template-definition.model';

export type LayoutCategoryFilter = 'all' | TemplateCategory;

export interface TemplateCard {
  layoutFamily: string;
  name: string;
  description: string;
  category: TemplateCategory;
  badge: 'ats' | 'visual';
  selectedTheme: ColorThemeId;
}

export interface TemplateGalleryFilters {
  category: LayoutCategoryFilter;
  search: string;
}

export const THEME_SWATCHES: { id: ColorThemeId; label: string; color: string }[] = [
  { id: ColorThemeId.Navy, label: 'Navy', color: '#0a1c4c' },
  { id: ColorThemeId.Charcoal, label: 'Charcoal', color: '#94a3b8' },
  { id: ColorThemeId.Teal, label: 'Teal', color: '#0d9488' },
  { id: ColorThemeId.Burgundy, label: 'Burgundy', color: '#7f1d1d' },
];
