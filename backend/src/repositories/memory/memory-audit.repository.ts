import { AuditEvent } from '../../types/domain';
import { AuditRepository } from '../interfaces';
import { AuditQuery, PageResult } from '../interfaces';
import { MemoryStore } from './memory-store';

export class MemoryAuditRepository implements AuditRepository {
  constructor(private readonly store: MemoryStore) {}

  async record(event: {
    actorUserId: string | null;
    targetUserId?: string | null;
    action: string;
    details?: string | null;
    ipAddress?: string | null;
  }): Promise<void> {
    const record: AuditEvent = {
      id: `audit-${this.store.auditEvents.length + 1}`,
      actorUserId: event.actorUserId ?? null,
      targetUserId: event.targetUserId ?? null,
      action: event.action,
      details: event.details ?? null,
      ipAddress: event.ipAddress ?? null,
      createdAt: new Date().toISOString(),
    };
    this.store.auditEvents.push(record);
    this.store.touch();
  }

  async listPage(query: AuditQuery): Promise<PageResult<AuditEvent>> {
    const items = this.store.auditEvents
      .filter(
        (e) =>
          (!query.action || e.action === query.action) &&
          (!query.actorUserId || e.actorUserId === query.actorUserId) &&
          (!query.targetUserId || e.targetUserId === query.targetUserId) &&
          (!query.from || e.createdAt >= query.from) &&
          (!query.to || e.createdAt <= query.to)
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    const start = (query.page - 1) * query.pageSize;
    return {
      items: items.slice(start, start + query.pageSize),
      total: items.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }
}
