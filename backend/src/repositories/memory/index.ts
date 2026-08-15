import {
  AuditRepository,
  ResumeRepository,
  RefreshTokenRepository,
  UserRepository,
} from '../interfaces';
import { MemoryAuditRepository } from './memory-audit.repository';
import { MemoryRefreshTokenRepository } from './memory-refresh-token.repository';
import { MemoryResumeRepository } from './memory-resume.repository';
import { MemoryStore } from './memory-store';
import { MemoryUserRepository } from './memory-user.repository';

export interface RepositorySet {
  users: UserRepository;
  refreshTokens: RefreshTokenRepository;
  audit: AuditRepository;
  resumes: ResumeRepository;
}

export interface MemoryRepositorySet extends RepositorySet {
  store: MemoryStore;
}

export function createMemoryRepositories(
  store: MemoryStore = new MemoryStore()
): MemoryRepositorySet {
  return {
    store,
    users: new MemoryUserRepository(store),
    refreshTokens: new MemoryRefreshTokenRepository(store),
    audit: new MemoryAuditRepository(store),
    resumes: new MemoryResumeRepository(store),
  };
}

export { MemoryStore };
