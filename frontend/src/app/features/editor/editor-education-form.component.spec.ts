import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EditorEducationFormComponent } from './editor-education-form.component';
import { EducationEntry } from '../../core/models/resume.model';

const seeded: EducationEntry[] = [
  {
    id: 'edu-1',
    institution: 'Anna University',
    degree: 'B.E.',
    field: 'Computer Science',
    startDate: '2015-08',
    endDate: '2019-05',
    gpa: '8.2',
  },
];

describe('EditorEducationFormComponent', () => {
  let fixture: ComponentFixture<EditorEducationFormComponent>;
  let component: EditorEducationFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditorEducationFormComponent],
    }).compileComponents();
  });

  function create(education: EducationEntry[] = []): void {
    fixture = TestBed.createComponent(EditorEducationFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('education', structuredClone(education));
    fixture.detectChanges();
  }

  it('renders seeded education entries', () => {
    create(seeded);
    expect(component.entries.length).toBe(1);
    expect(component.entries.at(0).value.institution).toBe('Anna University');
  });

  it('adds and removes education entries', () => {
    create(seeded);
    const emitted: EducationEntry[][] = [];
    component.educationChange.subscribe((v) => emitted.push(v));

    component.addEntry();
    expect(component.entries.length).toBe(2);
    component.removeEntry(0);
    expect(component.entries.length).toBe(1);
    expect(emitted.length).toBeGreaterThan(0);
  });

  it('reorders education entries', () => {
    const two: EducationEntry[] = [
      { ...seeded[0], id: 'a', institution: 'School A' },
      { ...seeded[0], id: 'b', institution: 'School B' },
    ];
    create(two);
    const emitted: EducationEntry[][] = [];
    component.educationChange.subscribe((v) => emitted.push(v));

    component.moveEntry(0, 1);
    fixture.detectChanges();
    const result = emitted[emitted.length - 1];
    expect(result[0].institution).toBe('School B');
  });

  it('flags end date before start date', () => {
    create(seeded);
    const group = component.entries.at(0);
    group.controls['startDate'].setValue('2020-01');
    group.controls['endDate'].setValue('2019-01');
    fixture.detectChanges();
    expect(group.hasError('endBeforeStart')).toBe(true);
  });

  it('keeps optional gpa field valid when blank', () => {
    create(seeded);
    const group = component.entries.at(0);
    group.controls['gpa'].setValue('');
    fixture.detectChanges();
    expect(group.controls['gpa'].valid).toBe(true);
  });

  it('preserves an incomplete draft with a blank start date', () => {
    create(seeded);
    component.addEntry();
    const draft = component.entries.at(1);
    draft.controls['institution'].setValue('Still Draft');
    draft.controls['startDate'].setValue('');
    fixture.detectChanges();
    expect(component.entries.length).toBe(2);
    expect(component.isDraft(draft)).toBe(true);
  });

  it('saves a draft and emits the committed entry', () => {
    create(seeded);
    const emitted: EducationEntry[][] = [];
    component.educationChange.subscribe((v) => emitted.push(v));
    component.addEntry();
    const draft = component.entries.at(1);
    draft.controls['institution'].setValue('MIT');
    draft.controls['degree'].setValue('B.S.');
    component.saveDraft(draft);
    fixture.detectChanges();
    expect(component.isDraft(draft)).toBe(false);
    const last = emitted[emitted.length - 1];
    expect(last.map((e) => e.institution)).toContain('MIT');
  });

  it('cancels a draft without emitting it', () => {
    create(seeded);
    const emitted: EducationEntry[][] = [];
    component.educationChange.subscribe((v) => emitted.push(v));
    component.addEntry();
    component.cancelDraft(component.entries.at(1));
    fixture.detectChanges();
    expect(component.entries.length).toBe(1);
    expect(emitted[emitted.length - 1].length).toBe(1);
  });

  it('edits a committed entry and emits the change', () => {
    create(seeded);
    const emitted: EducationEntry[][] = [];
    component.educationChange.subscribe((v) => emitted.push(v));
    const group = component.entries.at(0);
    group.controls['gpa'].setValue('9.0');
    fixture.detectChanges();
    const last = emitted[emitted.length - 1];
    expect(last.find((e) => e.id === 'edu-1')?.gpa).toBe('9.0');
  });
});
