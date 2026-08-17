export type AdminRole = 'user' | 'admin';
export type AccountStatus = 'active' | 'disabled';
export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  status: AccountStatus;
  createdAt: string;
  updatedAt: string;
}
export interface AdminSummary {
  totalUsers: number;
  activeUsers: number;
  disabledUsers: number;
  userCount: number;
  adminCount: number;
  totalResumes: number;
  savedResumes: number;
  drafts: number;
  recentAuditEvents: number;
}
export interface AuditEvent {
  id: string;
  actorUserId: string | null;
  targetUserId: string | null;
  action: string;
  details: string | null;
  createdAt: string;
}
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
export interface UserQuery {
  page: number;
  pageSize: number;
  q?: string;
  role?: AdminRole;
  status?: AccountStatus;
}
export interface AuditQuery {
  page: number;
  pageSize: number;
  action?: string;
  actor?: string;
  targetUser?: string;
}
