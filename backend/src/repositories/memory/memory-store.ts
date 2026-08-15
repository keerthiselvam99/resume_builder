import {
  AuditEvent,
  RefreshTokenRecord,
  Resume,
  ResumeVersion,
  UserRecord,
} from '../../types/domain';

export interface MemoryDbData {
  users: UserRecord[];
  refreshTokens: RefreshTokenRecord[];
  auditEvents: AuditEvent[];
  resumes: Resume[];
  versions: ResumeVersion[];
}

/**
 * Shared in-memory backing for the memory repository adapters. Holds plain
 * Maps keyed by id so the same data shape can be snapshotted to disk (file
 * store) or reconstructed by contract tests.
 */
export class MemoryStore {
  readonly users = new Map<string, UserRecord>();
  readonly refreshTokens = new Map<string, RefreshTokenRecord>();
  readonly auditEvents: AuditEvent[] = [];
  readonly resumes = new Map<string, Resume>();
  readonly versions = new Map<string, ResumeVersion>();

  /** Invoked after every mutating operation (used by the file store). */
  onMutate: (() => void) | null = null;

  touch(): void {
    this.onMutate?.();
  }

  snapshot(): MemoryDbData {
    return {
      users: Array.from(this.users.values()),
      refreshTokens: Array.from(this.refreshTokens.values()),
      auditEvents: this.auditEvents.map((e) => ({ ...e })),
      resumes: Array.from(this.resumes.values()),
      versions: Array.from(this.versions.values()),
    };
  }

  restore(data: MemoryDbData): void {
    this.users.clear();
    this.refreshTokens.clear();
    this.auditEvents.length = 0;
    this.resumes.clear();
    this.versions.clear();
    for (const user of data.users) {
      this.users.set(user.id, user);
    }
    for (const token of data.refreshTokens) {
      this.refreshTokens.set(token.id, token);
    }
    for (const event of data.auditEvents) {
      this.auditEvents.push(event);
    }
    for (const resume of data.resumes) {
      this.resumes.set(resume.id, resume);
    }
    for (const version of data.versions) {
      this.versions.set(version.id, version);
    }
  }

  clear(): void {
    this.users.clear();
    this.refreshTokens.clear();
    this.auditEvents.length = 0;
    this.resumes.clear();
    this.versions.clear();
  }
}
