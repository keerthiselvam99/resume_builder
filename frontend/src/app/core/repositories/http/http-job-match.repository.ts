import { from, Observable } from 'rxjs';
import { JobMatchRequest, JobMatchResult } from '../../models/job-match.model';
import { JobMatchRepository } from '../job-match.repository';
import { HttpApiClient } from './api-client';

export class HttpJobMatchRepository implements JobMatchRepository {
  constructor(private readonly client: HttpApiClient) {}
  analyze(versionId: string, request: JobMatchRequest): Observable<JobMatchResult> {
    return from(
      this.client.request<JobMatchResult>(
        'POST',
        `/versions/${encodeURIComponent(versionId)}/job-match`,
        request,
      ),
    );
  }
}
