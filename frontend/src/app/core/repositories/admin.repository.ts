import { Observable } from 'rxjs';
import {
  AccountStatus,
  AdminRole,
  AdminSummary,
  AdminUser,
  AuditEvent,
  AuditQuery,
  Page,
  UserQuery,
} from '../models/admin.model';
export abstract class AdminRepository {
  abstract summary(): Observable<AdminSummary>;
  abstract users(query: UserQuery): Observable<Page<AdminUser>>;
  abstract audits(query: AuditQuery): Observable<Page<AuditEvent>>;
  abstract updateRole(id: string, role: AdminRole): Observable<AdminUser>;
  abstract updateStatus(id: string, status: AccountStatus): Observable<AdminUser>;
}
