import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditorExperienceFormComponent } from './editor-experience-form.component';
import { ExperienceEntry } from '../../core/models/resume.model';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const seeded: ExperienceEntry[] = [
  {
    id: 'e-1',
    company: 'Acme Tech',
    role: 'Full-Stack Developer',
    location: 'Bengaluru',
    startDate: '2021-01',
    endDate: '',
    current: true,
    bullets: ['Built Angular dashboards.', 'Wrote Node APIs.'],
  },
];

describe('EditorExperienceFormComponent', () => {
  let fixture: ComponentFixture<EditorExperienceFormComponent>;
  let component: EditorExperienceFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditorExperienceFormComponent],
    }).compileComponents();
  });

  function create(experiences: ExperienceEntry[] = []): void {
    fixture = TestBed.createComponent(EditorExperienceFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('experiences', structuredClone(experiences));
    fixture.detectChanges();
  }

  it('emits seeded entries on load without duplicating', async () => {
    const emitted: ExperienceEntry[][] = [];
    create(seeded);
    component.experiencesChange.subscribe((v) => emitted.push(v));
    await wait(10);
    fixture.detectChanges();
    expect(component.entries.length).toBe(1);
    expect(component.entries.at(0).value.role).toBe('Full-Stack Developer');
    expect(emitted.length).toBe(0);
  });

  it('adds and removes experience entries', () => {
    create(seeded);
    const emitted: ExperienceEntry[][] = [];
    component.experiencesChange.subscribe((v) => emitted.push(v));

    component.addEntry();
    expect(component.entries.length).toBe(2);

    component.removeEntry(1);
    expect(component.entries.length).toBe(1);
    expect(emitted.some((v) => v.length === 1)).toBe(true);
  });

  it('reorders experience entries and preserves bullets', () => {
    const two: ExperienceEntry[] = [
      { ...seeded[0], id: 'a' },
      { ...seeded[0], id: 'b', company: 'Second Corp' },
    ];
    create(two);
    const emitted: ExperienceEntry[][] = [];
    component.experiencesChange.subscribe((v) => emitted.push(v));

    component.moveEntry(0, 1);
    fixture.detectChanges();
    const result = emitted[emitted.length - 1];
    expect(result[0].company).toBe('Second Corp');
    expect(result[1].id).toBe('a');
    expect(result[0].bullets).toEqual(['Built Angular dashboards.', 'Wrote Node APIs.']);
  });

  it('disables and clears end date when current role is toggled on', () => {
    create(seeded);
    const group = component.entries.at(0);
    group.controls['current'].setValue(true);
    fixture.detectChanges();
    expect(group.controls['endDate'].value).toBe('');
    expect(group.controls['endDate'].disabled).toBe(true);
  });

  it('enables end date and preserves it when current role is toggled off', () => {
    create(seeded);
    const group = component.entries.at(0);
    group.controls['current'].setValue(false);
    fixture.detectChanges();
    expect(group.controls['endDate'].disabled).toBe(false);
  });

  it('flags end date before start date as invalid', () => {
    create(seeded);
    const group = component.entries.at(0);
    group.controls['current'].setValue(false);
    group.controls['startDate'].setValue('2023-06');
    group.controls['endDate'].setValue('2022-01');
    fixture.detectChanges();
    expect(group.hasError('endBeforeStart')).toBe(true);
  });

  it('allows end date after start date', () => {
    create(seeded);
    const group = component.entries.at(0);
    group.controls['current'].setValue(false);
    group.controls['startDate'].setValue('2021-01');
    group.controls['endDate'].setValue('2022-12');
    fixture.detectChanges();
    expect(group.hasError('endBeforeStart')).toBe(false);
  });

  it('rejects empty bullets in emitted content', () => {
    create(seeded);
    const emitted: ExperienceEntry[][] = [];
    component.experiencesChange.subscribe((v) => emitted.push(v));

    const bullets = component.bulletsOf(component.entries.at(0));
    component.addBullet(component.entries.at(0));
    bullets.at(bullets.length - 1).setValue('   ');
    fixture.detectChanges();

    const result = emitted[emitted.length - 1];
    expect(result[0].bullets).toEqual(['Built Angular dashboards.', 'Wrote Node APIs.']);
  });

  it('reorders bullets within an entry', () => {
    create(seeded);
    const emitted: ExperienceEntry[][] = [];
    component.experiencesChange.subscribe((v) => emitted.push(v));

    component.moveBullet(component.entries.at(0), 0, 1);
    fixture.detectChanges();
    const result = emitted[emitted.length - 1];
    expect(result[0].bullets[0]).toBe('Wrote Node APIs.');
    expect(result[0].bullets[1]).toBe('Built Angular dashboards.');
  });

  it('adds a bullet with an empty value left blank', () => {
    create(seeded);
    component.addBullet(component.entries.at(0));
    const bullets = component.bulletsOf(component.entries.at(0));
    expect(bullets.length).toBe(3);
    expect(bullets.at(2).value).toBe('');
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

  it('does not emit an unsaved draft', () => {
    create(seeded);
    const emitted: ExperienceEntry[][] = [];
    component.experiencesChange.subscribe((v) => emitted.push(v));
    component.addEntry();
    const draft = component.entries.at(1);
    draft.controls['company'].setValue('Draft Corp');
    draft.controls['role'].setValue('Intern');
    draft.controls['endDate'].setValue('2024-01');
    draft.controls['current'].setValue(true);
    draft.controls['current'].setValue(true);
    fixture.detectChanges();
    const last = emitted[emitted.length - 1];
    expect(last.every((e) => e.id !== draft.controls['id'].value)).toBe(true);
  });

  it('saves a draft and emits the committed entry', () => {
    create(seeded);
    const emitted: ExperienceEntry[][] = [];
    component.experiencesChange.subscribe((v) => emitted.push(v));
    component.addEntry();
    const draft = component.entries.at(1);
    draft.controls['company'].setValue('Draft Corp');
    draft.controls['role'].setValue('Intern');
    draft.controls['endDate'].setValue('2024-01');
    component.addBullet(draft);
    const bullets = component.bulletsOf(draft);
    bullets.at(0).setValue('Automated testing.');
    component.saveDraft(draft);
    fixture.detectChanges();
    expect(component.isDraft(draft)).toBe(false);
    const last = emitted[emitted.length - 1];
    const saved = last.find((e) => e.id === draft.controls['id'].value);
    expect(saved?.company).toBe('Draft Corp');
    expect(saved?.bullets).toEqual(['Automated testing.']);
  });

  it('cancels a draft without emitting it', () => {
    create(seeded);
    const emitted: ExperienceEntry[][] = [];
    component.experiencesChange.subscribe((v) => emitted.push(v));
    component.addEntry();
    component.cancelDraft(component.entries.at(1));
    fixture.detectChanges();
    expect(component.entries.length).toBe(1);
    expect(emitted[emitted.length - 1].length).toBe(1);
  });

  it('edits a committed entry and emits the change', () => {
    create(seeded);
    const emitted: ExperienceEntry[][] = [];
    component.experiencesChange.subscribe((v) => emitted.push(v));
    const group = component.entries.at(0);
    group.controls['role'].setValue('Senior Full-Stack Developer');
    fixture.detectChanges();
    const last = emitted[emitted.length - 1];
    expect(last.find((e) => e.id === 'e-1')?.role).toBe('Senior Full-Stack Developer');
  });
});
