import { analyzeJobMatch, JobMatchResult } from '../../../../shared/job-matcher';
import { getRepositories } from '../../repositories';
import { ResumeService } from '../resume/resume.service';

export interface JobMatchRequest {
  jobTitle: string;
  company?: string;
  jobDescription: string;
}

export class JobMatcherService {
  private readonly resumes = new ResumeService();

  async analyzeVersion(
    userId: string,
    versionId: string,
    input: JobMatchRequest,
    ipAddress?: string
  ): Promise<JobMatchResult> {
    const version = await this.resumes.getVersion(userId, versionId);
    const result = analyzeJobMatch({
      content: version.content,
      versionId: version.id,
      templateId: version.templateId,
      ...input,
    });
    await getRepositories().audit.record({
      actorUserId: userId,
      action: 'job-match.analyze',
      details: JSON.stringify({
        versionId,
        rulesetVersion: result.rulesetVersion,
        overallScore: result.overallScore,
        descriptionLength: input.jobDescription.length,
        inputSignature: result.inputSignature,
      }),
      ipAddress,
    });
    return result;
  }
}
