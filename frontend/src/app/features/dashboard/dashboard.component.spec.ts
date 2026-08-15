import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { vi } from 'vitest';
import { RESUME_REPOSITORY } from '../../core/repositories/repository.providers';
import { MockResumeRepository } from '../../core/repositories/mock/mock-resume.repository';
import { MockStore } from '../../core/repositories/mock/mock-store';
import { fixtures } from '../../core/repositories/mock/fixtures';
import { DashboardComponent } from './dashboard.component';

const wait = (ms = 350) => new Promise((resolve) => setTimeout(resolve, ms));

const routerMock = {
  navigate: vi.fn(),
  createUrlTree: vi.fn(() => ({ toString: () => '/resumes' })),
  serializeUrl: vi.fn((tree: { toString: () => string }) => tree.toString()),
  isActive: vi.fn(() => false),
};

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let router: Router;

  beforeEach(async () => {
    localStorage.clear();

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: RESUME_REPOSITORY, useClass: MockResumeRepository },
        { provide: Router, useValue: routerMock },
        { provide: ActivatedRoute, useValue: { snapshot: { data: {} } } },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
  });

  function create(): void {
    fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
  }

  it('renders the seeded resumes after loading', async () => {
    create();
    await wait();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Master Resume');
  });

  it('shows an empty state when there are no resumes', async () => {
    MockStore.write('resumes', []);
    create();
    await wait();
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No saved resumes yet');
  });

  it('opens the editor when a resume is clicked', async () => {
    create();
    await wait();
    fixture.detectChanges();
    const resume = fixtures.resumes[0];
    const version = fixtures.versions[0];
    fixture.componentInstance.openResume(resume);
    await wait(400);
    expect(router.navigate).toHaveBeenCalledWith([
      '/resumes',
      resume.id,
      'versions',
      version.id,
      'edit',
    ]);
  });

  it('duplicates a resume as a draft copy not shown in My Resumes', async () => {
    create();
    await wait();
    fixture.detectChanges();
    fixture.componentInstance.cloneResume(fixtures.resumes[0]);
    await wait(700);
    const resumes = MockStore.read<{ name: string; status: string }[]>('resumes', []);
    const copy = resumes.find((r) => r.name.includes('(copy)'));
    expect(copy).toBeTruthy();
    expect(copy?.status).toBe('draft');
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).not.toContain('(copy)');
  });

  it('deletes a resume via the confirm dialog', async () => {
    create();
    await wait();
    fixture.detectChanges();

    fixture.componentInstance.askDelete(fixtures.resumes[0]);
    fixture.detectChanges();
    expect(fixture.componentInstance.deleteTarget()).not.toBeNull();

    fixture.componentInstance.confirmDelete();
    await wait(700);
    fixture.detectChanges();
    expect(fixture.componentInstance.deleteTarget()).toBeNull();
    expect(fixture.componentInstance.visibleResumes().length).toBe(0);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('No saved resumes yet');
  });

  it('navigates to /templates when creating a resume instead of silently creating a default one', async () => {
    create();
    await wait();
    fixture.detectChanges();
    const before = MockStore.read<unknown[]>('resumes', []);
    fixture.componentInstance.createResume();
    await wait(50);
    expect(router.navigate).toHaveBeenCalledWith(['/templates']);
    const after = MockStore.read<unknown[]>('resumes', []);
    expect(after.length).toBe(before.length);
  });
});
