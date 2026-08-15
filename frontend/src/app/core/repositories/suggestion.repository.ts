import { Observable } from 'rxjs';
import { Suggestion, SuggestionDecision, SuggestionType } from '../models/suggestion.model';

export interface SuggestionRepository {
  list(versionId: string): Observable<Suggestion[]>;
  improveSummary(versionId: string, text: string): Observable<Suggestion>;
  improveBullet(versionId: string, text: string): Observable<Suggestion>;
  tailorForJob(versionId: string, jobDescriptionId: string): Observable<Suggestion[]>;
  decide(id: string, decision: SuggestionDecision): Observable<Suggestion>;
  generateInterviewQuestions(versionId: string): Observable<string[]>;
}

export type { SuggestionType };
