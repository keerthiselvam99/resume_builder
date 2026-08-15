import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AppButton } from '../../shared/components/app-button.component';
import { TemplateCard, TemplateGalleryFilters, THEME_SWATCHES } from './gallery.model';
import { TemplateRegistry } from '../../core/templates/template-registry';
import { RESUME_REPOSITORY } from '../../core/repositories/repository.providers';
import { ColorThemeId, TemplateCategory } from '../../core/models/template-definition.model';
import { CATEGORY_ORDER } from '../../core/templates/template-catalogue';

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  [TemplateCategory.AtsFormal]: 'ATS & Formal',
  [TemplateCategory.Modern]: 'Modern',
  [TemplateCategory.Technical]: 'Technical',
  [TemplateCategory.Executive]: 'Executive',
  [TemplateCategory.CreativeMinimal]: 'Creative & Minimal',
};

@Component({
  selector: 'app-gallery',
  template: `
    <div class="container">
      <div class="head">
        <div>
          @if (changeMode()) {
            <a class="back-link" [routerLink]="returnUrl() ?? '/resumes'">← Back to editor</a>
          }
          <h1>{{ heading() }}</h1>
          <p class="text-muted">{{ subtitle() }}</p>
        </div>
      </div>

      <div class="filters">
        <label class="filter-label" for="filter-category">Category</label>
        <select
          id="filter-category"
          class="filter-select"
          [value]="filters().category"
          (change)="onCategoryChange($event)"
        >
          <option value="all">All categories</option>
          @for (category of categories; track category) {
            <option [value]="category">{{ CATEGORY_LABELS[category] }}</option>
          }
        </select>

        <label class="filter-label" for="filter-search">Search</label>
        <input
          id="filter-search"
          class="filter-input"
          type="search"
          placeholder="Filter by name…"
          [value]="filters().search"
          (input)="onSearch($event)"
        />
      </div>

      @if (loading()) {
        <div class="grid">
          @for (i of [0, 1, 2, 3, 4]; track i) {
            <article class="card card--loading">
              <div class="card__preview preview-skeleton"></div>
              <div class="card__body">
                <div class="skeleton skeleton--title"></div>
                <div class="skeleton skeleton--desc"></div>
                <div class="skeleton skeleton--desc skeleton--short"></div>
              </div>
            </article>
          }
        </div>
      } @else if (errorMessage()) {
        <div class="state state--error" role="alert">{{ errorMessage() }}</div>
      } @else if (filteredCards().length === 0) {
        <div class="state">
          <h2>No templates match your filters</h2>
          <p class="text-muted">Try adjusting the category or search terms.</p>
        </div>
      } @else {
        <div class="grid">
          @for (card of filteredCards(); track card.layoutFamily) {
            <article class="card">
              <div class="card__preview" [class.card__preview--error]="cardImageError(card)">
                @if (cardImageError(card)) {
                  <div class="card__error">Thumbnail unavailable</div>
                } @else {
                  <img
                    [src]="previewUrl(card)"
                    [alt]="card.name + ' thumbnail'"
                    class="card__image"
                    loading="lazy"
                    (error)="onImageError(card)"
                  />
                }
              </div>
              <div class="card__body">
                <h2 class="card__title">{{ card.name }}</h2>
                <p class="card__desc text-muted">{{ card.description }}</p>
                <div class="card__badges">
                  @if (card.badge === 'ats') {
                    <span class="badge badge--ats">ATS-friendly</span>
                  }
                  @if (card.badge === 'visual') {
                    <span class="badge badge--visual">Visual</span>
                  }
                  <span class="badge badge--layout">{{ categoryLabel(card.category) }}</span>
                  <span class="badge badge--theme">4 themes</span>
                </div>
                <div
                  class="card__swatches"
                  role="group"
                  [attr.aria-label]="'Preview ' + card.name + ' in each theme'"
                >
                  @for (swatch of themeSwatches; track swatch.id) {
                    <button
                      type="button"
                      class="swatch"
                      [class.swatch--active]="selectedSwatch(card, swatch.id)"
                      [style.background]="swatch.color"
                      [attr.title]="'Preview ' + card.name + ' in ' + swatch.label"
                      [attr.aria-label]="'Preview ' + card.name + ' in ' + swatch.label"
                      [attr.aria-pressed]="selectedSwatch(card, swatch.id)"
                      (click)="selectSwatch(card, swatch.id)"
                    ></button>
                  }
                </div>
              </div>
              <div class="card__actions">
                <app-button variant="secondary" (click)="previewTemplate(card)">
                  Preview &amp; customise
                </app-button>
              </div>
            </article>
          }
        </div>
      }
    </div>
  `,
  styles: `
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-4);
      margin: var(--space-8) 0 var(--space-6);
      flex-wrap: wrap;
    }
    .back-link {
      display: inline-block;
      color: var(--color-primary);
      text-decoration: none;
      font-weight: 600;
      font-size: var(--fs-sm);
      cursor: pointer;
      margin-bottom: var(--space-2);
      &:hover {
        text-decoration: underline;
      }
    }
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3);
      align-items: center;
      margin-bottom: var(--space-6);
      padding: var(--space-4);
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
    }
    .filter-label {
      font-size: var(--fs-sm);
      font-weight: 600;
      color: var(--color-text-muted);
    }
    .filter-select,
    .filter-input {
      padding: 0.4rem 0.75rem;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: var(--color-surface);
      color: var(--color-text);
      font-size: var(--fs-sm);
      font-family: inherit;
      &:focus {
        outline: 2px solid var(--color-primary);
        outline-offset: 1px;
      }
    }
    .filter-input {
      min-width: 180px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: var(--space-4);
    }
    .card {
      background: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-sm);
      display: flex;
      flex-direction: column;
      gap: var(--space-3);
      overflow: hidden;
    }
    .card__preview {
      aspect-ratio: 3 / 4;
      background: var(--color-surface-alt);
      overflow: hidden;
      &--error {
        align-items: center;
        justify-content: center;
      }
    }
    .card__image {
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top;
      display: block;
    }
    .card__error {
      color: var(--color-text-muted);
      font-size: var(--fs-sm);
    }
    .preview-skeleton {
      background: linear-gradient(
        90deg,
        var(--color-surface-alt) 25%,
        var(--color-surface) 50%,
        var(--color-surface-alt) 75%
      );
      background-size: 200% 100%;
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0% {
        background-position: 200% 0;
      }
      100% {
        background-position: -200% 0;
      }
    }
    .skeleton--title {
      height: 1.25rem;
      width: 60%;
      margin-bottom: 0.25rem;
    }
    .skeleton--desc {
      height: 0.875rem;
      width: 90%;
      margin-bottom: 0.25rem;
    }
    .skeleton--short {
      width: 70%;
    }
    .card__body {
      padding: 0 var(--space-4);
    }
    .card__title {
      font-size: var(--fs-lg);
      margin: 0 0 var(--space-1);
    }
    .card__desc {
      font-size: var(--fs-sm);
      margin: 0 0 var(--space-2);
    }
    .card__badges {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-1);
    }
    .badge {
      border-radius: 999px;
      padding: 0.1rem 0.5rem;
      font-size: var(--fs-xs);
      font-weight: 700;
    }
    .badge--ats {
      background: var(--color-success-soft);
      color: var(--color-success);
    }
    .badge--visual {
      background: var(--color-accent-soft);
      color: var(--color-accent);
    }
    .badge--layout,
    .badge--theme {
      background: var(--color-primary-soft);
      color: var(--color-primary);
    }
    .card__swatches {
      display: flex;
      align-items: center;
      gap: var(--space-2);
      padding: var(--space-2) var(--space-4) 0;
    }
    .swatch {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: 2px solid transparent;
      padding: 0;
      display: inline-block;
      cursor: pointer;
      transition:
        transform 0.15s ease,
        box-shadow 0.15s ease,
        border-color 0.15s ease;
      &:hover {
        transform: scale(1.15);
      }
      &:focus-visible {
        outline: 2px solid var(--color-primary);
        outline-offset: 2px;
      }
      &--active {
        border-color: var(--color-surface);
        box-shadow:
          0 0 0 2px var(--color-primary),
          0 0 0 4px var(--color-surface);
      }
    }
    .card__actions {
      display: flex;
      gap: var(--space-2);
      padding: var(--space-3) var(--space-4);
      border-top: 1px solid var(--color-border);
    }
    .state {
      background: var(--color-surface);
      border: 1px dashed var(--color-border-strong);
      border-radius: var(--radius-lg);
      padding: var(--space-12) var(--space-6);
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--space-3);
      &--error {
        border-color: var(--color-danger);
        color: var(--color-danger);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppButton, RouterLink],
})
export class GalleryComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly registry = inject(TemplateRegistry);
  private readonly repository = inject(RESUME_REPOSITORY);

  readonly categories = CATEGORY_ORDER;
  readonly CATEGORY_LABELS = CATEGORY_LABELS;
  readonly themeSwatches = THEME_SWATCHES;

  readonly filters = signal<TemplateGalleryFilters>({
    category: 'all',
    search: '',
  });

  readonly cards = signal<TemplateCard[]>([]);

  readonly changeMode = signal(false);
  readonly resumeId = signal<string | null>(null);
  readonly versionId = signal<string | null>(null);
  readonly returnUrl = signal<string | null>(null);
  readonly changeTargetName = signal('your resume');

  readonly heading = computed(() =>
    this.changeMode() ? `Choose a new template for ${this.changeTargetName()}` : 'Templates',
  );

  readonly subtitle = computed(() =>
    this.changeMode()
      ? 'The current resume content is preserved. Apply a new template to update its design.'
      : 'Choose a layout for your resume. 4 colour themes available per layout.',
  );

  readonly filteredCards = computed(() => {
    const f = this.filters();
    let result = this.cards();
    if (f.category !== 'all') {
      result = result.filter((c) => c.category === f.category);
    }
    if (f.search.trim()) {
      const q = f.search.trim().toLowerCase();
      result = result.filter(
        (c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
      );
    }
    return result;
  });

  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  readonly imageError = signal<Set<string>>(new Set());

  ngOnInit(): void {
    this.loading.set(true);
    const query = this.route.snapshot.queryParamMap;
    if (query.get('mode') === 'change' && query.get('versionId')) {
      this.changeMode.set(true);
      this.resumeId.set(query.get('resumeId'));
      this.versionId.set(query.get('versionId'));
      this.returnUrl.set(query.get('returnUrl'));
      this.repository.getVersion(query.get('versionId')!).subscribe((version) => {
        if (version) {
          this.changeTargetName.set(version.name);
        }
      });
    }
    try {
      const cardList: TemplateCard[] = this.registry.layoutOrder().map((slug) => {
        const meta = this.registry.layoutMeta(slug);
        return {
          layoutFamily: slug,
          name: meta.name,
          description: meta.description,
          category: meta.category,
          badge: meta.badge,
          selectedTheme: ColorThemeId.Navy,
        };
      });
      this.cards.set(cardList);
    } catch (err) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Failed to load templates.');
    } finally {
      this.loading.set(false);
    }
  }

  categoryLabel(category: TemplateCategory): string {
    return CATEGORY_LABELS[category];
  }

  onCategoryChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    this.filters.update((f) => ({
      ...f,
      category: target.value as TemplateGalleryFilters['category'],
    }));
  }

  onSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.filters.update((f) => ({ ...f, search: target.value }));
  }

  onImageError(card: TemplateCard): void {
    this.imageError.update((s) => new Set(s).add(card.layoutFamily));
  }

  cardImageError(card: TemplateCard): boolean {
    return this.imageError().has(card.layoutFamily);
  }

  previewUrl(card: TemplateCard): string {
    return `/template-thumbnails/t-${card.layoutFamily}-${card.selectedTheme}.png`;
  }

  selectedSwatch(card: TemplateCard, theme: ColorThemeId): boolean {
    return card.selectedTheme === theme;
  }

  selectSwatch(card: TemplateCard, theme: ColorThemeId): void {
    card.selectedTheme = theme;
    this.cards.update((list) => [...list]);
  }

  previewTemplate(card: TemplateCard): void {
    this.router.navigate(['/templates', `t-${card.layoutFamily}-${card.selectedTheme}`], {
      queryParams: this.changeParams(),
    });
  }

  private changeParams(): Record<string, string> {
    if (!this.changeMode()) {
      return {};
    }
    return {
      mode: 'change',
      resumeId: this.resumeId() ?? '',
      versionId: this.versionId() ?? '',
      returnUrl: this.returnUrl() ?? '',
    };
  }
}
