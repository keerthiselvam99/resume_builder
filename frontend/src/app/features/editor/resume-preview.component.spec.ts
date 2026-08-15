import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ResumePreviewComponent } from './resume-preview.component';
import { ResumeContent } from '../../core/models/resume.model';
import { TemplateRegistry } from '../../core/templates/template-registry';

const content: ResumeContent = {
  contacts: {
    fullName: 'Arun Kumar',
    email: 'arun@example.com',
    phone: '',
    location: '',
    linkedinUrl: '',
    githubUrl: '',
    portfolioUrl: '',
  },
  summary: 'Full-stack developer.',
  skills: ['Angular'],
  experiences: [],
  projects: [],
  education: [],
  certifications: [],
  achievements: [],
  awards: [],
  languages: [],
  customSections: [],
};

const mockRegistry = {
  list: () => [],
  get: (id: string) => ({
    id,
    name: 'Test',
    description: '',
    layoutFamily: 'classic-ats',
    colorTheme: 'navy',
    columnCount: 1,
    headerAlignment: 'left',
    typography: {
      fontFamily: 'Inter',
      fontSize: 10,
      lineHeight: 1.5,
      headingWeight: 700,
      bodyWeight: 400,
    },
    onePage: true,
    twoPage: true,
    isAtsFriendly: true,
    isVisual: false,
  }),
  getFallbackId: () => 't-classic-ats-navy',
  getByLayoutAndTheme: () => undefined,
};

describe('ResumePreviewComponent zoom', () => {
  let fixture: ComponentFixture<ResumePreviewComponent>;
  let component: ResumePreviewComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResumePreviewComponent],
      providers: [{ provide: TemplateRegistry, useValue: mockRegistry }],
    }).compileComponents();
    fixture = TestBed.createComponent(ResumePreviewComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('content', content);
    fixture.detectChanges();
  });

  it('starts at 100% and renders the percentage', () => {
    expect(component.zoom()).toBe(1);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Zoom: 100%');
  });

  it('zooms in and out within the 60-140% range', () => {
    component.zoomIn();
    expect(component.zoom()).toBe(1.1);
    component.zoomOut();
    component.zoomOut();
    expect(component.zoom()).toBe(0.9);
  });

  it('clamps zoom at the upper bound 140%', () => {
    for (let i = 0; i < 10; i += 1) {
      component.zoomIn();
    }
    expect(component.zoom()).toBe(1.4);
    expect(component.zoomPercent()).toBe(140);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Zoom: 140%');
  });

  it('clamps zoom at the lower bound 60%', () => {
    for (let i = 0; i < 10; i += 1) {
      component.zoomOut();
    }
    expect(component.zoom()).toBe(0.6);
    expect(component.zoomPercent()).toBe(60);
  });

  it('resets zoom back to 100%', () => {
    component.zoomIn();
    component.zoomIn();
    component.zoomReset();
    expect(component.zoom()).toBe(1);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Zoom: 100%');
  });

  it('keeps zoom as UI state only, independent of content', () => {
    component.zoomIn();
    const zoomed = component.zoom();
    component.zoomReset();
    expect(zoomed).not.toBe(component.zoom());
    // Changing content must not touch the zoom level.
    fixture.componentRef.setInput('content', {
      ...content,
      summary: 'Different summary.',
    });
    fixture.detectChanges();
    expect(component.zoom()).toBe(1);
  });

  it('exposes accessible names and keyboard-operable buttons', () => {
    const buttons = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('button'));
    const names = buttons.map((b) => b.getAttribute('aria-label'));
    expect(names).toContain('Zoom in');
    expect(names).toContain('Zoom out');
    expect(names).toContain('Reset zoom to 100%');
    expect(names).toContain('Fit to panel');
    const zoomGroup = (fixture.nativeElement as HTMLElement).querySelector(
      '[aria-label="Preview zoom"]',
    );
    expect(zoomGroup).not.toBeNull();
  });

  it('defaults to fit-to-panel zoom', () => {
    expect(component.fitMode()).toBe(true);
  });

  it('shows a helpful empty state instead of a blank page for empty content', () => {
    fixture.componentRef.setInput('content', {
      contacts: {
        fullName: '',
        title: '',
        email: '',
        phone: '',
        location: '',
        linkedinUrl: '',
        githubUrl: '',
        portfolioUrl: '',
      },
      summary: '',
      skills: [],
      experiences: [],
      projects: [],
      education: [],
      certifications: [],
      achievements: [],
      awards: [],
      languages: [],
      customSections: [],
    });
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Start entering your details');
    expect(component.empty()).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('iframe')).toBeNull();
  });

  it('hides the empty state once content is present', () => {
    expect(component.empty()).toBe(false);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('Start entering your details');
    expect((fixture.nativeElement as HTMLElement).querySelector('iframe')).not.toBeNull();
  });

  it('Fit returns to fit mode after manual zooming', () => {
    component.zoomIn();
    expect(component.fitMode()).toBe(false);
    component.fitToPanel();
    expect(component.fitMode()).toBe(true);
  });
});
