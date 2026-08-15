import { Observable, from } from 'rxjs';
import { CreateResumeRequest, ResumeRepository } from '../resume.repository';
import { Resume, ResumeVersion } from '../../models/resume.model';
import { ApiError, HttpApiClient } from './api-client';

/**
 * HTTP implementation of the resume repository. Every endpoint requires the
 * bearer access token; the shared client adds it and transparently refreshes
 * a short-lived token on 401.
 */
export class HttpResumeRepository implements ResumeRepository {
  constructor(private readonly client: HttpApiClient) {}

  list(): Observable<Resume[]> {
    return from(this.client.request<Resume[]>('GET', '/resumes'));
  }

  get(id: string): Observable<Resume | null> {
    return from(
      this.client.request<Resume>('GET', `/resumes/${encodeURIComponent(id)}`).catch((err) => {
        if (isNotFound(err)) {
          return null;
        }
        throw err;
      }),
    );
  }

  create(request: CreateResumeRequest): Observable<Resume> {
    return from(this.client.request<Resume>('POST', '/resumes', request));
  }

  rename(id: string, name: string): Observable<Resume> {
    return from(
      this.client.request<Resume>('PATCH', `/resumes/${encodeURIComponent(id)}`, { name }),
    );
  }

  duplicate(id: string): Observable<Resume> {
    return from(
      this.client.request<Resume>('POST', `/resumes/${encodeURIComponent(id)}/duplicate`),
    );
  }

  delete(id: string): Observable<void> {
    return from(this.client.request<void>('DELETE', `/resumes/${encodeURIComponent(id)}`));
  }

  setPrimary(id: string): Observable<Resume> {
    return from(this.client.request<Resume>('POST', `/resumes/${encodeURIComponent(id)}/primary`));
  }

  markSaved(id: string): Observable<Resume> {
    return from(this.client.request<Resume>('POST', `/resumes/${encodeURIComponent(id)}/save`));
  }

  listVersions(resumeId: string): Observable<ResumeVersion[]> {
    return from(
      this.client.request<ResumeVersion[]>(
        'GET',
        `/resumes/${encodeURIComponent(resumeId)}/versions`,
      ),
    );
  }

  getVersion(versionId: string): Observable<ResumeVersion | null> {
    return from(
      this.client
        .request<ResumeVersion>('GET', `/versions/${encodeURIComponent(versionId)}`)
        .catch((err) => {
          if (isNotFound(err)) {
            return null;
          }
          throw err;
        }),
    );
  }

  createVersion(
    resumeId: string,
    name: string,
    sourceVersionId?: string,
  ): Observable<ResumeVersion> {
    return from(
      this.client.request<ResumeVersion>(
        'POST',
        `/resumes/${encodeURIComponent(resumeId)}/versions`,
        { name, ...(sourceVersionId ? { sourceVersionId } : {}) },
      ),
    );
  }

  cloneVersion(versionId: string, name: string): Observable<ResumeVersion> {
    return from(
      this.client.request<ResumeVersion>(
        'POST',
        `/versions/${encodeURIComponent(versionId)}/clone`,
        { name },
      ),
    );
  }

  publishVersion(versionId: string): Observable<ResumeVersion> {
    return from(
      this.client.request<ResumeVersion>(
        'POST',
        `/versions/${encodeURIComponent(versionId)}/publish`,
      ),
    );
  }

  updateContent(versionId: string, content: ResumeVersion['content']): Observable<ResumeVersion> {
    return from(
      this.client.request<ResumeVersion>(
        'PATCH',
        `/versions/${encodeURIComponent(versionId)}/content`,
        { content },
      ),
    );
  }

  updateTemplate(versionId: string, templateId: string): Observable<ResumeVersion> {
    return from(
      this.client.request<ResumeVersion>(
        'PATCH',
        `/versions/${encodeURIComponent(versionId)}/template`,
        { templateId },
      ),
    );
  }

  compare(
    versionA: string,
    versionB: string,
  ): Observable<{ versionA: ResumeVersion; versionB: ResumeVersion }> {
    const query = new URLSearchParams({ versionA, versionB }).toString();
    return from(
      this.client.request<{ versionA: ResumeVersion; versionB: ResumeVersion }>(
        'GET',
        `/versions/compare?${query}`,
      ),
    );
  }
}

function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}
