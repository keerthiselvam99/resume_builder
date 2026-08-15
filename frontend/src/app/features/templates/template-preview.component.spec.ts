import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { vi } from 'vitest';
import { of } from 'rxjs';
import { TemplatePreviewComponent } from './template-preview.component';
import { TemplateRegistry } from '../../core/templates/template-registry';
import {
  buildTemplatePreviewHtml,
  templatePreviewSampleContent,
} from '../../core/templates/template-preview-content';
import { ColorThemeId } from '../../core/models/template-definition.model';
import { RESUME_REPOSITORY } from '../../core/repositories/repository.providers';

const normalRoute = {
  snapshot: {
    paramMap: { get: (key: string) => (key === 'id' ? 't-executive-banner-navy' : null) },
    queryParamMap: { get: () => null },
  },
};

const changeRoute = {
  snapshot: {
    paramMap: { get: (key: string) => (key === 'id' ? 't-executive-banner-navy' : null) },
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

describe('TemplatePreviewComponent', () => {
  let fixture: ComponentFixture<TemplatePreviewComponent>;
  let component: TemplatePreviewComponent;
  let repository: {
    updateTemplate: ReturnType<typeof vi.fn>;
    getVersion: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    repository = {
      updateTemplate: vi.fn(() => of({ id: 'v-master', templateId: 'x' })),
      getVersion: vi.fn(() => of({ id: 'v-master', name: 'Master Resume' })),
    };

    await TestBed.configureTestingModule({
      imports: [TemplatePreviewComponent],
      providers: [
        TemplateRegistry,
        {
          provide: RESUME_REPOSITORY,
          useValue: repository,
        },
        { provide: ActivatedRoute, useValue: normalRoute },
        { provide: Router, useValue: { navigate: vi.fn(), navigateByUrl: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TemplatePreviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('renders the normal create CTA and back action by default', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Use this template');
    expect(text).toContain('Back to gallery');
  });

  it('defaults to fit-to-width zoom', () => {
    expect(component.fitMode()).toBe(true);
    expect(component.zoom()).toBe(100);
    expect(component.displayScale()).toBe(1);
  });

  it('selecting a preset switches out of fit mode', () => {
    component.setZoom(100);
    expect(component.fitMode()).toBe(false);
    expect(component.zoom()).toBe(100);
  });

  it('Reset returns to fit mode and resets the zoom', () => {
    component.setZoom(120);
    component.resetView();
    expect(component.fitMode()).toBe(true);
    expect(component.zoom()).toBe(100);
  });

  it('selecting a theme switches the selected definition and theme', () => {
    component.selectTheme(ColorThemeId.Teal);
    expect(component.selectedTheme()).toBe(ColorThemeId.Teal);
    expect(component.selectedDefinition()?.colorTheme).toBe(ColorThemeId.Teal);
  });

  it('renders the same shared A4 frame (794×1123) as Create Resume', () => {
    const iframe = (fixture.nativeElement as HTMLElement).querySelector(
      'iframe',
    ) as HTMLIFrameElement | null;
    expect(iframe).not.toBeNull();
    expect(iframe?.style.width).toBe('794px');
    expect(iframe?.style.height).toBe('1123px');
    expect(iframe?.srcdoc).toContain('resume-page');
  });

  it('uses the exact canonical preview fixture shared with Create Resume', () => {
    expect(component.sampleContent).toBe(templatePreviewSampleContent);
  });

  it('preview HTML equals the canonical helper output for the selected template', () => {
    const iframe = (fixture.nativeElement as HTMLElement).querySelector(
      'iframe',
    ) as HTMLIFrameElement | null;
    const def = component.selectedDefinition()!;
    expect(iframe?.srcdoc).toBe(buildTemplatePreviewHtml(def));
  });

  it('switching theme updates the preview consistently with the canonical helper', () => {
    const iframe = (fixture.nativeElement as HTMLElement).querySelector(
      'iframe',
    ) as HTMLIFrameElement | null;
    const navySrcdoc = iframe?.srcdoc;

    component.selectTheme(ColorThemeId.Burgundy);
    fixture.detectChanges();

    const burgundyIframe = (fixture.nativeElement as HTMLElement).querySelector(
      'iframe',
    ) as HTMLIFrameElement | null;
    const def = component.selectedDefinition()!;
    expect(def.colorTheme).toBe(ColorThemeId.Burgundy);
    expect(burgundyIframe?.srcdoc).not.toBe(navySrcdoc);
    expect(burgundyIframe?.srcdoc).toBe(buildTemplatePreviewHtml(def));
  });
});

describe('TemplatePreviewComponent — change mode', () => {
  let fixture: ComponentFixture<TemplatePreviewComponent>;
  let component: TemplatePreviewComponent;
  let router: Router;
  let repository: {
    updateTemplate: ReturnType<typeof vi.fn>;
    getVersion: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    repository = {
      updateTemplate: vi.fn(() => of({ id: 'v-master', templateId: 't-executive-banner-teal' })),
      getVersion: vi.fn(() => of({ id: 'v-master', name: 'Master Resume' })),
    };

    await TestBed.configureTestingModule({
      imports: [TemplatePreviewComponent],
      providers: [
        TemplateRegistry,
        { provide: RESUME_REPOSITORY, useValue: repository },
        { provide: ActivatedRoute, useValue: changeRoute },
        { provide: Router, useValue: { navigate: vi.fn(), navigateByUrl: vi.fn() } },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(TemplatePreviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('enters change mode and shows the Apply CTA', () => {
    expect(component.changeMode()).toBe(true);
    expect(component.primaryActionLabel()).toBe('Apply this template');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Apply this template');
    expect(text).toContain('Change template');
  });

  it('back navigates to the editor return URL', () => {
    component.back();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/resumes/r-master/versions/v-master/edit');
  });

  it('Apply updates the current version template and returns to the editor URL', () => {
    component.selectTheme(ColorThemeId.Teal);
    fixture.detectChanges();
    component.primaryAction();

    expect(repository.updateTemplate).toHaveBeenCalledWith('v-master', 't-executive-banner-teal');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/resumes/r-master/versions/v-master/edit');
  });
});
