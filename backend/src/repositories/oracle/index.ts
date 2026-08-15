import { RepositorySet } from '../memory';
import { OracleAuditRepository } from './oracle-audit.repository';
import { OracleRefreshTokenRepository } from './oracle-refresh-token.repository';
import { OracleResumeRepository } from './oracle-resume.repository';
import { OracleUserRepository } from './oracle-user.repository';

export function createOracleRepositories(): RepositorySet {
  return {
    users: new OracleUserRepository(),
    refreshTokens: new OracleRefreshTokenRepository(),
    audit: new OracleAuditRepository(),
    resumes: new OracleResumeRepository(),
  };
}
