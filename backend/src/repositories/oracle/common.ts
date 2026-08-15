import oracledb from 'oracledb';
import { Db } from '../../db/connection';

/**
 * CLOBs (resume content JSON) are returned as strings so rows can be mapped
 * directly to domain objects without streaming LOBs.
 */
oracledb.fetchAsString = [oracledb.CLOB];

/**
 * ISO-8601 format mask used when writing/reading timestamps so Oracle stores
 * the exact UTC string the domain layer produces.
 */
export const TS_MASK = 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"';

export async function withConnection<T>(fn: (conn: oracledb.Connection) => Promise<T>): Promise<T> {
  const connection = await Db.getConnection();
  try {
    return await fn(connection);
  } finally {
    await connection.close().catch(() => undefined);
  }
}

export function isDuplicateKey(err: unknown): boolean {
  return hasErrorNum(err, 1); // ORA-00001: unique constraint violated
}

export function isPublishedGuard(err: unknown): boolean {
  return hasErrorNum(err, 20001); // raised by the published-version trigger
}

function hasErrorNum(err: unknown, num: number): boolean {
  if (err && typeof err === 'object' && 'errorNum' in err) {
    return (err as { errorNum: number }).errorNum === num;
  }
  return false;
}

export interface OracleError {
  errorNum?: number;
  message?: string;
}
