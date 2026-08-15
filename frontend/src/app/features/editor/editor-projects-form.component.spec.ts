import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditorProjectsFormComponent } from './editor-projects-form.component';
import { ProjectEntry } from '../../core/models/resume.model';

const seeded: ProjectEntry[] = [
  {
    id: 'p-1',
    name: 'Employee Management System',
    role: 'Full-Stack Developer',
    startDate: '2021-03',
    endDate: '',
    description: 'Full-stack HR app.',
    technologies: 'Angular, Node.js',
    link: 'https://github.com/arunkumar/ems',
    bullets: ['Built CRUD APIs.'],
  },
];

describe('EditorProjectsFormComponent', () => {
  let fixture: ComponentFixture<EditorProjectsFormComponent>;
  let component: EditorProjectsFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditorProjectsFormComponent],
    }).compileComponents();
  });

  function create(projects: ProjectEntry[] = []): void {
    fixture = TestBed.createComponent(EditorProjectsFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('projects', structuredClone(projects));
    fixture.detectChanges();
  }

  it('renders seeded project entries', () => {
    create(seeded);
    expect(component.entries.length).toBe(1);
    expect(component.entries.at(0).value.name).toBe('Employee Management System');
  });

  it('adds and removes projects', () => {
    create(seeded);
    const emitted: ProjectEntry[][] = [];
    component.projectsChange.subscribe((v) => emitted.push(v));

    component.addEntry();
    expect(component.entries.length).toBe(2);
    component.removeEntry(0);
    expect(component.entries.length).toBe(1);
    expect(emitted.length).toBeGreaterThan(0);
  });

  it('reorders projects', () => {
    const two: ProjectEntry[] = [
      { ...seeded[0], id: 'a', name: 'Project A' },
      { ...seeded[0], id: 'b', name: 'Project B' },
    ];
    create(two);
    const emitted: ProjectEntry[][] = [];
    component.projectsChange.subscribe((v) => emitted.push(v));

    component.moveEntry(0, 1);
    fixture.detectChanges();
    const result = emitted[emitted.length - 1];
    expect(result[0].name).toBe('Project B');
    expect(result[1].name).toBe('Project A');
  });

  it('flags an invalid project URL', () => {
    create(seeded);
    const group = component.entries.at(0);
    group.controls['link'].setValue('not a url');
    group.controls['link'].markAsTouched();
    fixture.detectChanges();
    expect(group.controls['link'].hasError('invalidUrl')).toBe(true);
  });

  it('accepts a valid https URL', () => {
    create(seeded);
    const group = component.entries.at(0);
    group.controls['link'].setValue('https://github.com/arunkumar');
    group.controls['link'].markAsTouched();
    fixture.detectChanges();
    expect(group.controls['link'].hasError('invalidUrl')).toBe(false);
  });

  it('flags end date before start date', () => {
    create(seeded);
    const group = component.entries.at(0);
    group.controls['startDate'].setValue('2023-01');
    group.controls['endDate'].setValue('2022-01');
    fixture.detectChanges();
    expect(group.hasError('endBeforeStart')).toBe(true);
  });

  it('rejects empty project bullets in emitted content', () => {
    create(seeded);
    const emitted: ProjectEntry[][] = [];
    component.projectsChange.subscribe((v) => emitted.push(v));

    component.addBullet(component.entries.at(0));
    const bullets = component.bulletsOf(component.entries.at(0));
    bullets.at(bullets.length - 1).setValue('  ');
    fixture.detectChanges();

    const result = emitted[emitted.length - 1];
    expect(result[0].bullets).toEqual(['Built CRUD APIs.']);
  });

  it('reorders project bullets', () => {
    create(seeded);
    const emitted: ProjectEntry[][] = [];
    component.projectsChange.subscribe((v) => emitted.push(v));

    const bullets = component.bulletsOf(component.entries.at(0));
    bullets.push(bullets.at(0));
    component.moveBullet(component.entries.at(0), 1, -1);
    fixture.detectChanges();
    const result = emitted[emitted.length - 1];
    expect(result[0].bullets[0]).toBe('Built CRUD APIs.');
  });

  it('opens a draft entry when add is clicked and keeps it on repeated clicks', () => {
    create(seeded);
    component.addEntry();
    component.addEntry();
    fixture.detectChanges();
    expect(component.entries.length).toBe(2);
    const drafts = component.entries.controls.filter((g) => component.isDraft(g));
    expect(drafts.length).toBe(1);
    expect(component.isDraft(component.entries.at(1))).toBe(true);
  });

  it('saves a draft and emits the committed entry', () => {
    create(seeded);
    const emitted: ProjectEntry[][] = [];
    component.projectsChange.subscribe((v) => emitted.push(v));
    component.addEntry();
    const draft = component.entries.at(1);
    draft.controls['name'].setValue('Portfolio Site');
    draft.controls['link'].setValue('https://example.com');
    component.saveDraft(draft);
    fixture.detectChanges();
    expect(component.isDraft(draft)).toBe(false);
    const last = emitted[emitted.length - 1];
    expect(last.map((e) => e.name)).toContain('Portfolio Site');
  });

  it('cancels a draft without emitting it', () => {
    create(seeded);
    const emitted: ProjectEntry[][] = [];
    component.projectsChange.subscribe((v) => emitted.push(v));
    component.addEntry();
    component.cancelDraft(component.entries.at(1));
    fixture.detectChanges();
    expect(component.entries.length).toBe(1);
    expect(emitted[emitted.length - 1].length).toBe(1);
  });

  it('edits a committed entry and emits the change', () => {
    create(seeded);
    const emitted: ProjectEntry[][] = [];
    component.projectsChange.subscribe((v) => emitted.push(v));
    const group = component.entries.at(0);
    group.controls['technologies'].setValue('Angular, Node.js, PostgreSQL');
    fixture.detectChanges();
    const last = emitted[emitted.length - 1];
    expect(last.find((e) => e.id === 'p-1')?.technologies).toBe('Angular, Node.js, PostgreSQL');
  });
});
