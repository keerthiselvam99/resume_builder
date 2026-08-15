export interface TemplateStyle {
  fontFamily: string;
  fontSize: number;
  primaryColor: string;
  showLinks: boolean;
}

export interface ResumeTemplate {
  id: string;
  name: string;
  description: string;
  category: 'ats' | 'modern' | 'developer';
  onePage: boolean;
  twoPage: boolean;
  style: TemplateStyle;
  definitionId: string;
}

export type MatchStatus = 'supported' | 'weak' | 'missing' | 'needs-confirmation';

export interface EvidenceItem {
  requirement: string;
  status: MatchStatus;
  evidence: string;
  projectId?: string;
  experienceId?: string;
}

export interface JobDescription {
  id: string;
  userId: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface MatchAnalysis {
  id: string;
  versionId: string;
  jobDescriptionId: string;
  overallScore: number;
  createdAt: string;
  results: EvidenceItem[];
}
