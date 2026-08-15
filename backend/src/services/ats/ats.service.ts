import { ResumeService } from '../resume/resume.service';
import { getTemplateAtsProfile } from '../template/template-catalogue';
import { AtsAnalysisCore, analyzeResume } from './ats-analysis';

export interface AtsVersionAnalysis extends AtsAnalysisCore {
  versionId: string;
}

export class AtsService {
  private readonly resumes = new ResumeService();

  /**
   * Resolves the authenticated user's saved version (ownership is enforced by
   * ResumeService.getVersion, which returns 404 for other users) and runs the
   * deterministic rules over that content and its canonical template profile.
   */
  async analyzeVersion(userId: string, versionId: string): Promise<AtsVersionAnalysis> {
    const version = await this.resumes.getVersion(userId, versionId);
    const templateProfile = getTemplateAtsProfile(version.templateId);
    const core = analyzeResume(version.content, templateProfile);
    return { versionId: version.id, ...core };
  }
}
