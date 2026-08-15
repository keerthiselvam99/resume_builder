import oracledb from 'oracledb';
import { config } from '../config/config';

export class Db {
  private static pool: oracledb.Pool | null = null;

  private static async createPool(): Promise<oracledb.Pool> {
    const { user, password, connectString, poolMin, poolMax, poolIncrement } = config.oracle;

    if (!user || !password || !connectString) {
      throw new Error(
        'Missing Oracle configuration. Set ORACLE_USER, ORACLE_PASSWORD and ORACLE_CONNECT_STRING in the environment.'
      );
    }

    oracledb.autoCommit = true;

    this.pool = await oracledb.createPool({
      user,
      password,
      connectString,
      poolMin,
      poolMax,
      poolIncrement,
      poolTimeout: 60,
      // Resolve the repositories' unqualified table names against the owner
      // schema on every new pooled session. Access is still gated by the
      // direct DML grants (sql/020_grant_runtime.sql); CURRENT_SCHEMA only
      // sets the resolution scope. ownerSchema is validated in config.ts.
      sessionCallback: async (connection: oracledb.Connection): Promise<void> => {
        await connection.execute(
          `ALTER SESSION SET CURRENT_SCHEMA = "${config.oracle.ownerSchema}"`
        );
      },
    });

    return this.pool;
  }

  static async getPool(): Promise<oracledb.Pool> {
    if (!this.pool) {
      this.pool = await this.createPool();
    }
    return this.pool;
  }

  static async getConnection(): Promise<oracledb.Connection> {
    const pool = await this.getPool();
    return pool.getConnection();
  }

  static async close(): Promise<void> {
    if (this.pool) {
      await this.pool.close(0);
      this.pool = null;
    }
  }

  static isInitialized(): boolean {
    return this.pool !== null;
  }
}
