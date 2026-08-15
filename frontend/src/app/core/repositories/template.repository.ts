import { Observable } from 'rxjs';
import { ResumeTemplate } from '../models/analysis.model';

export interface TemplateRepository {
  list(): Observable<ResumeTemplate[]>;
  get(id: string): Observable<ResumeTemplate | null>;
}
