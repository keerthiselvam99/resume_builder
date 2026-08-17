import { from } from 'rxjs';
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
import { HttpApiClient } from './api-client';
const params = <T extends object>(value: T) =>
  new URLSearchParams(
    Object.entries(value)
      .filter(([, v]) => v !== undefined && v !== '')
      .map(([k, v]) => [k, String(v)]),
  ).toString();
export class HttpAdminRepository extends AdminRepository {
  constructor(private client: HttpApiClient) {
    super();
  }
  summary() {
    return from(this.client.request<AdminSummary>('GET', '/admin/summary'));
  }
  users(query: UserQuery) {
    return from(this.client.request<Page<AdminUser>>('GET', `/admin/users?${params(query)}`));
  }
  audits(query: AuditQuery) {
    return from(
      this.client.request<Page<AuditEvent>>('GET', `/admin/audit-events?${params(query)}`),
    );
  }
  updateRole(id: string, role: AdminRole) {
    return from(
      this.client.request<AdminUser>('PATCH', `/admin/users/${encodeURIComponent(id)}/role`, {
        role,
      }),
    );
  }
  updateStatus(id: string, status: AccountStatus) {
    return from(
      this.client.request<AdminUser>('PATCH', `/admin/users/${encodeURIComponent(id)}/status`, {
        status,
      }),
    );
  }
}
