import { AuditEvent } from '../../types/domain';
import { AuditRepository } from '../interfaces';
import { MemoryStore } from './memory-store';

export class MemoryAuditRepository implements AuditRepository {
  constructor(private readonly store: MemoryStore) {}

  async record(event: {
    actorUserId: string | null;
    action: string;
    details?: string | null;
    ipAddress?: string | null;
  }): Promise<void> {
    const record: AuditEvent = {
      id: `audit-${this.store.auditEvents.length + 1}`,
      actorUserId: event.actorUserId ?? null,
      action: event.action,
      details: event.details ?? null,
      ipAddress: event.ipAddress ?? null,
      createdAt: new Date().toISOString(),
    };
    this.store.auditEvents.push(record);
    this.store.touch();
  }
}
