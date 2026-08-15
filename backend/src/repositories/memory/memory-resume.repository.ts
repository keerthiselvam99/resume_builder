import { ConflictError, NotFoundError } from '../../http/errors';
import {
  DEFAULT_TEMPLATE_ID,
  emptyResumeContent,
  Resume,
  ResumeContent,
  ResumeVersion,
} from '../../types/domain';
import { CreateResumeInput, CreateVersionInput, ResumeRepository } from '../interfaces';
import { MemoryStore } from './memory-store';

function nowIso(): string {
  return new Date().toISOString();
}

export class MemoryResumeRepository implements ResumeRepository {
  constructor(private readonly store: MemoryStore) {}

  async listForUser(userId: string): Promise<Resume[]> {
    return Array.from(this.store.resumes.values())
      .filter((r) => r.userId === userId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async getForUser(userId: string, resumeId: string): Promise<Resume | null> {
    const resume = this.store.resumes.get(resumeId);
    return resume && resume.userId === userId ? resume : null;
  }

  async create(input: CreateResumeInput): Promise<Resume> {
    if (!this.store.resumes.has(input.resumeId)) {
      const primary = !Array.from(this.store.resumes.values()).some(
        (r) => r.userId === input.userId
      );
      const timestamp = nowIso();
      const resume: Resume = {
        id: input.resumeId,
        userId: input.userId,
        name: input.name.trim(),
        primary,
        status: 'draft',
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const version: ResumeVersion = {
        id: input.versionId,
        resumeId: input.resumeId,
        name: 'Master Resume',
        published: false,
        isMaster: true,
        isTailored: false,
        templateId: input.templateId,
        createdAt: timestamp,
        updatedAt: timestamp,
        content: structuredClone(emptyResumeContent),
      };
      this.store.resumes.set(resume.id, resume);
      this.store.versions.set(version.id, version);
      this.store.touch();
      return resume;
    }
    throw new ConflictError('Resume id already exists.');
  }

  async rename(userId: string, resumeId: string, name: string): Promise<Resume> {
    const resume = this.requireOwned(userId, resumeId);
    resume.name = name.trim();
    resume.updatedAt = nowIso();
    this.store.touch();
    return { ...resume };
  }

  async duplicate(userId: string, resumeId: string): Promise<Resume> {
    const source = this.requireOwned(userId, resumeId);
    const master = this.findMasterFor(resumeId);
    const timestamp = nowIso();
    const copy: Resume = {
      ...structuredClone(source),
      id: `r-${cryptoRandomUuid()}`,
      name: `${source.name} (copy)`,
      primary: false,
      status: 'draft',
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.store.resumes.set(copy.id, copy);
    if (master) {
      const copyVersion: ResumeVersion = {
        ...structuredClone(master),
        id: `v-${cryptoRandomUuid()}`,
        resumeId: copy.id,
        published: false,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      this.store.versions.set(copyVersion.id, copyVersion);
    }
    this.store.touch();
    return copy;
  }

  async delete(userId: string, resumeId: string): Promise<void> {
    const resume = this.requireOwned(userId, resumeId);
    this.store.resumes.delete(resume.id);
    for (const version of Array.from(this.store.versions.values())) {
      if (version.resumeId === resumeId) {
        this.store.versions.delete(version.id);
      }
    }
    this.store.touch();
  }

  async setPrimary(userId: string, resumeId: string): Promise<Resume> {
    const target = this.requireOwned(userId, resumeId);
    for (const resume of this.store.resumes.values()) {
      if (resume.userId === userId) {
        resume.primary = resume.id === resumeId;
      }
    }
    this.store.touch();
    return { ...target, primary: true };
  }

  async markSaved(userId: string, resumeId: string): Promise<Resume> {
    const resume = this.requireOwned(userId, resumeId);
    if (resume.status === 'saved') {
      return { ...resume };
    }
    resume.status = 'saved';
    resume.updatedAt = nowIso();
    this.store.touch();
    return { ...resume };
  }

  async listVersions(userId: string, resumeId: string): Promise<ResumeVersion[]> {
    if (!(await this.getForUser(userId, resumeId))) {
      return [];
    }
    return Array.from(this.store.versions.values())
      .filter((v) => v.resumeId === resumeId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async getVersionForUser(userId: string, versionId: string): Promise<ResumeVersion | null> {
    const version = this.store.versions.get(versionId);
    if (!version) {
      return null;
    }
    const resume = this.store.resumes.get(version.resumeId);
    if (!resume || resume.userId !== userId) {
      return null;
    }
    return version;
  }

  async createVersion(userId: string, input: CreateVersionInput): Promise<ResumeVersion> {
    this.requireOwned(userId, input.resumeId);
    const master = this.findMasterFor(input.resumeId);
    let source: ResumeVersion | undefined;
    if (input.sourceVersionId) {
      source = this.store.versions.get(input.sourceVersionId);
      if (!source || source.resumeId !== input.resumeId) {
        throw new NotFoundError('Source version not found.');
      }
    }
    const templateId = source?.templateId ?? master?.templateId ?? DEFAULT_TEMPLATE_ID;
    const baseContent = source?.content ?? master?.content ?? emptyResumeContent;
    const timestamp = nowIso();
    const version: ResumeVersion = {
      id: input.versionId,
      resumeId: input.resumeId,
      name: input.name.trim(),
      published: false,
      isMaster: false,
      isTailored: Boolean(input.sourceVersionId),
      templateId,
      createdAt: timestamp,
      updatedAt: timestamp,
      content: structuredClone(baseContent),
    };
    this.store.versions.set(version.id, version);
    this.store.touch();
    return version;
  }

  async cloneVersion(userId: string, versionId: string, name: string): Promise<ResumeVersion> {
    const source = this.requireOwnedVersion(userId, versionId);
    const timestamp = nowIso();
    const clone: ResumeVersion = {
      ...structuredClone(source),
      id: `v-${cryptoRandomUuid()}`,
      name: name.trim(),
      published: false,
      isMaster: false,
      isTailored: source.isTailored,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    this.store.versions.set(clone.id, clone);
    this.store.touch();
    return clone;
  }

  async publishVersion(userId: string, versionId: string): Promise<ResumeVersion> {
    const version = this.requireOwnedVersion(userId, versionId);
    version.published = true;
    version.updatedAt = nowIso();
    this.store.touch();
    return { ...version };
  }

  async updateContent(
    userId: string,
    versionId: string,
    content: ResumeContent
  ): Promise<ResumeVersion> {
    const version = this.requireOwnedVersion(userId, versionId);
    this.assertMutable(version);
    version.content = structuredClone(content);
    version.updatedAt = nowIso();
    this.store.touch();
    return { ...version };
  }

  async updateTemplate(
    userId: string,
    versionId: string,
    templateId: string
  ): Promise<ResumeVersion> {
    const version = this.requireOwnedVersion(userId, versionId);
    this.assertMutable(version);
    version.templateId = templateId;
    version.updatedAt = nowIso();
    this.store.touch();
    return { ...version };
  }

  async compare(
    userId: string,
    versionA: string,
    versionB: string
  ): Promise<{ versionA: ResumeVersion; versionB: ResumeVersion } | null> {
    const a = await this.getVersionForUser(userId, versionA);
    const b = await this.getVersionForUser(userId, versionB);
    if (!a || !b) {
      return null;
    }
    return { versionA: a, versionB: b };
  }

  private requireOwned(userId: string, resumeId: string): Resume {
    const resume = this.store.resumes.get(resumeId);
    if (!resume || resume.userId !== userId) {
      throw new NotFoundError('Resume not found.');
    }
    return resume;
  }

  private requireOwnedVersion(userId: string, versionId: string): ResumeVersion {
    const version = this.store.versions.get(versionId);
    if (!version) {
      throw new NotFoundError('Version not found.');
    }
    const resume = this.store.resumes.get(version.resumeId);
    if (!resume || resume.userId !== userId) {
      throw new NotFoundError('Version not found.');
    }
    return version;
  }

  private findMasterFor(resumeId: string): ResumeVersion | undefined {
    for (const version of this.store.versions.values()) {
      if (version.resumeId === resumeId && version.isMaster) {
        return version;
      }
    }
    return undefined;
  }

  private assertMutable(version: ResumeVersion): void {
    if (version.published) {
      throw new ConflictError(
        'This version is published and cannot be modified. Clone it to create an editable copy.'
      );
    }
  }
}

function cryptoRandomUuid(): string {
  return globalThis.crypto?.randomUUID?.() ?? randomFallback();
}

function randomFallback(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
