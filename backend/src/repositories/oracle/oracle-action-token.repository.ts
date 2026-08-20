import oracledb from 'oracledb';
import { ActionTokenPurpose, ActionTokenRecord } from '../../types/domain';
import { ActionTokenRepository } from '../interfaces';
import { TS_MASK, withConnection } from './common';

interface TokenRow {
  ID: string;
  USER_ID: string;
  PURPOSE: string;
  TOKEN_HASH: string;
  CREATED_AT: string;
  EXPIRES_AT: string;
  CONSUMED_AT: string | null;
  REVOKED_AT: string | null;
}
const columns = `id,user_id,purpose,token_hash,TO_CHAR(created_at,'${TS_MASK}') created_at,TO_CHAR(expires_at,'${TS_MASK}') expires_at,TO_CHAR(consumed_at,'${TS_MASK}') consumed_at,TO_CHAR(revoked_at,'${TS_MASK}') revoked_at`;
function map(r: TokenRow): ActionTokenRecord {
  return {
    id: r.ID,
    userId: r.USER_ID,
    purpose: r.PURPOSE as ActionTokenPurpose,
    tokenHash: r.TOKEN_HASH,
    createdAt: r.CREATED_AT,
    expiresAt: r.EXPIRES_AT,
    consumedAt: r.CONSUMED_AT,
    revokedAt: r.REVOKED_AT,
  };
}

export class OracleActionTokenRepository implements ActionTokenRepository {
  async createReplacing(input: Omit<ActionTokenRecord, 'consumedAt' | 'revokedAt'>) {
    return withConnection(async (conn) => {
      await conn.execute(
        `UPDATE user_action_tokens SET revoked_at=TO_TIMESTAMP(:createdAt,'${TS_MASK}') WHERE user_id=:userId AND purpose=:purpose AND consumed_at IS NULL AND revoked_at IS NULL`,
        { createdAt: input.createdAt, userId: input.userId, purpose: input.purpose },
        { autoCommit: false }
      );
      await conn.execute(
        `INSERT INTO user_action_tokens(id,user_id,purpose,token_hash,created_at,expires_at) VALUES(:id,:userId,:purpose,:tokenHash,TO_TIMESTAMP(:createdAt,'${TS_MASK}'),TO_TIMESTAMP(:expiresAt,'${TS_MASK}'))`,
        input,
        { autoCommit: true }
      );
      return { ...input, consumedAt: null, revokedAt: null };
    });
  }
  async consume(tokenHash: string, purpose: ActionTokenPurpose, now: string) {
    return withConnection(async (conn) => {
      const found = await conn.execute<TokenRow>(
        `SELECT ${columns} FROM user_action_tokens WHERE token_hash=:tokenHash AND purpose=:purpose AND consumed_at IS NULL AND revoked_at IS NULL AND expires_at>TO_TIMESTAMP(:now,'${TS_MASK}') FOR UPDATE`,
        { tokenHash, purpose, now },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const row = found.rows?.[0];
      if (!row) return null;
      await conn.execute(
        `UPDATE user_action_tokens SET consumed_at=TO_TIMESTAMP(:now,'${TS_MASK}') WHERE id=:id AND consumed_at IS NULL`,
        { now, id: row.ID },
        { autoCommit: true }
      );
      return { ...map(row), consumedAt: now };
    });
  }
  async revokeAllForUser(userId: string, purpose?: ActionTokenPurpose) {
    await withConnection(async (conn) => {
      await conn.execute(
        `UPDATE user_action_tokens SET revoked_at=SYSTIMESTAMP WHERE user_id=:userId AND (:purpose IS NULL OR purpose=:purpose) AND consumed_at IS NULL AND revoked_at IS NULL`,
        { userId, purpose: purpose ?? null },
        { autoCommit: true }
      );
    });
  }
  async cleanupExpired(now: string) {
    return withConnection(async (conn) => {
      const r = await conn.execute(
        `DELETE FROM user_action_tokens WHERE expires_at<=TO_TIMESTAMP(:now,'${TS_MASK}')`,
        { now },
        { autoCommit: true }
      );
      return r.rowsAffected ?? 0;
    });
  }
}
