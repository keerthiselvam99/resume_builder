import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { RESUME_REPOSITORY } from '../../core/repositories/repository.providers';
import { MockResumeRepository } from '../../core/repositories/mock/mock-resume.repository';
import { CertificationEntry } from '../../core/models/resume.model';
import { EditorCertificationsFormComponent } from './editor-certifications-form.component';

const seeded: CertificationEntry[] = [
  {
    id: 'c-1',
    name: 'AWS Certified Developer',
    issuer: 'Amazon Web Services',
    issueDate: '2022-05',
    doesNotExpire: false,
    expiryDate: '2025-05',
    credentialId: 'AWS-123',
    credentialUrl: '',
  },
];

describe('EditorCertificationsFormComponent', () => {
  let fixture: ComponentFixture<EditorCertificationsFormComponent>;
  let component: EditorCertificationsFormComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditorCertificationsFormComponent],
      providers: [{ provide: RESUME_REPOSITORY, useClass: MockResumeRepository }],
    }).compileComponents();
  });

  function create(certs: CertificationEntry[] = []): void {
    fixture = TestBed.createComponent(EditorCertificationsFormComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('certifications', structuredClone(certs));
    fixture.detectChanges();
  }

  it('renders seeded certification entries', () => {
    create(seeded);
    expect(component.entries.length).toBe(1);
    expect(component.entries.at(0).value.name).toBe('AWS Certified Developer');
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
    component.addEntry();
    fixture.detectChanges();
    expect(component.entries.length).toBe(2);
    const drafts = component.entries.controls.filter((g) => component.isDraft(g));
    expect(drafts.length).toBe(1);
  });

  it('saves a draft and emits the committed entry', () => {
    create(seeded);
    const emitted: CertificationEntry[][] = [];
    component.certificationsChange.subscribe((v) => emitted.push(v));
    component.addEntry();
    const draft = component.entries.at(1) as FormGroup;
    draft.controls['name'].setValue('AWS Solutions Architect');
    draft.controls['issuer'].setValue('Amazon Web Services');
    component.saveDraft(draft);
    fixture.detectChanges();
    expect(component.isDraft(draft)).toBe(false);
    const last = emitted[emitted.length - 1];
    expect(last.map((e) => e.name)).toContain('AWS Solutions Architect');
  });

  it('does not emit an unsaved draft', () => {
    create(seeded);
    const emitted: CertificationEntry[][] = [];
    component.certificationsChange.subscribe((v) => emitted.push(v));
    component.addEntry();
    const draft = component.entries.at(1) as FormGroup;
    draft.controls['name'].setValue('Draft Cert');
    draft.controls['issuer'].setValue('Draft Issuer');
    fixture.detectChanges();
    const last = emitted[emitted.length - 1];
    expect(last.every((e) => e.id !== draft.controls['id'].value)).toBe(true);
  });

  it('cancels a draft without emitting it', () => {
    create(seeded);
    const emitted: CertificationEntry[][] = [];
    component.certificationsChange.subscribe((v) => emitted.push(v));
    component.addEntry();
    component.cancelDraft(component.entries.at(1));
    fixture.detectChanges();
    expect(component.entries.length).toBe(1);
    expect(emitted[emitted.length - 1].length).toBe(1);
  });

  it('removes an entry', () => {
    create(seeded);
    const emitted: CertificationEntry[][] = [];
    component.certificationsChange.subscribe((v) => emitted.push(v));
    component.removeEntry(0);
    fixture.detectChanges();
    expect(component.entries.length).toBe(0);
    expect(emitted[emitted.length - 1].length).toBe(0);
  });

  it('reorders entries', () => {
    const two: CertificationEntry[] = [
      { ...seeded[0], id: 'a', name: 'Cert A' },
      { ...seeded[0], id: 'b', name: 'Cert B' },
    ];
    create(two);
    const emitted: CertificationEntry[][] = [];
    component.certificationsChange.subscribe((v) => emitted.push(v));

    component.moveEntry(0, 1);
    fixture.detectChanges();
    const result = emitted[emitted.length - 1];
    expect(result[0].name).toBe('Cert B');
    expect(result[1].name).toBe('Cert A');
  });

  it('edits a committed entry and emits the change', () => {
    create(seeded);
    const emitted: CertificationEntry[][] = [];
    component.certificationsChange.subscribe((v) => emitted.push(v));
    const group = component.entries.at(0) as FormGroup;
    group.controls['credentialId'].setValue('AWS-999');
    fixture.detectChanges();
    const last = emitted[emitted.length - 1];
    expect(last.find((e) => e.id === 'c-1')?.credentialId).toBe('AWS-999');
  });

  it('disables expiry date when doesNotExpire is checked', () => {
    create(seeded);
    component.addEntry();
    const group = component.entries.at(1) as FormGroup;
    group.controls['doesNotExpire'].setValue(true);
    component.onDoesNotExpireChange(group);
    fixture.detectChanges();
    expect(group.controls['expiryDate'].disabled).toBe(true);
    expect(group.controls['expiryDate'].value).toBe('');
  });

  it('re-enables expiry date when doesNotExpire is unchecked', () => {
    create(seeded);
    component.addEntry();
    const group = component.entries.at(1) as FormGroup;
    group.controls['doesNotExpire'].setValue(true);
    component.onDoesNotExpireChange(group);
    fixture.detectChanges();
    group.controls['doesNotExpire'].setValue(false);
    component.onDoesNotExpireChange(group);
    fixture.detectChanges();
    expect(group.controls['expiryDate'].disabled).toBe(false);
  });

  it('rejects empty certification name', () => {
    create(seeded);
    component.addEntry();
    const group = component.entries.at(1) as FormGroup;
    group.controls['name'].setValue('');
    fixture.detectChanges();
    expect(group.controls['name'].hasError('required')).toBe(true);
  });

  it('keeps empty drafts out of emitted content', () => {
    create(seeded);
    const emitted: CertificationEntry[][] = [];
    component.certificationsChange.subscribe((v) => emitted.push(v));
    component.addEntry();
    fixture.detectChanges();
    const last = emitted[emitted.length - 1];
    expect(last).toBeDefined();
    const empty = last.filter((e) => e.name.trim() === '' && e.issuer.trim() === '');
    expect(empty.length).toBe(0);
  });
});
