import { randomUUID } from 'node:crypto';
import { AuditRepository } from '../interfaces';
import { TS_MASK, withConnection } from './common';

export class OracleAuditRepository implements AuditRepository {
  async record(event: {
    actorUserId: string | null;
    action: string;
    details?: string | null;
    ipAddress?: string | null;
  }): Promise<void> {
    const createdAt = new Date().toISOString();
    return withConnection(async (conn) => {
      await conn.execute(
        `INSERT INTO audit_logs (id, actor_user_id, action, details, ip_address, created_at)
         VALUES (:id, :actorUserId, :action, :details, :ipAddress,
                 TO_TIMESTAMP(:createdAt, '${TS_MASK}'))`,
        {
          id: randomUUID(),
          actorUserId: event.actorUserId,
          action: event.action,
          details: event.details ?? null,
          ipAddress: event.ipAddress ?? null,
          createdAt,
        }
      );
    });
  }
}
