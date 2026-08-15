import { Observable } from 'rxjs';
import { ResumeRepository, CreateResumeRequest } from '../resume.repository';
import { Resume, ResumeVersion, ResumeContent } from '../../models/resume.model';
import { MockStore, mockResponse, mockError } from './mock-store';
import { fixtures, emptyContent } from './fixtures';
import { TemplateRegistry } from '../../templates/template-registry';

export class MockResumeRepository implements ResumeRepository {
  private resumesKey = 'resumes';
  private versionsKey = 'versions';
  private readonly registry = new TemplateRegistry();

  list(): Observable<Resume[]> {
    const resumes = MockStore.read(this.resumesKey, fixtures.resumes);
    return mockResponse(resumes);
  }

  get(id: string): Observable<Resume | null> {
    const resumes = MockStore.read(this.resumesKey, fixtures.resumes);
    return mockResponse(resumes.find((r) => r.id === id) ?? null);
  }

  create(request: CreateResumeRequest): Observable<Resume> {
    const resumes = MockStore.read(this.resumesKey, fixtures.resumes);
    const now = new Date().toISOString();
    const template = this.registry.get(request.templateId);
    const resume: Resume = {
      id: MockStore.generateId(),
      userId: resumes[0]?.userId ?? fixtures.resumes[0]?.userId ?? 'u-demo',
      name: request.name,
      primary: false,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };

    const masterVersion: ResumeVersion = {
      id: MockStore.generateId(),
      resumeId: resume.id,
      name: 'Master Resume',
      published: false,
      isMaster: true,
      isTailored: false,
      templateId: template.id,
      createdAt: now,
      updatedAt: now,
      content: structuredClone(emptyContent),
    };

    MockStore.write(this.resumesKey, [...resumes, resume]);
    const versions = MockStore.read(this.versionsKey, fixtures.versions);
    MockStore.write(this.versionsKey, [...versions, masterVersion]);
    return mockResponse(resume);
  }

  rename(id: string, name: string): Observable<Resume> {
    const resumes = MockStore.read(this.resumesKey, fixtures.resumes);
    const resume = resumes.find((r) => r.id === id);
    if (!resume) {
      return mockError('Resume not found.');
    }
    const updated = { ...resume, name, updatedAt: new Date().toISOString() };
    MockStore.write(
      this.resumesKey,
      resumes.map((r) => (r.id === id ? updated : r)),
    );
    return mockResponse(updated);
  }

  duplicate(id: string): Observable<Resume> {
    const resumes = MockStore.read(this.resumesKey, fixtures.resumes);
    const source = resumes.find((r) => r.id === id);
    if (!source) {
      return mockError('Resume not found.');
    }
    const now = new Date().toISOString();
    const copy: Resume = {
      ...structuredClone(source),
      id: MockStore.generateId(),
      name: `${source.name} (copy)`,
      primary: false,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };
    MockStore.write(this.resumesKey, [...resumes, copy]);
    return mockResponse(copy);
  }

  delete(id: string): Observable<void> {
    const resumes = MockStore.read(this.resumesKey, fixtures.resumes);
    MockStore.write(
      this.resumesKey,
      resumes.filter((r) => r.id !== id),
    );
    const versions = MockStore.read(this.versionsKey, fixtures.versions);
    MockStore.write(
      this.versionsKey,
      versions.filter((v) => v.resumeId !== id),
    );
    return mockResponse(undefined, 150);
  }

  setPrimary(id: string): Observable<Resume> {
    const resumes = MockStore.read(this.resumesKey, fixtures.resumes);
    const target = resumes.find((r) => r.id === id);
    if (!target) {
      return mockError('Resume not found.');
    }
    const updated = resumes.map((r) => ({ ...r, primary: r.id === id }));
    MockStore.write(this.resumesKey, updated);
    return mockResponse({ ...target, primary: true });
  }

  markSaved(id: string): Observable<Resume> {
    const resumes = MockStore.read(this.resumesKey, fixtures.resumes);
    const target = resumes.find((r) => r.id === id);
    if (!target) {
      return mockError('Resume not found.');
    }
    const updated: Resume = { ...target, status: 'saved', updatedAt: new Date().toISOString() };
    MockStore.write(
      this.resumesKey,
      resumes.map((r) => (r.id === id ? updated : r)),
    );
    return mockResponse(updated);
  }

  listVersions(resumeId: string): Observable<ResumeVersion[]> {
    const versions = MockStore.read(this.versionsKey, fixtures.versions);
    return mockResponse(versions.filter((v) => v.resumeId === resumeId));
  }

  getVersion(versionId: string): Observable<ResumeVersion | null> {
    const versions = MockStore.read(this.versionsKey, fixtures.versions);
    return mockResponse(versions.find((v) => v.id === versionId) ?? null);
  }

  createVersion(
    resumeId: string,
    name: string,
    sourceVersionId?: string,
  ): Observable<ResumeVersion> {
    const versions = MockStore.read(this.versionsKey, fixtures.versions);
    const source = sourceVersionId
      ? versions.find((v) => v.id === sourceVersionId)
      : versions.find((v) => v.resumeId === resumeId && v.isMaster);
    const now = new Date().toISOString();
    const version: ResumeVersion = {
      id: MockStore.generateId(),
      resumeId,
      name,
      published: false,
      isMaster: false,
      isTailored: !!sourceVersionId,
      templateId: source?.templateId ?? this.registry.getFallbackId(),
      createdAt: now,
      updatedAt: now,
      content: structuredClone(source?.content ?? emptyContent),
    };
    MockStore.write(this.versionsKey, [...versions, version]);
    return mockResponse(version);
  }

  cloneVersion(versionId: string, name: string): Observable<ResumeVersion> {
    const versions = MockStore.read(this.versionsKey, fixtures.versions);
    const source = versions.find((v) => v.id === versionId);
    if (!source) {
      return mockError('Version not found.');
    }
    const now = new Date().toISOString();
    const clone: ResumeVersion = {
      ...structuredClone(source),
      id: MockStore.generateId(),
      name,
      published: false,
      isMaster: false,
      isTailored: source.isTailored,
      createdAt: now,
      updatedAt: now,
    };
    MockStore.write(this.versionsKey, [...versions, clone]);
    return mockResponse(clone);
  }

  publishVersion(versionId: string): Observable<ResumeVersion> {
    const versions = MockStore.read(this.versionsKey, fixtures.versions);
    const target = versions.find((v) => v.id === versionId);
    if (!target) {
      return mockError('Version not found.');
    }
    const updated = { ...target, published: true, updatedAt: new Date().toISOString() };
    MockStore.write(
      this.versionsKey,
      versions.map((v) => (v.id === versionId ? updated : v)),
    );
    return mockResponse(updated);
  }

  updateTemplate(versionId: string, templateId: string): Observable<ResumeVersion> {
    const versions = MockStore.read(this.versionsKey, fixtures.versions);
    const target = versions.find((v) => v.id === versionId);
    if (!target) {
      return mockError('Version not found.');
    }
    if (!this.registry.list().some((d) => d.id === templateId)) {
      return mockError('Template not found.');
    }
    const updated: ResumeVersion = {
      ...target,
      templateId,
      updatedAt: new Date().toISOString(),
    };
    MockStore.write(
      this.versionsKey,
      versions.map((v) => (v.id === versionId ? updated : v)),
    );
    return mockResponse(updated);
  }

  updateContent(versionId: string, content: ResumeContent): Observable<ResumeVersion> {
    const versions = MockStore.read(this.versionsKey, fixtures.versions);
    const target = versions.find((v) => v.id === versionId);
    if (!target) {
      return mockError('Version not found.');
    }
    const updated: ResumeVersion = {
      ...target,
      content,
      updatedAt: new Date().toISOString(),
    };
    MockStore.write(
      this.versionsKey,
      versions.map((v) => (v.id === versionId ? updated : v)),
    );
    return mockResponse(updated);
  }

  compare(
    versionA: string,
    versionB: string,
  ): Observable<{ versionA: ResumeVersion; versionB: ResumeVersion }> {
    const versions = MockStore.read(this.versionsKey, fixtures.versions);
    const a = versions.find((v) => v.id === versionA);
    const b = versions.find((v) => v.id === versionB);
    if (!a || !b) {
      return mockError('One or both versions were not found.');
    }
    return mockResponse({ versionA: a, versionB: b });
  }
}
