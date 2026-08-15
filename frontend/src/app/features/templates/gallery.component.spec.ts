import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { GalleryComponent } from './gallery.component';
import { TemplateRegistry } from '../../core/templates/template-registry';
import { RESUME_REPOSITORY } from '../../core/repositories/repository.providers';

const normalRoute = { snapshot: { queryParamMap: { get: () => null } } };
const changeRoute = {
  snapshot: {
    queryParamMap: {
      get: (key: string) => {
        if (key === 'mode') return 'change';
        if (key === 'resumeId') return 'r-master';
        if (key === 'versionId') return 'v-master';
        if (key === 'returnUrl') return '/resumes/r-master/versions/v-master/edit';
        return null;
      },
    },
  },
};

function bootstrap(route: unknown): {
  fixture: ComponentFixture<GalleryComponent>;
  router: Router;
} {
  const repository = {
    updateTemplate: vi.fn(() => of({})),
    getVersion: vi.fn(() => of({ id: 'v-master', name: 'Master Resume' })),
  };
  TestBed.configureTestingModule({
    imports: [GalleryComponent],
    providers: [
      TemplateRegistry,
      { provide: RESUME_REPOSITORY, useValue: repository },
      { provide: ActivatedRoute, useValue: route },
      { provide: Router, useValue: { navigate: vi.fn(), navigateByUrl: vi.fn() } },
    ],
  });
  const fixture = TestBed.createComponent(GalleryComponent);
  fixture.detectChanges();
  return { fixture, router: TestBed.inject(Router) };
}

function cards(fixture: ComponentFixture<GalleryComponent>): HTMLElement[] {
  return Array.from(fixture.nativeElement.querySelectorAll('article.card'));
}

describe('GalleryComponent', () => {
  it('shows the standard Templates heading with all 25 layouts', () => {
    const { fixture } = bootstrap(normalRoute);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Templates');
    expect(cards(fixture).length).toBe(25);
  });

  it('renders 4 theme swatches per card with Navy selected by default', () => {
    const { fixture } = bootstrap(normalRoute);
    const swatches = fixture.nativeElement.querySelectorAll('button.swatch');
    expect(swatches.length).toBe(25 * 4);
    const first = swatches[0];
    expect(first.getAttribute('aria-label')).toContain('Navy');
    expect(first.getAttribute('aria-pressed')).toBe('true');
    const teal = swatches[2];
    expect(teal.getAttribute('aria-pressed')).toBe('false');
  });

  it('clicking a swatch then Preview opens the template with that theme applied', () => {
    const { fixture, router } = bootstrap(normalRoute);
    const firstCard = cards(fixture)[0];
    const swatches = firstCard.querySelectorAll('button.swatch');
    (swatches[3] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(swatches[3].getAttribute('aria-pressed')).toBe('true');
    (firstCard.querySelector('app-button') as HTMLElement).click();
    expect(router.navigate).toHaveBeenCalledWith(['/templates', 't-classic-ats-burgundy'], {
      queryParams: {},
    });
  });

  it('filters cards by category', () => {
    const { fixture } = bootstrap(normalRoute);
    const select = fixture.nativeElement.querySelector('#filter-category') as HTMLSelectElement;
    select.value = 'Modern';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    const visible = cards(fixture);
    expect(visible.length).toBe(5);
    expect(visible.every((c) => c.textContent?.includes('4 themes'))).toBe(true);
  });

  it('filters cards by search term', () => {
    const { fixture } = bootstrap(normalRoute);
    const input = fixture.nativeElement.querySelector('#filter-search') as HTMLInputElement;
    input.value = 'Academic';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(cards(fixture).length).toBe(1);
    expect(cards(fixture)[0].textContent).toContain('Academic CV');
  });

  it('shows the empty state when no templates match the filters', () => {
    const { fixture } = bootstrap(normalRoute);
    const input = fixture.nativeElement.querySelector('#filter-search') as HTMLInputElement;
    input.value = 'zzz-no-match';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No templates match your filters');
  });

  it('enters change mode with the version-name heading and back link', () => {
    const { fixture } = bootstrap(changeRoute);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Choose a new template for Master Resume');
    expect(text).toContain('← Back to editor');
  });

  it('preserves change-mode params when previewing a template', () => {
    const { fixture, router } = bootstrap(changeRoute);
    const firstCard = cards(fixture)[0];
    const swatches = firstCard.querySelectorAll('button.swatch');
    (swatches[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    (firstCard.querySelector('app-button') as HTMLElement).click();
    expect(router.navigate).toHaveBeenCalledWith(['/templates', 't-classic-ats-charcoal'], {
      queryParams: {
        mode: 'change',
        resumeId: 'r-master',
        versionId: 'v-master',
        returnUrl: '/resumes/r-master/versions/v-master/edit',
      },
    });
  });
});
