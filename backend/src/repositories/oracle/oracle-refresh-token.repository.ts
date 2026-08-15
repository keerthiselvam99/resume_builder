import oracledb from 'oracledb';
import { RefreshTokenRecord } from '../../types/domain';
import { CreateRefreshTokenInput, RefreshTokenRepository } from '../interfaces';
import { TS_MASK, withConnection } from './common';

interface TokenRow {
  ID: string;
  USER_ID: string;
  TOKEN_HASH: string;
  EXPIRES_AT: string;
  REVOKED_AT: string | null;
  REPLACED_BY_ID: string | null;
  CREATED_AT: string;
}

export class OracleRefreshTokenRepository implements RefreshTokenRepository {
  async create(input: CreateRefreshTokenInput): Promise<void> {
    const createdAt = new Date().toISOString();
    return withConnection(async (conn) => {
      await conn.execute(
        `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at)
         VALUES (:id, :userId, :tokenHash,
                 TO_TIMESTAMP(:expiresAt, '${TS_MASK}'),
                 TO_TIMESTAMP(:createdAt, '${TS_MASK}'))`,
        {
          id: input.id,
          userId: input.userId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
          createdAt,
        }
      );
    });
  }

  async findByHash(hash: string): Promise<RefreshTokenRecord | null> {
    return withConnection(async (conn) => {
      const result = await conn.execute<TokenRow>(
        `SELECT id, user_id, token_hash,
                TO_CHAR(expires_at, '${TS_MASK}') AS expires_at,
                TO_CHAR(revoked_at, '${TS_MASK}') AS revoked_at,
                replaced_by_id,
                TO_CHAR(created_at, '${TS_MASK}') AS created_at
         FROM refresh_tokens
         WHERE token_hash = :hash`,
        { hash },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const row = result.rows?.[0];
      return row ? mapTokenRow(row) : null;
    });
  }

  async revoke(id: string, replacedById?: string): Promise<void> {
    return withConnection(async (conn) => {
      await conn.execute(
        `UPDATE refresh_tokens
         SET revoked_at = SYSTIMESTAMP, replaced_by_id = :replacedById
         WHERE id = :id AND revoked_at IS NULL`,
        { id, replacedById: replacedById ?? null }
      );
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    return withConnection(async (conn) => {
      await conn.execute(
        `UPDATE refresh_tokens
         SET revoked_at = SYSTIMESTAMP
         WHERE user_id = :userId AND revoked_at IS NULL`,
        { userId }
      );
    });
  }
}

function mapTokenRow(row: TokenRow): RefreshTokenRecord {
  return {
    id: row.ID,
    userId: row.USER_ID,
    tokenHash: row.TOKEN_HASH,
    expiresAt: row.EXPIRES_AT,
    revokedAt: row.REVOKED_AT,
    replacedById: row.REPLACED_BY_ID,
    createdAt: row.CREATED_AT,
  };
}
