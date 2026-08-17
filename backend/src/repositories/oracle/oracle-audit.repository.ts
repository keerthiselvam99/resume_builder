import { randomUUID } from 'node:crypto';
import { AuditRepository } from '../interfaces';
import { AuditQuery, PageResult } from '../interfaces';
import { AuditEvent } from '../../types/domain';
import oracledb from 'oracledb';
import { TS_MASK, withConnection } from './common';
interface AuditRow {
  ID: string;
  ACTOR_USER_ID: string | null;
  TARGET_USER_ID: string | null;
  ACTION: string;
  DETAILS: string | null;
  IP_ADDRESS: string | null;
  CREATED_AT: string;
  TOTAL_COUNT: number;
}

export class OracleAuditRepository implements AuditRepository {
  async record(event: {
    actorUserId: string | null;
    targetUserId?: string | null;
    action: string;
    details?: string | null;
    ipAddress?: string | null;
  }): Promise<void> {
    const createdAt = new Date().toISOString();
    return withConnection(async (conn) => {
      await conn.execute(
        `INSERT INTO audit_logs (id, actor_user_id, target_user_id, action, details, ip_address, created_at)
         VALUES (:id, :actorUserId, :targetUserId, :action, :details, :ipAddress,
                 TO_TIMESTAMP(:createdAt, '${TS_MASK}'))`,
        {
          id: randomUUID(),
          actorUserId: event.actorUserId,
          targetUserId: event.targetUserId ?? null,
          action: event.action,
          details: event.details ?? null,
          ipAddress: event.ipAddress ?? null,
          createdAt,
        }
      );
    });
  }
  async listPage(query: AuditQuery): Promise<PageResult<AuditEvent>> {
    return withConnection(async (conn) => {
      const binds = {
        action: query.action ?? null,
        actor: query.actorUserId ?? null,
        target: query.targetUserId ?? null,
        from: query.from ?? null,
        to: query.to ?? null,
        offset: (query.page - 1) * query.pageSize,
        pageSize: query.pageSize,
      };
      const result = await conn.execute<AuditRow>(
        `SELECT id, actor_user_id, target_user_id, action, details, ip_address, TO_CHAR(created_at, '${TS_MASK}') created_at, COUNT(*) OVER() total_count FROM audit_logs WHERE (:action IS NULL OR action=:action) AND (:actor IS NULL OR actor_user_id=:actor) AND (:target IS NULL OR target_user_id=:target) AND (:from IS NULL OR created_at>=TO_TIMESTAMP(:from,'${TS_MASK}')) AND (:to IS NULL OR created_at<=TO_TIMESTAMP(:to,'${TS_MASK}')) ORDER BY created_at DESC, id DESC OFFSET :offset ROWS FETCH NEXT :pageSize ROWS ONLY`,
        binds,
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const all = (result.rows ?? []).map((r) => ({
        id: r.ID,
        actorUserId: r.ACTOR_USER_ID,
        targetUserId: r.TARGET_USER_ID,
        action: r.ACTION,
        details: r.DETAILS,
        ipAddress: r.IP_ADDRESS,
        createdAt: r.CREATED_AT,
      }));
      return {
        items: all,
        total: Number(result.rows?.[0]?.TOTAL_COUNT ?? 0),
        page: query.page,
        pageSize: query.pageSize,
      };
    });
  }
}
