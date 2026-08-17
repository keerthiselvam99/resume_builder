import {
  RefreshTokenRecord,
  Resume,
  ResumeContent,
  ResumeVersion,
  User,
  UserRecord,
  AuditEvent,
  UserRole,
  UserStatus,
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
  listPage(query: AdminUserQuery): Promise<PageResult<UserRecord>>;
  adminCounts(): Promise<{
    total: number;
    active: number;
    disabled: number;
    users: number;
    admins: number;
  }>;
  countActiveAdmins(): Promise<number>;
  updateRoleAtomic(actorId: string, userId: string, role: UserRole): Promise<UserRecord>;
  updateStatusAtomic(actorId: string, userId: string, status: UserStatus): Promise<UserRecord>;
}

export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
export interface AdminUserQuery {
  page: number;
  pageSize: number;
  q?: string;
  role?: UserRole;
  status?: UserStatus;
  sort: 'name' | 'email' | 'createdAt' | 'updatedAt';
  direction: 'asc' | 'desc';
}
export interface AuditQuery {
  page: number;
  pageSize: number;
  action?: string;
  actorUserId?: string;
  targetUserId?: string;
  from?: string;
  to?: string;
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
    targetUserId?: string | null;
    ipAddress?: string | null;
  }): Promise<void>;
  listPage(query: AuditQuery): Promise<PageResult<AuditEvent>>;
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
  adminCounts(): Promise<{ total: number; saved: number; drafts: number }>;
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
