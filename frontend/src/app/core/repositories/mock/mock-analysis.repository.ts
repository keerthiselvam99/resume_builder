import { Observable } from 'rxjs';
import { AtsAnalysis } from '../../models/ats.model';
import { AnalysisRepository } from '../analysis.repository';
import { MockStore, mockResponse, mockError } from './mock-store';
import { fixtures } from './fixtures';
import { analyzeResume } from '../../../../../../shared/ats/analysis';
import {
  ATS_TEMPLATE_PROFILES,
  DEFAULT_ATS_TEMPLATE_ID,
} from '../../../../../../shared/ats-template-catalogue';
import type { TemplateAtsProfile } from '../../../../../../shared/ats-template-catalogue';

const PROFILE_BY_ID = new Map<string, TemplateAtsProfile>(
  ATS_TEMPLATE_PROFILES.map((profile) => [profile.id, profile]),
);

function templateProfileFor(templateId: string): TemplateAtsProfile | undefined {
  return PROFILE_BY_ID.get(templateId) ?? PROFILE_BY_ID.get(DEFAULT_ATS_TEMPLATE_ID);
}

/**
 * Demo-mode ATS repository. Runs the same versioned ruleset the backend uses
 * (the shared browser-safe engine) against the version's saved content plus its
 * template profile, so the score and findings change as the resume changes.
 */
export class MockAnalysisRepository implements AnalysisRepository {
  private versionsKey = 'versions';

  runAtsAnalysis(versionId: string): Observable<AtsAnalysis> {
    const versions = MockStore.read(this.versionsKey, fixtures.versions);
    const version = versions.find((v) => v.id === versionId);
    if (!version) {
      return mockError('Version not found.');
    }
    const core = analyzeResume(version.content, templateProfileFor(version.templateId));
    return mockResponse<AtsAnalysis>({ ...core, versionId });
  }
}
