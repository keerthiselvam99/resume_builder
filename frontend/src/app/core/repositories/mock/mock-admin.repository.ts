import { Observable } from 'rxjs';
import { AdminRepository } from '../admin.repository';
import {
  AccountStatus,
  AdminRole,
  AdminSummary,
  AdminUser,
  AuditEvent,
  AuditQuery,
  Page,
  UserQuery,
} from '../../models/admin.model';
import { MockStore, mockResponse } from './mock-store';
const USERS = 'admin_users',
  EVENTS = 'admin_events';
const now = '2026-08-15T10:00:00.000Z';
const seeded: AdminUser[] = [
  {
    id: 'u-demo',
    name: 'Demo Administrator',
    email: 'admin@example.com',
    role: 'admin',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'u-casey',
    name: 'Casey Morgan',
    email: 'casey@example.com',
    role: 'user',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 'u-riley',
    name: 'Riley Chen',
    email: 'riley@example.com',
    role: 'user',
    status: 'active',
    createdAt: now,
    updatedAt: now,
  },
];
export class MockAdminRepository extends AdminRepository {
  private read() {
    const users = MockStore.read<AdminUser[]>(USERS, seeded);
    if (!MockStore.read<AdminUser[]>(USERS, []).length) MockStore.write(USERS, users);
    return users;
  }
  summary(): Observable<AdminSummary> {
    const u = this.read();
    return mockResponse({
      totalUsers: u.length,
      activeUsers: u.filter((x) => x.status === 'active').length,
      disabledUsers: u.filter((x) => x.status === 'disabled').length,
      userCount: u.filter((x) => x.role === 'user').length,
      adminCount: u.filter((x) => x.role === 'admin').length,
      totalResumes: 1,
      savedResumes: 1,
      drafts: 0,
      recentAuditEvents: MockStore.read<AuditEvent[]>(EVENTS, []).length,
    });
  }
  users(q: UserQuery): Observable<Page<AdminUser>> {
    let u = this.read()
      .filter(
        (x) =>
          (!q.q || `${x.name} ${x.email}`.toLowerCase().includes(q.q.toLowerCase())) &&
          (!q.role || x.role === q.role) &&
          (!q.status || x.status === q.status),
      )
      .sort((a, b) => a.email.localeCompare(b.email));
    const total = u.length;
    u = u.slice((q.page - 1) * q.pageSize, q.page * q.pageSize);
    return mockResponse({
      items: u,
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.ceil(total / q.pageSize),
    });
  }
  audits(q: AuditQuery): Observable<Page<AuditEvent>> {
    let e = MockStore.read<AuditEvent[]>(EVENTS, []).filter(
      (x) => !q.action || x.action === q.action,
    );
    const total = e.length;
    e = e.slice((q.page - 1) * q.pageSize, q.page * q.pageSize);
    return mockResponse({
      items: e,
      total,
      page: q.page,
      pageSize: q.pageSize,
      totalPages: Math.ceil(total / q.pageSize),
    });
  }
  updateRole(id: string, role: AdminRole) {
    return this.mutate(
      id,
      { role },
      role === 'admin' ? 'admin.role-granted' : 'admin.role-removed',
    );
  }
  updateStatus(id: string, status: AccountStatus) {
    return this.mutate(
      id,
      { status },
      status === 'disabled' ? 'admin.account-disabled' : 'admin.account-enabled',
    );
  }
  private mutate(id: string, change: Partial<AdminUser>, action: string) {
    const users = this.read();
    const target = users.find((x) => x.id === id)!;
    Object.assign(target, change, { updatedAt: new Date().toISOString() });
    MockStore.write(USERS, users);
    const events = MockStore.read<AuditEvent[]>(EVENTS, []);
    events.unshift({
      id: MockStore.generateId(),
      actorUserId: 'u-demo',
      targetUserId: id,
      action,
      details: JSON.stringify(change),
      createdAt: new Date().toISOString(),
    });
    MockStore.write(EVENTS, events);
    return mockResponse({ ...target });
  }
}
