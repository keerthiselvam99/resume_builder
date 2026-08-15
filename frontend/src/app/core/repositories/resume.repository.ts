import { Observable } from 'rxjs';
import { Resume, ResumeVersion } from '../models/resume.model';

export interface CreateResumeRequest {
  name: string;
  templateId: string;
}

export interface ResumeRepository {
  list(): Observable<Resume[]>;
  get(id: string): Observable<Resume | null>;
  create(request: CreateResumeRequest): Observable<Resume>;
  rename(id: string, name: string): Observable<Resume>;
  duplicate(id: string): Observable<Resume>;
  delete(id: string): Observable<void>;
  setPrimary(id: string): Observable<Resume>;
  /** Promotes a draft resume to saved (explicit user action, never autosave). */
  markSaved(id: string): Observable<Resume>;

  listVersions(resumeId: string): Observable<ResumeVersion[]>;
  getVersion(versionId: string): Observable<ResumeVersion | null>;
  createVersion(
    resumeId: string,
    name: string,
    sourceVersionId?: string,
  ): Observable<ResumeVersion>;
  cloneVersion(versionId: string, name: string): Observable<ResumeVersion>;
  publishVersion(versionId: string): Observable<ResumeVersion>;
  updateContent(versionId: string, content: ResumeVersion['content']): Observable<ResumeVersion>;
  updateTemplate(versionId: string, templateId: string): Observable<ResumeVersion>;
  compare(
    versionA: string,
    versionB: string,
  ): Observable<{ versionA: ResumeVersion; versionB: ResumeVersion }>;
}
