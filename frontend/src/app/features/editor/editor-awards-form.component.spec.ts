import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { RESUME_REPOSITORY } from '../../core/repositories/repository.providers';
import { MockResumeRepository } from '../../core/repositories/mock/mock-resume.repository';
import { AwardEntry } from '../../core/models/resume.model';
import { EditorAwardsFormComponent } from './editor-awards-form.component';

const seeded: AwardEntry[] = [
  {
    id: 'a-1',
    title: 'Best Paper Award',
    issuer: 'IEEE',
    date: '2023-06',
    description: 'Awarded for the best research paper.',
  },
];

describe('EditorAwardsFormComponent', () => {
  let fixture: ComponentFixture<EditorAwardsFormComponent>;
  let component: EditorAwardsFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditorAwardsFormComponent],
      providers: [{ provide: RESUME_REPOSITORY, useClass: MockResumeRepository }],
    }).compileComponents();
  });

  function create(awards: AwardEntry[] = []): void {
    fixture = TestBed.createComponent(EditorAwardsFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('awards', structuredClone(awards));
    fixture.detectChanges();
  }

  it('renders seeded award entries', () => {
    create(seeded);
    expect(component.entries.length).toBe(1);
    expect(component.entries.at(0).value.title).toBe('Best Paper Award');
  });

  it('opens a draft when add is clicked', () => {
    create(seeded);
    component.addEntry();
    fixture.detectChanges();
    expect(component.entries.length).toBe(2);
    expect(component.isDraft(component.entries.at(1))).toBe(true);
  });

  it('does not create duplicate drafts on repeated add clicks', () => {
    create(seeded);
    component.addEntry();
    component.addEntry();
    fixture.detectChanges();
    expect(component.entries.length).toBe(2);
    const drafts = component.entries.controls.filter((g) => component.isDraft(g));
    expect(drafts.length).toBe(1);
  });

  it('saves a draft and emits the committed entry', () => {
    create(seeded);
    const emitted: AwardEntry[][] = [];
    component.awardsChange.subscribe((v) => emitted.push(v));
    component.addEntry();
    const draft = component.entries.at(1) as FormGroup;
    draft.controls['title'].setValue('Hackathon Winner');
    draft.controls['issuer'].setValue('HackerEarth');
    component.saveDraft(draft);
    fixture.detectChanges();
    expect(component.isDraft(draft)).toBe(false);
    const last = emitted[emitted.length - 1];
    expect(last.map((e) => e.title)).toContain('Hackathon Winner');
  });

  it('does not emit an unsaved draft', () => {
    create(seeded);
    const emitted: AwardEntry[][] = [];
    component.awardsChange.subscribe((v) => emitted.push(v));
    component.addEntry();
    const draft = component.entries.at(1) as FormGroup;
    draft.controls['title'].setValue('Draft Award');
    fixture.detectChanges();
    const last = emitted[emitted.length - 1];
    expect(last.every((e) => e.id !== draft.controls['id'].value)).toBe(true);
  });

  it('cancels a draft without emitting it', () => {
    create(seeded);
    const emitted: AwardEntry[][] = [];
    component.awardsChange.subscribe((v) => emitted.push(v));
    component.addEntry();
    component.cancelDraft(component.entries.at(1));
    fixture.detectChanges();
    expect(component.entries.length).toBe(1);
    expect(emitted[emitted.length - 1].length).toBe(1);
  });

  it('removes an entry', () => {
    create(seeded);
    const emitted: AwardEntry[][] = [];
    component.awardsChange.subscribe((v) => emitted.push(v));
    component.removeEntry(0);
    fixture.detectChanges();
    expect(component.entries.length).toBe(0);
    expect(emitted[emitted.length - 1].length).toBe(0);
  });

  it('reorders entries', () => {
    const two: AwardEntry[] = [
      { ...seeded[0], id: 'a', title: 'Award A' },
      { ...seeded[0], id: 'b', title: 'Award B' },
    ];
    create(two);
    const emitted: AwardEntry[][] = [];
    component.awardsChange.subscribe((v) => emitted.push(v));

    component.moveEntry(0, 1);
    fixture.detectChanges();
    const result = emitted[emitted.length - 1];
    expect(result[0].title).toBe('Award B');
    expect(result[1].title).toBe('Award A');
  });

  it('edits a committed entry and emits the change', () => {
    create(seeded);
    const emitted: AwardEntry[][] = [];
    component.awardsChange.subscribe((v) => emitted.push(v));
    const group = component.entries.at(0) as FormGroup;
    group.controls['issuer'].setValue('ACM');
    fixture.detectChanges();
    const last = emitted[emitted.length - 1];
    expect(last.find((e) => e.id === 'a-1')?.issuer).toBe('ACM');
  });

  it('rejects empty award title', () => {
    create(seeded);
    component.addEntry();
    const group = component.entries.at(1) as FormGroup;
    group.controls['title'].setValue('');
    fixture.detectChanges();
    expect(group.controls['title'].hasError('required')).toBe(true);
  });

  it('limits description to 500 characters', () => {
    create(seeded);
    component.addEntry();
    const group = component.entries.at(1) as FormGroup;
    group.controls['description'].setValue('x'.repeat(501));
    fixture.detectChanges();
    expect(group.controls['description'].hasError('maxlength')).toBe(true);
  });

  it('keeps empty drafts out of emitted content', () => {
    create(seeded);
    const emitted: AwardEntry[][] = [];
    component.awardsChange.subscribe((v) => emitted.push(v));
    component.addEntry();
    fixture.detectChanges();
    const last = emitted[emitted.length - 1];
    expect(last).toBeDefined();
    expect(last.every((e) => e.title.trim().length > 0)).toBe(true);
  });
});
