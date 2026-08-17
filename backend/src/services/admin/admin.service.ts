import { getRepositories } from '../../repositories';
import { AdminUserQuery, AuditQuery } from '../../repositories/interfaces';
import { UserRecord, UserRole, UserStatus } from '../../types/domain';

const safeUser = ({ passwordHash: _secret, ...user }: UserRecord) => user;

export class AdminService {
  async summary() {
    const { users, resumes, audit } = getRepositories();
    const userCounts = await users.adminCounts();
    const resumeCounts = await resumes.adminCounts();
    const recent = await audit.listPage({
      page: 1,
      pageSize: 1,
      from: new Date(Date.now() - 7 * 86400000).toISOString(),
    });
    return {
      totalUsers: userCounts.total,
      activeUsers: userCounts.active,
      disabledUsers: userCounts.disabled,
      userCount: userCounts.users,
      adminCount: userCounts.admins,
      totalResumes: resumeCounts.total,
      savedResumes: resumeCounts.saved,
      drafts: resumeCounts.drafts,
      recentAuditEvents: recent.total,
    };
  }
  async users(query: AdminUserQuery) {
    const result = await getRepositories().users.listPage(query);
    return {
      ...result,
      items: result.items.map(safeUser),
      totalPages: Math.ceil(result.total / result.pageSize),
    };
  }
  async audits(query: AuditQuery) {
    const result = await getRepositories().audit.listPage(query);
    return {
      ...result,
      items: result.items.map((e) => ({
        ...e,
        details: sanitize(e.details),
        ipAddress: undefined,
      })),
      totalPages: Math.ceil(result.total / result.pageSize),
    };
  }
  async role(actorId: string, targetId: string, role: UserRole) {
    const repos = getRepositories();
    try {
      const user = await repos.users.updateRoleAtomic(actorId, targetId, role);
      await repos.refreshTokens.revokeAllForUser(targetId);
      await repos.audit.record({
        actorUserId: actorId,
        targetUserId: targetId,
        action: role === 'admin' ? 'admin.role-granted' : 'admin.role-removed',
        details: JSON.stringify({ role }),
      });
      return safeUser(user);
    } catch (error) {
      await repos.audit.record({
        actorUserId: actorId,
        targetUserId: targetId,
        action: 'admin.prohibited-attempt',
        details: JSON.stringify({ operation: 'role', role }),
      });
      throw error;
    }
  }
  async status(actorId: string, targetId: string, status: UserStatus) {
    const repos = getRepositories();
    try {
      const user = await repos.users.updateStatusAtomic(actorId, targetId, status);
      await repos.refreshTokens.revokeAllForUser(targetId);
      await repos.audit.record({
        actorUserId: actorId,
        targetUserId: targetId,
        action: status === 'disabled' ? 'admin.account-disabled' : 'admin.account-enabled',
        details: JSON.stringify({ status }),
      });
      return safeUser(user);
    } catch (error) {
      await repos.audit.record({
        actorUserId: actorId,
        targetUserId: targetId,
        action: 'admin.prohibited-attempt',
        details: JSON.stringify({ operation: 'status', status }),
      });
      throw error;
    }
  }
}
function sanitize(value: string | null): string | null {
  if (!value) return null;
  return value
    .replace(/(password|token|jobDescription|resumeContent)[^,}]*/gi, '[redacted]')
    .slice(0, 500);
}
