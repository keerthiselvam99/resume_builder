import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import {
  PDF_EXPORT_REPOSITORY,
  RESUME_REPOSITORY,
  AUTH_REPOSITORY,
  ANALYSIS_REPOSITORY,
  DEMO_MODE,
} from '../../core/repositories/repository.providers';
import { MockResumeRepository } from '../../core/repositories/mock/mock-resume.repository';
import { MockAuthRepository } from '../../core/repositories/mock/mock-auth.repository';
import { MockAnalysisRepository } from '../../core/repositories/mock/mock-analysis.repository';
import { Resume, ResumeVersion } from '../../core/models/resume.model';
import { ResumeEditorComponent } from './resume-editor.component';

// Polls until `predicate` becomes true instead of sleeping a fixed amount of
// time. Fixed sleeps are the flake source here: the mock repository adds 300ms
// of simulated latency and a loaded/parallel test run can delay timers past
// the original 20-50ms margin.
async function until(predicate: () => boolean, timeout = 3000, interval = 25): Promise<void> {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

function loaded(component: ResumeEditorComponent): () => boolean {
  return () => component.store.loading() === false;
}

function fakePdfRepository() {
  return {
    exportPdf: vi.fn(),
  };
}

describe('ResumeEditorComponent', () => {
  let fixture: ComponentFixture<ResumeEditorComponent>;
  let pdfRepo: ReturnType<typeof fakePdfRepository>;

  beforeEach(async () => {
    localStorage.clear();
    localStorage.setItem(
      'resumeiq_session',
      JSON.stringify({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
        expiresAt: new Date().toISOString(),
        user: {
          id: 'u-demo',
          name: 'Arun Kumar',
          email: 'arun@example.com',
          role: 'user',
          createdAt: new Date().toISOString(),
        },
      }),
    );
    pdfRepo = fakePdfRepository();
    pdfRepo.exportPdf.mockResolvedValue({
      blob: new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }),
      filename: 'arun-kumar-master-resume.pdf',
      pageCount: 2,
    });

    await TestBed.configureTestingModule({
      imports: [ResumeEditorComponent],
      providers: [
        { provide: RESUME_REPOSITORY, useClass: MockResumeRepository },
        { provide: AUTH_REPOSITORY, useClass: MockAuthRepository },
        { provide: ANALYSIS_REPOSITORY, useClass: MockAnalysisRepository },
        { provide: PDF_EXPORT_REPOSITORY, useValue: pdfRepo },
        // These tests exercise the real export path, so the app must behave as
        // if it is NOT in demo mode (backend reachable).
        { provide: DEMO_MODE, useValue: false },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of({ get: () => 'v-master' }) },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ResumeEditorComponent);
  });

  it('shows a loading state before the version resolves', () => {
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Loading version');
  });

  it('loads the version and renders the contact form', async () => {
    fixture.detectChanges();
    await until(loaded(fixture.componentInstance));
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Contact');
    expect(text).toContain('Summary');
    expect(text).toContain('Skills');
  });

  it('does not render the removed editor header metadata', async () => {
    fixture.detectChanges();
    await until(loaded(fixture.componentInstance));
    fixture.detectChanges();
    const html = fixture.nativeElement as HTMLElement;
    const text = html.textContent ?? '';
    // The version name, version label, template chip and visible badges are gone.
    expect(text).not.toContain('Master Resume');
    expect(text).not.toContain('Master version');
    expect(text).not.toContain('Classic ATS — Navy');
    expect(html.querySelector('.editor__context')).toBeNull();
    expect(html.querySelector('.editor__template')).toBeNull();
    expect(html.querySelector('.editor__status')).toBeNull();
  });

  it('renders the seeded preview data', async () => {
    fixture.detectChanges();
    await until(loaded(fixture.componentInstance));
    fixture.detectChanges();
    const iframe = (fixture.nativeElement as HTMLElement).querySelector(
      'iframe',
    ) as HTMLIFrameElement;
    const srcdoc = iframe?.getAttribute('srcdoc') ?? '';
    expect(srcdoc).toContain('Arun Kumar');
    expect(srcdoc).toContain('Full-stack developer with 5 years of experience building Angular');
  });

  it('shows save status Saved after load through the visually hidden live region', async () => {
    fixture.detectChanges();
    await until(loaded(fixture.componentInstance));
    fixture.detectChanges();
    const live = (fixture.nativeElement as HTMLElement).querySelector(
      '.editor__save-label[role="status"]',
    ) as HTMLElement | null;
    expect(live).not.toBeNull();
    expect(live?.textContent).toContain('Saved');
  });

  it('keeps save/autosave feedback available to assistive technology', async () => {
    fixture.detectChanges();
    await until(loaded(fixture.componentInstance));
    fixture.detectChanges();
    const live = fixture.nativeElement.querySelector(
      '.editor__save-label[role="status"][aria-live="polite"]',
    ) as HTMLElement | null;
    if (!live) {
      throw new Error('Expected the sr-only save live region.');
    }
    // Visually hidden (sr-only) but still in the accessibility tree.
    expect(live.className).toContain('sr-only');

    // An autosave cycle updates the announced text: unsaved -> saved.
    fixture.componentInstance.updateSummary('Announce this autosave.');
    fixture.detectChanges();
    expect(live.textContent).toContain('Unsaved changes');
    await until(() => fixture.componentInstance.store.saveState() === 'saved');
    fixture.detectChanges();
    expect(live.textContent).toContain('Saved');
  });

  it('shows Save resume only for a draft and hides it after promotion', async () => {
    fixture.detectChanges();
    await until(loaded(fixture.componentInstance));
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const repo = TestBed.inject(RESUME_REPOSITORY) as MockResumeRepository;
    const draft = await new Promise<Resume>((resolve) => {
      repo
        .create({ name: 'Draft Resume', templateId: 't-classic-ats-navy' })
        .subscribe((r) => resolve(r));
    });
    expect(draft.status).toBe('draft');

    component.store['resume'].set(draft);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Save resume');

    await component.saveResume();
    await until(() => component.store.resume()?.status === 'saved');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Save resume');
  });

  it('keeps Download PDF disabled for an empty resume with explanatory accessible text', async () => {
    fixture.detectChanges();
    await until(loaded(fixture.componentInstance));
    fixture.detectChanges();

    const component = fixture.componentInstance;
    const empty = {
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
    };
    component.store['content'].set(empty);
    fixture.detectChanges();

    expect(component.pdfDisabled()).toBe(true);

    const allButtons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ) as HTMLButtonElement[];
    const pdfButton = allButtons.find((b) => b.textContent?.includes('Download PDF'));
    expect(pdfButton).not.toBeNull();
    expect(pdfButton?.disabled).toBe(true);
    expect(pdfButton?.getAttribute('aria-describedby')).toBe('editor-pdf-empty-hint');
    const hint = (fixture.nativeElement as HTMLElement).querySelector('#editor-pdf-empty-hint');
    expect(hint).not.toBeNull();
    expect(hint?.textContent).toContain('Add resume content before downloading your PDF.');
  });

  it('updates the preview immediately when the summary changes', async () => {
    fixture.detectChanges();
    await until(loaded(fixture.componentInstance));
    fixture.detectChanges();

    const textarea = (fixture.nativeElement as HTMLElement).querySelector(
      'app-editor-summary-form textarea',
    ) as HTMLTextAreaElement;
    textarea.value = 'Completely new summary text.';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const iframe = (fixture.nativeElement as HTMLElement).querySelector(
      'iframe',
    ) as HTMLIFrameElement;
    const srcdoc = iframe?.getAttribute('srcdoc') ?? '';
    expect(srcdoc).toContain('Completely new summary text.');
  });

  it('autosaves edited content and returns to Saved', async () => {
    fixture.detectChanges();
    await until(loaded(fixture.componentInstance));
    fixture.detectChanges();

    const textarea = (fixture.nativeElement as HTMLElement).querySelector(
      'app-editor-summary-form textarea',
    ) as HTMLTextAreaElement;
    textarea.value = 'Autosaved summary.';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unsaved changes');

    await until(() => fixture.componentInstance.store.saveState() === 'saved');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Saved');
  });

  it('toggles the mobile pane to preview', async () => {
    fixture.detectChanges();
    await until(loaded(fixture.componentInstance));
    fixture.detectChanges();
    fixture.componentInstance.mobilePane.set('preview');
    fixture.detectChanges();
    expect(fixture.componentInstance.mobilePane()).toBe('preview');
  });

  it('navigates back to My Resumes', async () => {
    const router = TestBed.inject(Router);
    fixture.detectChanges();
    await until(loaded(fixture.componentInstance));
    fixture.detectChanges();
    fixture.componentInstance.goBack();
    expect(router.navigate).toHaveBeenCalledWith(['/resumes']);
  });

  it('renders the back action as ← My Resumes', async () => {
    fixture.detectChanges();
    await until(loaded(fixture.componentInstance));
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('← My Resumes');
  });

  it('renders a Change template action', async () => {
    fixture.detectChanges();
    await until(loaded(fixture.componentInstance));
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Change template');
  });

  it('changeTemplate flushes pending edits and navigates to change mode', async () => {
    const router = TestBed.inject(Router);
    fixture.detectChanges();
    await until(loaded(fixture.componentInstance));
    fixture.detectChanges();

    fixture.componentInstance.updateSummary('Dirty before template change.');
    fixture.detectChanges();
    expect(fixture.componentInstance.store.saveState()).toBe('unsaved');

    await fixture.componentInstance.changeTemplate();

    expect(fixture.componentInstance.store.saveState()).toBe('saved');
    expect(router.navigate).toHaveBeenCalledWith(['/templates'], {
      queryParams: {
        mode: 'change',
        resumeId: 'r-master',
        versionId: 'v-master',
        returnUrl: '/resumes/r-master/versions/v-master/edit',
      },
    });

    // The flushed edit must be persisted before leaving.
    const version = await new Promise<ResumeVersion | null>((resolve) => {
      TestBed.inject(RESUME_REPOSITORY)
        .getVersion('v-master')
        .subscribe((v) => resolve(v));
    });
    expect(version?.content.summary).toBe('Dirty before template change.');
  });

  it('updates the preview immediately when experience is changed', async () => {
    fixture.detectChanges();
    await until(loaded(fixture.componentInstance));
    fixture.detectChanges();

    fixture.componentInstance.updateExperiences([
      {
        id: 'e-new',
        company: 'NewCo',
        role: 'Lead Engineer',
        location: '',
        startDate: '2020-01',
        endDate: '',
        current: true,
        bullets: ['Shipped a platform.'],
      },
    ]);
    fixture.detectChanges();

    const iframe = (fixture.nativeElement as HTMLElement).querySelector(
      'iframe',
    ) as HTMLIFrameElement;
    const srcdoc = iframe?.getAttribute('srcdoc') ?? '';
    expect(srcdoc).toContain('Lead Engineer');
    expect(srcdoc).toContain('NewCo');
  });

  it('autosaves experience changes and returns to Saved', async () => {
    fixture.detectChanges();
    await until(loaded(fixture.componentInstance));
    fixture.detectChanges();

    fixture.componentInstance.updateExperiences([
      {
        id: 'e-another',
        company: 'Persist Co',
        role: 'Engineer',
        location: '',
        startDate: '2019-01',
        endDate: '',
        current: true,
        bullets: ['Persisted entry.'],
      },
    ]);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Unsaved changes');

    await until(() => fixture.componentInstance.store.saveState() === 'saved');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Saved');

    // The autosaved content must be persisted to the repository.
    const version = await new Promise<ResumeVersion | null>((resolve) => {
      TestBed.inject(RESUME_REPOSITORY)
        .getVersion('v-master')
        .subscribe((v) => resolve(v));
    });
    expect(version?.content.experiences[0].company).toBe('Persist Co');
  });

  it('renders the seeded experience/project/education in preview', async () => {
    fixture.detectChanges();
    await until(loaded(fixture.componentInstance));
    fixture.detectChanges();
    const iframe = (fixture.nativeElement as HTMLElement).querySelector(
      'iframe',
    ) as HTMLIFrameElement;
    const srcdoc = iframe?.getAttribute('srcdoc') ?? '';
    expect(srcdoc).toContain('Acme Tech');
    expect(srcdoc).toContain('Employee Management System');
    expect(srcdoc).toContain('Anna University');
  });

  describe('version independence', () => {
    it('saves edits to the loaded version only', async () => {
      const repo = TestBed.inject(RESUME_REPOSITORY);

      fixture.detectChanges();
      await until(loaded(fixture.componentInstance));
      fixture.detectChanges();

      fixture.componentInstance.updateContacts({
        ...fixture.componentInstance.store.content()!.contacts,
        fullName: 'Renamed Person',
      });
      fixture.detectChanges();
      await until(() => fixture.componentInstance.store.saveState() === 'saved');
      fixture.detectChanges();

      const saved = await new Promise<ResumeVersion | null>((resolve) =>
        repo.getVersion('v-master').subscribe((v) => resolve(v)),
      );
      expect(saved?.content.contacts.fullName).toBe('Renamed Person');
    });
  });

  describe('navigation protection', () => {
    it('allows leaving when there is nothing unsaved', async () => {
      const component = fixture.componentInstance;
      fixture.detectChanges();
      await until(loaded(fixture.componentInstance));
      fixture.detectChanges();
      expect(await component.canDeactivate()).toBe(true);
    });

    it('flushes pending edits and allows leaving once the save completes', async () => {
      const component = fixture.componentInstance;
      fixture.detectChanges();
      await until(loaded(fixture.componentInstance));
      fixture.detectChanges();

      component.updateSummary('Flushed on navigation.');
      fixture.detectChanges();
      expect(component.store.saveState()).toBe('unsaved');

      // Debounce is 700ms, but canDeactivate flushes immediately (save ~300ms).
      // The bound is deliberately generous (2s) so a loaded machine does not
      // flake; the guarantee under test is that leaving does not wait for the
      // full 700ms debounce window to elapse before persisting.
      const start = Date.now();
      expect(await component.canDeactivate()).toBe(true);
      expect(Date.now() - start).toBeLessThan(2000);
      expect(component.store.saveState()).toBe('saved');
    });

    it('flushes and then blocks leaving when the save fails, staying to retry', async () => {
      const component = fixture.componentInstance;
      const repo = TestBed.inject(RESUME_REPOSITORY) as MockResumeRepository;
      const updateContent = repo.updateContent.bind(repo);
      let fail = true;
      vi.spyOn(repo, 'updateContent').mockImplementation((id, content) => {
        if (fail) {
          fail = false;
          return throwError(() => new Error('boom'));
        }
        return updateContent(id, content);
      });
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      fixture.detectChanges();
      await until(loaded(fixture.componentInstance));
      fixture.detectChanges();

      component.updateSummary('Fails during leave attempt.');
      fixture.detectChanges();

      const decision = await component.canDeactivate();
      expect(decision).toBe(false);
      expect(confirmSpy).toHaveBeenCalled();
      await until(() => component.store.saveState() === 'saved'); // retry succeeded
      confirmSpy.mockRestore();
    });

    it('leaves explicitly when the user confirms after a failed save', async () => {
      const component = fixture.componentInstance;
      const repo = TestBed.inject(RESUME_REPOSITORY) as MockResumeRepository;
      const updateContent = repo.updateContent.bind(repo);
      let fail = true;
      vi.spyOn(repo, 'updateContent').mockImplementation((id, content) => {
        if (fail) {
          fail = false;
          return throwError(() => new Error('boom'));
        }
        return updateContent(id, content);
      });
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

      fixture.detectChanges();
      await until(loaded(fixture.componentInstance));
      fixture.detectChanges();
      component.updateSummary('Wants to leave.');
      fixture.detectChanges();

      expect(await component.canDeactivate()).toBe(true);
      expect(confirmSpy).toHaveBeenCalled();
      expect(component.store.saveState()).toBe('failed');
      confirmSpy.mockRestore();
    });

    it('arms beforeunload while changes are unsaved and disarms after a save', async () => {
      const component = fixture.componentInstance;
      fixture.detectChanges();
      await until(loaded(fixture.componentInstance));
      fixture.detectChanges();

      // After a successful load there is nothing unsaved -> no warning.
      const idleEvent = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(idleEvent);
      expect(idleEvent.defaultPrevented).toBe(false);

      // Unsaved edits -> warning.
      component.updateSummary('Dirty state.');
      fixture.detectChanges();
      const dirtyEvent = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(dirtyEvent);
      expect(dirtyEvent.defaultPrevented).toBe(true);

      // After autosave completes -> no warning.
      await until(() => fixture.componentInstance.store.saveState() === 'saved');
      fixture.detectChanges();
      expect(component.store.saveState()).toBe('saved');
      const savedEvent = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(savedEvent);
      expect(savedEvent.defaultPrevented).toBe(false);
    });
  });

  describe('Download PDF', () => {
    it('renders a Download PDF action', async () => {
      fixture.detectChanges();
      await until(loaded(fixture.componentInstance));
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Download PDF');
    });

    it('requests the backend with structured content and a slug filename', async () => {
      const component = fixture.componentInstance;
      fixture.detectChanges();
      await until(loaded(fixture.componentInstance));
      fixture.detectChanges();
      await component.downloadPdf();

      expect(pdfRepo.exportPdf).toHaveBeenCalledTimes(1);
      const [versionId, request] = pdfRepo.exportPdf.mock.calls[0] as [
        string,
        {
          templateDefinitionId: string;
          content: { contacts: { fullName: string } };
          filename: string;
        },
      ];
      expect(versionId).toBe('v-master');
      expect(request.filename).toBe('arun-kumar-master-resume.pdf');
      expect(request.templateDefinitionId).toBe('t-classic-ats-navy');
      expect(request.content.contacts.fullName).toBe('Arun Kumar');
      expect(TestBed.inject(Router).navigate).toHaveBeenCalledWith(['/job-matcher'], {
        queryParams: { resumeId: 'r-master', versionId: 'v-master' },
      });
    });

    it('triggers a browser download using the returned blob', async () => {
      const holder: { anchor: HTMLAnchorElement | null } = { anchor: null };
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        holder.anchor = this;
      });
      const createUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');

      const component = fixture.componentInstance;
      fixture.detectChanges();
      await until(loaded(fixture.componentInstance));
      fixture.detectChanges();
      try {
        await component.downloadPdf();
        expect(createUrlSpy).toHaveBeenCalledWith(expect.any(Blob));
        expect(holder.anchor?.getAttribute('download')).toBe('arun-kumar-master-resume.pdf');
      } finally {
        clickSpy.mockRestore();
        createUrlSpy.mockRestore();
      }
    });

    it('shows a success status after downloading', async () => {
      const component = fixture.componentInstance;
      fixture.detectChanges();
      await until(loaded(fixture.componentInstance));
      fixture.detectChanges();
      await component.downloadPdf();
      fixture.detectChanges();
      expect(component.pdfState()).toBe('success');
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Downloaded');
    });

    it('shows an error status when the backend rejects the request', async () => {
      pdfRepo.exportPdf.mockRejectedValueOnce(new Error('The template markup is not supported.'));
      const component = fixture.componentInstance;
      fixture.detectChanges();
      await until(loaded(fixture.componentInstance));
      fixture.detectChanges();
      await component.downloadPdf();
      fixture.detectChanges();
      expect(component.pdfState()).toBe('error');
      expect((fixture.nativeElement as HTMLElement).textContent).toContain(
        'The template markup is not supported.',
      );
      expect(TestBed.inject(Router).navigate).not.toHaveBeenCalledWith(
        ['/job-matcher'],
        expect.anything(),
      );
    });

    it('rejects a non-PDF response and stays in the editor', async () => {
      pdfRepo.exportPdf.mockResolvedValueOnce({
        blob: new Blob(['not a pdf'], { type: 'text/plain' }),
        filename: 'bad.pdf',
        pageCount: 0,
      });
      const component = fixture.componentInstance;
      fixture.detectChanges();
      await until(loaded(component));
      await component.downloadPdf();
      expect(component.pdfState()).toBe('error');
      expect(component.pdfMessage()).toContain('not a valid PDF');
      expect(TestBed.inject(Router).navigate).not.toHaveBeenCalledWith(
        ['/job-matcher'],
        expect.anything(),
      );
    });

    it('coalesces double-clicks into one export and one navigation', async () => {
      const component = fixture.componentInstance;
      fixture.detectChanges();
      await until(loaded(component));
      await Promise.all([component.downloadPdf(), component.downloadPdf()]);
      expect(pdfRepo.exportPdf).toHaveBeenCalledTimes(1);
      expect(TestBed.inject(Router).navigate).toHaveBeenCalledTimes(1);
    });

    it('resets the success status after a timeout', async () => {
      const component = fixture.componentInstance;
      fixture.detectChanges();
      await until(loaded(fixture.componentInstance));
      fixture.detectChanges();
      await component.downloadPdf();
      expect(component.pdfState()).toBe('success');

      await until(() => component.pdfState() === 'idle', 6000);
      fixture.detectChanges();
      expect(component.pdfState()).toBe('idle');
    });
  });

  describe('Download PDF in demo mode', () => {
    let demoFixture: ComponentFixture<ResumeEditorComponent>;
    const demoPdfRepo = { exportPdf: vi.fn() };

    beforeEach(async () => {
      TestBed.resetTestingModule();
      localStorage.clear();
      localStorage.setItem(
        'resumeiq_session',
        JSON.stringify({
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token',
          expiresAt: new Date().toISOString(),
          user: {
            id: 'u-demo',
            name: 'Arun Kumar',
            email: 'arun@example.com',
            role: 'user',
            createdAt: new Date().toISOString(),
          },
        }),
      );

      await TestBed.configureTestingModule({
        imports: [ResumeEditorComponent],
        providers: [
          { provide: RESUME_REPOSITORY, useClass: MockResumeRepository },
          { provide: AUTH_REPOSITORY, useClass: MockAuthRepository },
          { provide: ANALYSIS_REPOSITORY, useClass: MockAnalysisRepository },
          { provide: PDF_EXPORT_REPOSITORY, useValue: demoPdfRepo },
          { provide: DEMO_MODE, useValue: true },
          {
            provide: ActivatedRoute,
            useValue: { paramMap: of({ get: () => 'v-master' }) },
          },
          { provide: Router, useValue: { navigate: vi.fn() } },
        ],
      }).compileComponents();

      demoFixture = TestBed.createComponent(ResumeEditorComponent);
    });

    it('disables Download PDF and shows the full-app hint', async () => {
      demoFixture.detectChanges();
      await until(() => demoFixture.componentInstance.store.loading() === false);
      demoFixture.detectChanges();

      const host = demoFixture.nativeElement as HTMLElement;
      expect(demoFixture.componentInstance.pdfDisabled()).toBe(true);
      const allButtons = Array.from(host.querySelectorAll('button'));
      const downloadButton = allButtons.find((b) => b.textContent?.trim() === 'Download PDF');
      expect(downloadButton).toBeTruthy();
      expect(downloadButton?.disabled).toBe(true);
      expect(downloadButton?.getAttribute('aria-describedby')).toBe('editor-pdf-demo-hint');
      expect(downloadButton?.getAttribute('title')).toBe(
        'PDF download requires the local backend. Start the full application to export your resume.',
      );
      expect(host.textContent).toContain(
        'PDF download requires the local backend. Start the full application to export your resume.',
      );
      expect(demoFixture.componentInstance.pdfState()).toBe('idle');
    });

    it('never calls the export repository in demo mode', async () => {
      demoFixture.detectChanges();
      await until(() => demoFixture.componentInstance.store.loading() === false);
      demoFixture.detectChanges();

      await demoFixture.componentInstance.downloadPdf();
      expect(demoPdfRepo.exportPdf).not.toHaveBeenCalled();
      expect(demoFixture.componentInstance.pdfState()).toBe('idle');
    });
  });
});
