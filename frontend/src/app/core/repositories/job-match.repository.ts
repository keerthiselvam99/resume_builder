import { Observable } from 'rxjs';
import { JobMatchRequest, JobMatchResult } from '../models/job-match.model';

export interface JobMatchRepository {
  analyze(versionId: string, request: JobMatchRequest): Observable<JobMatchResult>;
}
