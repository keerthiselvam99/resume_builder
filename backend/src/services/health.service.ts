import { Db } from '../db/connection';

export interface LivenessStatus {
  status: 'ok';
  timestamp: string;
  version: string;
}

export interface HealthStatus {
  app: 'ok';
  database: 'up' | 'down';
  timestamp: string;
  version: string;
}

export class HealthService {
  /**
   * Liveness: the process is up and responding. Deliberately independent of
   * Oracle so orchestration can tell "the app is running" apart from "the
   * app is ready to serve traffic". Synchronous so it cannot hang.
   */
  getLive(): LivenessStatus {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.1.0',
    };
  }

  async getHealth(): Promise<HealthStatus> {
    let database: 'up' | 'down' = 'down';

    let connection;
    try {
      connection = await Db.getConnection();
      const result = await connection.execute<{ STATUS: number }>(
        'SELECT 1 AS STATUS FROM DUAL',
        [],
        { outFormat: 2 }
      );
      if (result.rows && result.rows.length > 0) {
        database = 'up';
      }
    } catch {
      database = 'down';
    } finally {
      if (connection) {
        try {
          await connection.close();
        } catch {
          // ignore close error
        }
      }
    }

    return {
      app: 'ok',
      database,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? '0.1.0',
    };
  }
}
