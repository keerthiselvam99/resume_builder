export type SuggestionType = 'summary' | 'bullet' | 'keyword' | 'tailoring';

export type SuggestionStatus = 'pending' | 'accepted' | 'rejected';

export interface Suggestion {
  id: string;
  versionId: string;
  type: SuggestionType;
  original: string;
  suggested: string;
  rationale: string;
  status: SuggestionStatus;
  createdAt: string;
}

export interface SuggestionDecision {
  status: SuggestionStatus;
}
