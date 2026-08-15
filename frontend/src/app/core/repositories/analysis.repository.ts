import { Observable } from 'rxjs';
import { AtsAnalysis } from '../models/ats.model';

export interface AnalysisRepository {
  runAtsAnalysis(versionId: string): Observable<AtsAnalysis>;
}
