import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ANALYSIS_REPOSITORY } from '../../core/repositories/repository.providers';
import { AtsAnalysis } from '../../core/models/ats.model';
import { emptyContent } from '../../core/repositories/mock/fixtures';
import { buildAtsAnalysisFixture } from '../../core/repositories/mock/fixtures';
import { ApiError } from '../../core/repositories/http/api-client';
import { AtsAnalysisPanelComponent } from './ats-analysis-panel.component';

function analysisFor(overrides: Partial<AtsAnalysis> = {}): AtsAnalysis {
  return { ...buildAtsAnalysisFixture(), versionId: 'v-master', ...overrides };
}

function fakeRepo(behavior: {
  result?: AtsAnalysis;
  error?: unknown;
  stream?: Observable<AtsAnalysis>;
}) {
  return {
    runAtsAnalysis: vi.fn(() => {
      if (behavior.stream) {
        return behavior.stream;
      }
      if (behavior.error) {
        return throwError(() => behavior.error);
      }
      return of(behavior.result ?? analysisFor());
    }),
  };
}

describe('AtsAnalysisPanelComponent', () => {
  let fixture: ComponentFixture<AtsAnalysisPanelComponent>;
  let repo: ReturnType<typeof fakeRepo>;

  function mount(behavior: Parameters<typeof fakeRepo>[0] = {}) {
    repo = fakeRepo(behavior);
    TestBed.configureTestingModule({
      imports: [AtsAnalysisPanelComponent],
      providers: [{ provide: ANALYSIS_REPOSITORY, useValue: repo }],
    });
    fixture = TestBed.createComponent(AtsAnalysisPanelComponent);
    fixture.componentRef.setInput('versionId', 'v-master');
    fixture.componentRef.setInput('templateId', 't-classic-ats-navy');
    fixture.componentRef.setInput('content', emptyContent);
    fixture.detectChanges();
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('shows an idle state with a Run analysis action', () => {
    mount();
    expect(text()).toContain('ATS analysis');
    expect(text()).toContain('Run analysis');
    expect(text()).toContain('Run the ATS check');
  });

  it('shows a loading status while the request is in flight', async () => {
    const pending = new Subject<AtsAnalysis>();
    mount({ stream: pending.asObservable() });
    fixture.componentInstance.runAnalysis();
    fixture.detectChanges();
    expect(text()).toContain('Analysing your resume');
    pending.complete();
  });

  it('requests the repository with the version id', () => {
    mount();
    fixture.componentInstance.runAnalysis();
    expect(repo.runAtsAnalysis).toHaveBeenCalledWith('v-master');
  });

  it('renders the overall score with an accessible progressbar label', () => {
    const result = analysisFor({ overallScore: 90 });
    mount({ result });
    fixture.componentInstance.runAnalysis();
    fixture.detectChanges();

    expect(text()).toContain('90');
    expect(text()).toContain('/ 100');
    const score = fixture.nativeElement.querySelector('.ats-score') as HTMLElement;
    expect(score?.getAttribute('role')).toBe('progressbar');
    expect(score?.getAttribute('aria-valuenow')).toBe('90');
    expect(score?.getAttribute('aria-label')).toContain('Overall ATS score: 90 out of 100');
  });

  it('renders severity counts as text, not color alone', () => {
    const result = analysisFor({
      summary: { errors: 1, warnings: 2, info: 1 },
    });
    mount({ result });
    fixture.componentInstance.runAnalysis();
    fixture.detectChanges();

    expect(text()).toContain('1 error');
    expect(text()).toContain('2 warnings');
    expect(text()).toContain('1 info');
  });

  it('renders category scores with accessible labels', () => {
    mount();
    fixture.componentInstance.runAnalysis();
    fixture.detectChanges();

    const category = fixture.nativeElement.querySelector('.ats-category__bar') as HTMLElement;
    expect(category?.getAttribute('role')).toBe('progressbar');
    expect(category?.getAttribute('aria-label')).toContain('percent');
    expect(category?.getAttribute('aria-valuenow')).toBe('100');
  });

  it('orders findings by severity then impact', () => {
    const result = analysisFor({
      findings: [
        {
          code: 'contact.email.missing',
          severity: 'error',
          category: 'contact',
          section: 'Contact',
          message: 'No email.',
          suggestion: 'Add it.',
          pointsLost: 5,
        },
        ...buildAtsAnalysisFixture().findings,
      ],
    });
    mount({ result });
    fixture.componentInstance.runAnalysis();
    fixture.detectChanges();

    const items = Array.from(
      fixture.nativeElement.querySelectorAll('.ats-finding') as NodeListOf<HTMLElement>,
    );
    const severities = items.map((item) =>
      (item.querySelector('.ats-finding__severity')?.textContent ?? '').trim().toLowerCase(),
    );
    expect(severities[0]).toBe('error');
    expect(severities.slice(1)).toContain('warning');
    expect(severities.at(-1)).toBe('info');
  });

  it('shows severity labels as text', () => {
    mount();
    fixture.componentInstance.runAnalysis();
    fixture.detectChanges();
    expect(text()).toContain('Warning');
    expect(text()).toContain('Info');
  });

  it('shows a clean state when the report has no findings', () => {
    mount({ result: analysisFor({ findings: [], summary: { errors: 0, warnings: 0, info: 0 } }) });
    fixture.componentInstance.runAnalysis();
    fixture.detectChanges();
    expect(text()).toContain('No issues found');
  });

  it('shows an error state with the repository message', () => {
    mount({ error: new Error('Could not analyse the version.') });
    fixture.componentInstance.runAnalysis();
    fixture.detectChanges();
    expect(text()).toContain('Could not run the ATS check');
    expect(text()).toContain('Could not analyse the version.');
  });

  it('shows a session-expired message on 401', () => {
    mount({ error: new ApiError('Unauthorized', 401) });
    fixture.componentInstance.runAnalysis();
    fixture.detectChanges();
    expect(text()).toContain('session has expired');
  });

  it('marks the result stale when content changes after analysis', async () => {
    mount();
    fixture.componentInstance.runAnalysis();
    fixture.detectChanges();
    expect(text()).not.toContain('Content changed since this analysis');

    fixture.componentRef.setInput('content', {
      ...emptyContent,
      summary: 'Changed after analysis',
    });
    fixture.detectChanges();
    await fixture.whenStable();
    expect(text()).toContain('Content changed since this analysis');
  });

  it('resets to idle when the version changes', async () => {
    mount();
    fixture.componentInstance.runAnalysis();
    fixture.detectChanges();
    expect(text()).toContain('/ 100');

    fixture.componentRef.setInput('versionId', 'v-other');
    fixture.detectChanges();
    await fixture.whenStable();
    expect(text()).toContain('Run the ATS check');
    expect(text()).not.toContain('/ 100');
  });

  it('shows a "Focus first issue" action for a low score and emits the top finding', () => {
    const result = analysisFor({
      overallScore: 17,
      findings: [
        {
          code: 'contact.details.missing',
          severity: 'error',
          category: 'contact',
          section: 'Contact',
          message: 'No contact details are listed.',
          suggestion: 'Add your details.',
          pointsLost: 15,
        },
        {
          code: 'links.missing',
          severity: 'warning',
          category: 'links',
          section: 'Links',
          message: 'No profile links are listed.',
          suggestion: 'Add a LinkedIn or GitHub URL.',
          pointsLost: 5,
        },
      ],
      summary: { errors: 1, warnings: 1, info: 0 },
    });
    mount({ result });

    const emitted: AtsAnalysis['findings'] = [];
    fixture.componentInstance.improveRequested.subscribe((finding) => emitted.push(finding));
    fixture.componentInstance.runAnalysis();
    fixture.detectChanges();

    expect(text()).toContain('Focus first issue');
    const button = fixture.nativeElement.querySelector(
      '.ats-panel__actions app-button button',
    ) as HTMLButtonElement;
    button.click();
    expect(emitted).toHaveLength(1);
    expect(emitted[0].code).toBe('contact.details.missing');
  });

  it('hides the "Focus first issue" action when the score is strong', () => {
    mount();
    fixture.componentInstance.runAnalysis();
    fixture.detectChanges();
    expect(text()).not.toContain('Focus first issue');
  });
});
