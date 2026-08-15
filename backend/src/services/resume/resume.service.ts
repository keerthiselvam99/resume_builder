import { NotFoundError, ValidationError } from '../../http/errors';
import { getRepositories } from '../../repositories';
import { Resume, ResumeContent, ResumeVersion } from '../../types/domain';
import { ResumeContentSchema } from '../pdf/content-validation';
import { isValidTemplateId } from '../template/template-catalogue';

export class ResumeService {
  async list(userId: string): Promise<Resume[]> {
    return getRepositories().resumes.listForUser(userId);
  }

  async get(userId: string, resumeId: string): Promise<Resume> {
    const resume = await getRepositories().resumes.getForUser(userId, resumeId);
    if (!resume) {
      throw new NotFoundError('Resume not found.');
    }
    return resume;
  }

  async create(userId: string, input: { name: string; templateId: string }): Promise<Resume> {
    if (!isValidTemplateId(input.templateId)) {
      throw new ValidationError(['templateId: Template not found.']);
    }
    const { resumes, audit } = getRepositories();
    const resume = await resumes.create({
      resumeId: `r-${cryptoRandomUuid()}`,
      userId,
      name: input.name,
      templateId: input.templateId,
      versionId: `v-${cryptoRandomUuid()}`,
    });
    await audit.record({
      actorUserId: userId,
      action: 'resume.create',
      details: `Created resume "${resume.name}".`,
    });
    return resume;
  }

  async rename(userId: string, resumeId: string, name: string): Promise<Resume> {
    const { resumes, audit } = getRepositories();
    const resume = await resumes.rename(userId, resumeId, name);
    await audit.record({
      actorUserId: userId,
      action: 'resume.rename',
      details: `Renamed to "${name}".`,
    });
    return resume;
  }

  async duplicate(userId: string, resumeId: string): Promise<Resume> {
    const { resumes, audit } = getRepositories();
    const copy = await resumes.duplicate(userId, resumeId);
    await audit.record({
      actorUserId: userId,
      action: 'resume.duplicate',
      details: `Duplicated "${copy.name}".`,
    });
    return copy;
  }

  async delete(userId: string, resumeId: string): Promise<void> {
    const { resumes, audit } = getRepositories();
    await resumes.delete(userId, resumeId);
    await audit.record({
      actorUserId: userId,
      action: 'resume.delete',
      details: `Deleted resume ${resumeId}.`,
    });
  }

  async setPrimary(userId: string, resumeId: string): Promise<Resume> {
    const { resumes, audit } = getRepositories();
    const resume = await resumes.setPrimary(userId, resumeId);
    await audit.record({
      actorUserId: userId,
      action: 'resume.set-primary',
      details: `Set primary resume ${resumeId}.`,
    });
    return resume;
  }

  async markSaved(userId: string, resumeId: string): Promise<Resume> {
    const { resumes, audit } = getRepositories();
    const resume = await resumes.markSaved(userId, resumeId);
    await audit.record({
      actorUserId: userId,
      action: 'resume.save',
      details: `Saved resume "${resume.name}".`,
    });
    return resume;
  }

  async listVersions(userId: string, resumeId: string): Promise<ResumeVersion[]> {
    await this.get(userId, resumeId);
    return getRepositories().resumes.listVersions(userId, resumeId);
  }

  async getVersion(userId: string, versionId: string): Promise<ResumeVersion> {
    const version = await getRepositories().resumes.getVersionForUser(userId, versionId);
    if (!version) {
      throw new NotFoundError('Version not found.');
    }
    return version;
  }

  async createVersion(
    userId: string,
    resumeId: string,
    input: { name: string; sourceVersionId?: string }
  ): Promise<ResumeVersion> {
    const { resumes, audit } = getRepositories();
    const version = await resumes.createVersion(userId, {
      versionId: `v-${cryptoRandomUuid()}`,
      resumeId,
      name: input.name,
      sourceVersionId: input.sourceVersionId,
    });
    await audit.record({
      actorUserId: userId,
      action: 'version.create',
      details: `Created version "${version.name}".`,
    });
    return version;
  }

  async cloneVersion(userId: string, versionId: string, name: string): Promise<ResumeVersion> {
    const { resumes, audit } = getRepositories();
    const version = await resumes.cloneVersion(userId, versionId, name);
    await audit.record({
      actorUserId: userId,
      action: 'version.clone',
      details: `Cloned version "${version.name}".`,
    });
    return version;
  }

  async publishVersion(userId: string, versionId: string): Promise<ResumeVersion> {
    const { resumes, audit } = getRepositories();
    const version = await resumes.publishVersion(userId, versionId);
    await audit.record({
      actorUserId: userId,
      action: 'version.publish',
      details: `Published version ${versionId}.`,
    });
    return version;
  }

  async updateContent(userId: string, versionId: string, content: unknown): Promise<ResumeVersion> {
    const parsed = ResumeContentSchema.safeParse(content);
    if (!parsed.success) {
      throw new ValidationError(
        parsed.error.issues.map((issue) => `${issue.path.join('.') || 'payload'} ${issue.message}`)
      );
    }
    const { resumes, audit } = getRepositories();
    const version = await resumes.updateContent(userId, versionId, parsed.data as ResumeContent);
    await audit.record({
      actorUserId: userId,
      action: 'version.update-content',
      details: `Updated content of version ${versionId}.`,
    });
    return version;
  }

  async updateTemplate(
    userId: string,
    versionId: string,
    templateId: string
  ): Promise<ResumeVersion> {
    if (!isValidTemplateId(templateId)) {
      throw new NotFoundError('Template not found.');
    }
    const { resumes, audit } = getRepositories();
    const version = await resumes.updateTemplate(userId, versionId, templateId);
    await audit.record({
      actorUserId: userId,
      action: 'version.update-template',
      details: `Set template ${templateId}.`,
    });
    return version;
  }

  async compare(
    userId: string,
    versionA: string,
    versionB: string
  ): Promise<{ versionA: ResumeVersion; versionB: ResumeVersion }> {
    const result = await getRepositories().resumes.compare(userId, versionA, versionB);
    if (!result) {
      throw new NotFoundError('One or both versions were not found.');
    }
    return result;
  }
}

function cryptoRandomUuid(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  );
}
