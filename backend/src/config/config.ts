import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

function resolveDataStore(): 'oracle' | 'file' | 'memory' {
  const explicit = process.env.DATA_STORE;
  if (explicit === 'oracle' || explicit === 'file' || explicit === 'memory') {
    return explicit;
  }
  const hasOracle =
    Boolean(process.env.ORACLE_USER) &&
    Boolean(process.env.ORACLE_PASSWORD) &&
    Boolean(process.env.ORACLE_CONNECT_STRING);
  return hasOracle ? 'oracle' : 'memory';
}

function resolveJwtSecret(): string {
  const secret = process.env.AUTH_JWT_SECRET;
  if (secret && secret.length >= 16) {
    return secret;
  }
  if (isProduction) {
    throw new Error(
      'AUTH_JWT_SECRET must be set to a value of at least 16 characters in production.'
    );
  }
  return 'resumeiq-dev-only-insecure-secret-change-me';
}

/**
 * Unquoted Oracle identifier (mirrors the migration runner's rule). The owner
 * schema is interpolated into `ALTER SESSION SET CURRENT_SCHEMA`, so it must
 * be locked down before it is ever quoted into SQL.
 */
function resolveOwnerSchema(): string {
  const value = process.env.ORACLE_OWNER_SCHEMA ?? 'RIQ_MIGRATE';
  if (!/^[A-Za-z][A-Za-z0-9_$#]{0,29}$/.test(value)) {
    throw new Error(`ORACLE_OWNER_SCHEMA="${value}" is not a valid unquoted Oracle identifier.`);
  }
  return value;
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:4200',
  bodyLimit: process.env.BODY_LIMIT ?? '1mb',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  pdf: {
    generationTimeoutMs: parseInt(process.env.PDF_GENERATION_TIMEOUT_MS ?? '60000', 10),
    maxHtmlBytes: parseInt(process.env.PDF_MAX_HTML_BYTES ?? '2097152', 10),
    maxContentBytes: parseInt(process.env.PDF_MAX_CONTENT_BYTES ?? '524288', 10),
    maxConcurrency: parseInt(process.env.PDF_MAX_CONCURRENCY ?? '2', 10),
    maxQueue: parseInt(process.env.PDF_MAX_QUEUE ?? '4', 10),
    maxPages: parseInt(process.env.PDF_MAX_PAGES ?? '200', 10),
    /**
     * When true, PDF export diagnostics (filename, network attempts, link
     * annotations) are exposed as response headers in addition to being logged.
     * Off by default: public responses expose only page count and request id.
     */
    debug: process.env.PDF_EXPORT_DEBUG === 'true',
  },
  oracle: {
    user: process.env.ORACLE_USER,
    password: process.env.ORACLE_PASSWORD,
    connectString: process.env.ORACLE_CONNECT_STRING,
    /**
     * Schema that owns the tables. Every pooled runtime session sets
     * CURRENT_SCHEMA to it so the repositories' unqualified table names
     * resolve to the owner's objects (access still requires the direct DML
     * grants from sql/020_grant_runtime.sql).
     */
    ownerSchema: resolveOwnerSchema(),
    poolMin: parseInt(process.env.ORACLE_POOL_MIN ?? '0', 10),
    poolMax: parseInt(process.env.ORACLE_POOL_MAX ?? '10', 10),
    poolIncrement: parseInt(process.env.ORACLE_POOL_INCREMENT ?? '1', 10),
  },
  /**
   * Which data store backs the repositories:
   *   memory  - in-memory (tests, throwaway dev)
   *   file    - dev-only JSON-file persistence (enables restart-survival without Oracle)
   *   oracle  - real Oracle Database (requires ORACLE_* env vars)
   * Defaults to oracle when credentials are present, otherwise memory.
   */
  dataStore: resolveDataStore(),
  fileStorePath: process.env.FILE_STORE_PATH ?? 'data/resumeiq-store.json',
  auth: {
    jwtSecret: resolveJwtSecret(),
    accessTokenTtlSeconds: parseInt(process.env.AUTH_ACCESS_TOKEN_TTL_SECONDS ?? '900', 10),
    refreshTokenTtlDays: parseInt(process.env.AUTH_REFRESH_TOKEN_TTL_DAYS ?? '30', 10),
    cookieName: process.env.AUTH_COOKIE_NAME ?? 'refresh_token',
    /**
     * Secure cookies require HTTPS. In production this defaults to true;
     * in local development over http it must be false or the browser drops it.
     */
    cookieSecure: process.env.AUTH_COOKIE_SECURE === 'true' || isProduction,
    passwordMaxLength: 128,
    verificationTtlHours: parseInt(process.env.AUTH_VERIFICATION_TTL_HOURS ?? '24', 10),
    resetTtlMinutes: parseInt(process.env.AUTH_RESET_TTL_MINUTES ?? '30', 10),
    appOrigin: process.env.APP_ORIGIN ?? 'http://127.0.0.1:4201',
    rateLimit: {
      loginMax: parseInt(process.env.AUTH_RATE_LIMIT_LOGIN_MAX ?? '100', 10),
      registerMax: parseInt(process.env.AUTH_RATE_LIMIT_REGISTER_MAX ?? '20', 10),
      refreshMax: parseInt(process.env.AUTH_RATE_LIMIT_REFRESH_MAX ?? '200', 10),
      windowMs: 15 * 60 * 1000,
    },
  },
} as const;
