export interface HealthStatus {
  app: 'ok';
  database: 'up' | 'down';
  timestamp: string;
  version: string;
}
