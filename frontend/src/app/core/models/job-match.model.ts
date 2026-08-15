export type {
  JobMatchCategoryKey,
  JobMatchCategoryScore,
  JobMatchEvidence,
  JobMatchKeyword,
  JobMatchResult,
  RequirementPriority,
} from '../../../../../shared/job-matcher';

export interface JobMatchRequest {
  jobTitle: string;
  company?: string;
  jobDescription: string;
}
