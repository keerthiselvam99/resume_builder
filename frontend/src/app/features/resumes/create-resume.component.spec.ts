import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { vi } from 'vitest';
import { RESUME_REPOSITORY } from '../../core/repositories/repository.providers';
import { MockResumeRepository } from '../../core/repositories/mock/mock-resume.repository';
import { MockStore } from '../../core/repositories/mock/mock-store';
import { emptyContent } from '../../core/repositories/mock/fixtures';
import { CreateResumeComponent } from './create-resume.component';
import { PreviewFrameComponent } from '../../shared/components/preview-frame.component';
import { TemplateRegistry } from '../../core/templates/template-registry';
import {
  buildTemplatePreviewHtml,
  templatePreviewSampleContent,
} from '../../core/templates/template-preview-content';
import { ResumeContent } from '../../core/models/resume.model';

const wait = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms));

describe('CreateResumeComponent', () => {
  let fixture: ComponentFixture<CreateResumeComponent>;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();

    const activatedRoute = {
      snapshot: {
        queryParamMap: {
          get: (key: string) => (key === 'templateId' ? 't-executive-banner-burgundy' : null),
        },
      },
    };

    await TestBed.configureTestingModule({
      imports: [CreateResumeComponent],
      providers: [
        { provide: RESUME_REPOSITORY, useClass: MockResumeRepository },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: activatedRoute },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(CreateResumeComponent);
    fixture.detectChanges();
  });

  it('shows the selected template context (name and theme) and a shared A4 fit preview', () => {
    const html = fixture.nativeElement as HTMLElement;
    expect(html.textContent ?? '').toContain('Executive Banner — Burgundy');
    const frame = html.querySelector('app-preview-frame');
    expect(frame).not.toBeNull();
    expect(frame?.getAttribute('mode')).toBe('fit');
    const iframe = html.querySelector('iframe') as HTMLIFrameElement | null;
    expect(iframe).not.toBeNull();
    // The same A4 portrait frame used by Template Preview (210:297 ≈ 794:1123).
    expect(iframe?.style.width).toBe('794px');
    expect(iframe?.style.height).toBe('1123px');
    expect(iframe?.srcdoc).toContain('resume-page');
  });

  it('shows the Visual badge, Change template link and Resume name label', () => {
    const html = fixture.nativeElement as HTMLElement;
    expect(html.textContent ?? '').toContain('Visual');
    expect(html.textContent ?? '').toContain('Change template');
    expect(html.querySelector('label[for="resume-name"]')?.textContent).toContain('Resume name');
    expect(html.querySelector('#resume-name')).not.toBeNull();
  });

  it('drives the exact same PreviewFrame component instance as Template Preview', () => {
    const debug = fixture.debugElement.query(
      (el) => el.componentInstance instanceof PreviewFrameComponent,
    );
    expect(debug).not.toBeNull();
    const frame = debug.componentInstance as PreviewFrameComponent;
    expect(frame.iframeWidth()).toBe(794);
    expect(frame.iframeHeight()).toBe(1123);
    expect(frame.scale()).toBeGreaterThan(0);
  });

  it('uses the exact canonical preview fixture shared with Template Preview', () => {
    expect(fixture.componentInstance.previewContent()).toBe(templatePreviewSampleContent);
    const debug = fixture.debugElement.query(
      (el) => el.componentInstance instanceof PreviewFrameComponent,
    );
    const frame = debug.componentInstance as PreviewFrameComponent;
    expect(frame.content()).toBe(templatePreviewSampleContent);
  });

  it('renders the complete canonical template preview content', () => {
    const iframe = (fixture.nativeElement as HTMLElement).querySelector(
      'iframe',
    ) as HTMLIFrameElement | null;
    for (const marker of [
      'Jane Doe',
      'Enterprise Dashboard',
      'AWS Solutions Architect',
      'Employee of the Year',
      'University of Washington',
      'English',
      'Spanish',
      'Open Source',
      'Summary',
    ]) {
      expect(iframe?.srcdoc).toContain(marker);
    }
  });

  it('preview HTML equals the canonical helper output for the selected template', () => {
    const iframe = (fixture.nativeElement as HTMLElement).querySelector(
      'iframe',
    ) as HTMLIFrameElement | null;
    const def = TestBed.inject(TemplateRegistry).get('t-executive-banner-burgundy');
    expect(iframe?.srcdoc).toBe(buildTemplatePreviewHtml(def));
  });

  it('keeps the Create Resume right-side form markup unchanged', () => {
    const html = fixture.nativeElement as HTMLElement;
    const text = html.textContent ?? '';
    expect(text).toContain('Create a new resume');
    expect(text).toContain(
      'This will create a new resume using the selected template. You can rename it later.',
    );
    expect(html.querySelector('label[for="resume-name"]')?.textContent).toContain('Resume name');
    const buttons = Array.from(html.querySelectorAll('app-button')) as HTMLElement[];
    expect(buttons.some((b) => (b.textContent ?? '').includes('Create and edit'))).toBe(true);
    expect(buttons.some((b) => (b.textContent ?? '').includes('Cancel'))).toBe(true);
    expect(html.querySelector('.template-card__name')?.textContent).toContain('Executive Banner');
    expect(html.querySelector('.template-card__badges')).not.toBeNull();
    expect(html.querySelector('.change-link')?.textContent).toContain('Change template');
  });

  it('creates the resume and navigates to the editor', async () => {
    fixture.componentInstance.name.set('New Resume');
    fixture.detectChanges();
    fixture.componentInstance.create();
    await wait(800);
    fixture.detectChanges();
    const resumes = MockStore.read<{ name: string }[]>('resumes', []);
    expect(resumes.some((r) => r.name === 'New Resume')).toBe(true);
    expect(router.navigate).toHaveBeenCalledWith(expect.arrayContaining(['edit']) as unknown[]);
  });

  it('does not persist the Jane Doe preview sample into the new resume', async () => {
    fixture.componentInstance.name.set('NoSample Resume');
    fixture.detectChanges();
    fixture.componentInstance.create();
    await wait(800);
    fixture.detectChanges();

    const resumes = MockStore.read<{ id: string; name: string }[]>('resumes', []);
    const created = resumes.find((r) => r.name === 'NoSample Resume');
    expect(created).toBeTruthy();

    const versions = MockStore.read<{ resumeId: string; content: ResumeContent }[]>('versions', []);
    const version = versions.find((v) => v.resumeId === created!.id);
    expect(version?.content).toEqual(emptyContent);
    const serialized = JSON.stringify(version?.content);
    expect(serialized).not.toContain('Jane Doe');
    expect(serialized).not.toContain('Enterprise Dashboard');
    expect(version?.content.contacts.fullName).toBe('');
    expect(version?.content.customSections).toEqual([]);
  });

  it('redirects to templates when no template is selected', async () => {
    localStorage.clear();
    await TestBed.resetTestingModule();
    const activatedRoute = {
      snapshot: { queryParamMap: { get: () => null } },
    };
    await TestBed.configureTestingModule({
      imports: [CreateResumeComponent],
      providers: [
        { provide: RESUME_REPOSITORY, useClass: MockResumeRepository },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: ActivatedRoute, useValue: activatedRoute },
      ],
    }).compileComponents();

    const localRouter = TestBed.inject(Router);
    TestBed.createComponent(CreateResumeComponent);
    expect(localRouter.navigate).toHaveBeenCalledWith(['/templates']);
  });
});
