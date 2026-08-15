import {
  RefreshTokenRecord,
  Resume,
  ResumeContent,
  ResumeVersion,
  User,
  UserRecord,
} from '../types/domain';

export interface CreateUserInput {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: User['role'];
}

export interface UserRepository {
  create(input: CreateUserInput): Promise<UserRecord>;
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: string): Promise<UserRecord | null>;
  list(): Promise<UserRecord[]>;
}

export interface CreateRefreshTokenInput {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: string;
}

export interface RefreshTokenRepository {
  create(input: CreateRefreshTokenInput): Promise<void>;
  findByHash(hash: string): Promise<RefreshTokenRecord | null>;
  /** Revoke one token; optionally record which token replaced it. */
  revoke(id: string, replacedById?: string): Promise<void>;
  /** Revoke every token belonging to a user (reuse-detection hardening). */
  revokeAllForUser(userId: string): Promise<void>;
}

export interface AuditRepository {
  record(event: {
    actorUserId: string | null;
    action: string;
    details?: string | null;
    ipAddress?: string | null;
  }): Promise<void>;
}

export interface CreateResumeInput {
  resumeId: string;
  userId: string;
  name: string;
  templateId: string;
  versionId: string;
}

export interface CreateVersionInput {
  versionId: string;
  resumeId: string;
  name: string;
  sourceVersionId?: string;
}

export interface ResumeRepository {
  listForUser(userId: string): Promise<Resume[]>;
  getForUser(userId: string, resumeId: string): Promise<Resume | null>;
  create(input: CreateResumeInput): Promise<Resume>;
  rename(userId: string, resumeId: string, name: string): Promise<Resume>;
  duplicate(userId: string, resumeId: string): Promise<Resume>;
  delete(userId: string, resumeId: string): Promise<void>;
  setPrimary(userId: string, resumeId: string): Promise<Resume>;
  markSaved(userId: string, resumeId: string): Promise<Resume>;

  listVersions(userId: string, resumeId: string): Promise<ResumeVersion[]>;
  getVersionForUser(userId: string, versionId: string): Promise<ResumeVersion | null>;
  createVersion(userId: string, input: CreateVersionInput): Promise<ResumeVersion>;
  cloneVersion(userId: string, versionId: string, name: string): Promise<ResumeVersion>;
  publishVersion(userId: string, versionId: string): Promise<ResumeVersion>;
  updateContent(userId: string, versionId: string, content: ResumeContent): Promise<ResumeVersion>;
  updateTemplate(userId: string, versionId: string, templateId: string): Promise<ResumeVersion>;
  compare(
    userId: string,
    versionA: string,
    versionB: string
  ): Promise<{ versionA: ResumeVersion; versionB: ResumeVersion } | null>;
}
