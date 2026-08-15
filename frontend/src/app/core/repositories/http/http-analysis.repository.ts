import { Observable, from } from 'rxjs';
import { AtsAnalysis } from '../../models/ats.model';
import { AnalysisRepository } from '../analysis.repository';
import { HttpApiClient } from './api-client';

/**
 * HTTP implementation of the ATS analysis repository. The request is sent
 * without a body: the backend always analyses the saved, authorized version
 * content, so clients can never feed the engine their own score fragments.
 */
export class HttpAnalysisRepository implements AnalysisRepository {
  constructor(private readonly client: HttpApiClient) {}

  runAtsAnalysis(versionId: string): Observable<AtsAnalysis> {
    return from(
      this.client.request<AtsAnalysis>(
        'POST',
        `/versions/${encodeURIComponent(versionId)}/ats-analysis`,
      ),
    );
  }
}
