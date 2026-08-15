import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { analyzeJobMatch } from '../../../../../shared/job-matcher';
import { fixtures } from '../../core/repositories/mock/fixtures';
import {
  JOB_MATCH_REPOSITORY,
  RESUME_REPOSITORY,
} from '../../core/repositories/repository.providers';
import { JobMatcherComponent } from './job-matcher.component';

const description =
  'Angular, TypeScript, JavaScript, REST APIs, Node.js, AWS, testing and CI/CD are required. Docker is preferred. The candidate must build accessible and reliable applications, collaborate with product teams, review code, document decisions, improve performance, and deliver measurable customer outcomes.';

describe('JobMatcherComponent', () => {
  const version = fixtures.versions[0];
  const result = analyzeJobMatch({
    content: version.content,
    versionId: version.id,
    templateId: version.templateId,
    jobTitle: 'Senior Angular Developer',
    company: 'Northstar',
    jobDescription: description,
  });
  const resumeRepo = {
    list: vi.fn(() => of(fixtures.resumes)),
    listVersions: vi.fn(() => of([version])),
  };
  const matchRepo = { analyze: vi.fn(() => of(result)) };
  const router = { navigate: vi.fn() };

  beforeEach(async () => {
    sessionStorage.clear();
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [JobMatcherComponent],
      providers: [
        { provide: RESUME_REPOSITORY, useValue: resumeRepo },
        { provide: JOB_MATCH_REPOSITORY, useValue: matchRepo },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();
  });
  it('shows labelled empty inputs and rejects blank or oversized descriptions', () => {
    const fixture = TestBed.createComponent(JobMatcherComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.analyse();
    expect(component.form.controls.jobTitle.invalid).toBe(true);
    expect(component.form.controls.jobDescription.invalid).toBe(true);
    component.form.controls.jobDescription.setValue('x'.repeat(15001));
    expect(component.form.controls.jobDescription.invalid).toBe(true);
    expect((fixture.nativeElement as HTMLElement).querySelector('label')?.textContent).toContain(
      'Resume',
    );
  });
  it('treats pasted HTML as textarea text and never creates executable markup', () => {
    const fixture = TestBed.createComponent(JobMatcherComponent);
    fixture.detectChanges();
    const value = `<script>globalThis.pwned=true</script> ${description}`;
    fixture.componentInstance.form.controls.jobDescription.setValue(value);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('script')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('textarea')?.value).toContain(
      '<script>',
    );
  });
  it('renders numeric accessible results and evidence', () => {
    const fixture = TestBed.createComponent(JobMatcherComponent);
    fixture.detectChanges();
    fixture.componentInstance.form.patchValue({
      jobTitle: 'Senior Angular Developer',
      company: 'Northstar',
      jobDescription: description,
    });
    fixture.componentInstance.analyse();
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.textContent).toContain('/100');
    expect(host.textContent).toContain('Matched requirements');
    expect(host.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe(
      String(result.overallScore),
    );
    expect(matchRepo.analyze).toHaveBeenCalledWith(
      version.id,
      expect.objectContaining({ jobTitle: 'Senior Angular Developer' }),
    );
  });
  it('marks a completed result stale when input changes and opens the selected editor', () => {
    const fixture = TestBed.createComponent(JobMatcherComponent);
    fixture.detectChanges();
    fixture.componentInstance.form.patchValue({
      jobTitle: 'Senior Angular Developer',
      jobDescription: description,
    });
    fixture.componentInstance.analyse();
    fixture.componentInstance.inputChanged();
    expect(fixture.componentInstance.stale()).toBe(true);
    fixture.componentInstance.editResume();
    expect(router.navigate).toHaveBeenCalledWith([
      '/resumes',
      version.resumeId,
      'versions',
      version.id,
      'edit',
    ]);
  });
});
