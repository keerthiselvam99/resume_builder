import { Observable, switchMap, throwError } from 'rxjs';
import { analyzeJobMatch } from '../../../../../../shared/job-matcher';
import { JobMatchRequest, JobMatchResult } from '../../models/job-match.model';
import { JobMatchRepository } from '../job-match.repository';
import { ResumeRepository } from '../resume.repository';
import { mockResponse } from './mock-store';

export class MockJobMatchRepository implements JobMatchRepository {
  constructor(private readonly resumes: ResumeRepository) {}
  analyze(versionId: string, request: JobMatchRequest): Observable<JobMatchResult> {
    return this.resumes.getVersion(versionId).pipe(
      switchMap((version) =>
        version
          ? mockResponse(
              analyzeJobMatch({
                content: version.content,
                versionId,
                templateId: version.templateId,
                ...request,
              }),
              450,
            )
          : throwError(() => new Error('Version not found.')),
      ),
    );
  }
}
