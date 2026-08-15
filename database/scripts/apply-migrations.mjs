#!/usr/bin/env node
/**
 * ResumeIQ Oracle migration runner.
 *
 * Modes:
 *   --bootstrap     one-time privileged provisioning: create the schema owner
 *                   and least-privileged runtime user, then apply pending
 *                   migrations/seeds and sync grants (requires SYSTEM).
 *   default         apply pending migrations/seeds + grant-sync as the schema
 *                   owner. SYSTEM-free; run on every deployment.
 *   --reset-data    FK-safe runtime-data reset (requires housekeeping tables).
 *   --status        print applied migration versions + checksums.
 *
 * Design (locked down with the project owner):
 * - One owner/migration schema (ORACLE_MIGRATE_USER) owns the tables. A
 *   separate least-privileged runtime user (ORACLE_USER) gets only
 *   SELECT/INSERT/UPDATE/DELETE through direct grants — see
 *   sql/020_grant_runtime.sql. The backend sets CURRENT_SCHEMA to the owner
 *   schema on every pooled session so its unqualified table names resolve to
 *   the owner's objects; no synonyms are used. There are NO container
 *   bootstrap scripts.
 * - Privileged bootstrap (--bootstrap) is an explicit one-time step: it
 *   creates the users. After bootstrap, the normal command needs no SYSTEM
 *   credentials and never recreates users.
 * - Migration history: schema_migrations(version, checksum, description,
 *   applied_at). Checksums are SHA-256 of the file. Oracle DDL auto-commits,
 *   so migrations are NOT transactional — a failed migration may leave
 *   partial DDL and the runner records it only after it fully succeeds.
 * - Concurrency: a single-row SELECT ... FOR UPDATE NOWAIT lock held on a
 *   dedicated idle connection for the whole run prevents two runners.
 * - No password is committed or placed in argv: credentials come from
 *   database/.env (git-ignored) or the process environment, are validated,
 *   and are passed into the container as env vars only.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

const DB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(DB_DIR, '..');
const COMPOSE_FILE = path.join(DB_DIR, 'docker-compose.oracle.yml');
const BACKEND_ORACLEDB = path.join(REPO_ROOT, 'backend', 'node_modules', 'oracledb');

const MODES = process.argv.slice(2);
const resetOnly = MODES.includes('--reset-data');
const statusOnly = MODES.includes('--status');
const bootstrapOnly = MODES.includes('--bootstrap');

const oracledb = require(BACKEND_ORACLEDB);

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function log(message) {
  // eslint-disable-next-line no-console
  console.log(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function loadDotEnv(file) {
  const out = {};
  if (!existsSync(file)) {
    return out;
  }
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) {
      out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  return out;
}

function validateOracleIdentifier(name, value) {
  if (!/^[A-Za-z][A-Za-z0-9_$#]{0,29}$/.test(value)) {
    throw new Error(`${name}="${value}" is not a valid unquoted Oracle identifier.`);
  }
}

function validatePassword(name, value) {
  if (typeof value !== 'string' || value.length < 8 || value.length > 60) {
    throw new Error(`${name} must be 8-60 characters.`);
  }
  if (/[\s"@/&%`'()\\;]/.test(value)) {
    throw new Error(
      `${name} contains characters unsafe for sqlplus/printf. ` +
        'Allowed: letters, digits and -_#=+?!*[]{}:,.~^  (no spaces, quotes, @ / & % \\ \' ( ) ; ).'
    );
  }
}

function loadConfig({ requireSystem = false } = {}) {
  const envFile = loadDotEnv(path.join(DB_DIR, '.env'));
  const get = (key, dflt) => process.env[key] ?? envFile[key] ?? dflt;
  const cfg = {
    systemUser: get('ORACLE_SYSTEM_USER', 'SYSTEM'),
    systemPassword: get('ORACLE_SYSTEM_PASSWORD', ''),
    migrateUser: get('ORACLE_MIGRATE_USER', 'RIQ_MIGRATE'),
    migratePassword: get('ORACLE_MIGRATE_PASSWORD', ''),
    runtimeUser: get('ORACLE_USER', 'RIQ_APP'),
    runtimePassword: get('ORACLE_PASSWORD', ''),
    connectString: get('ORACLE_CONNECT_STRING', 'localhost:1521/FREEPDB1'),
  };

  for (const [key, value] of [
    ['ORACLE_MIGRATE_PASSWORD', cfg.migratePassword],
    ['ORACLE_PASSWORD', cfg.runtimePassword],
  ]) {
    if (!value) {
      throw new Error(
        `${key} is required. Copy database/.env.example to database/.env and fill in real values.`
      );
    }
  }

  if (requireSystem && !cfg.systemPassword) {
    throw new Error(
      'ORACLE_SYSTEM_PASSWORD is required for --bootstrap (one-time user provisioning). ' +
        'Copy database/.env.example to database/.env and fill in real values.'
    );
  }

  validateOracleIdentifier('ORACLE_SYSTEM_USER', cfg.systemUser);
  validateOracleIdentifier('ORACLE_MIGRATE_USER', cfg.migrateUser);
  validateOracleIdentifier('ORACLE_USER', cfg.runtimeUser);
  validatePassword('ORACLE_MIGRATE_PASSWORD', cfg.migratePassword);
  validatePassword('ORACLE_PASSWORD', cfg.runtimePassword);
  if (requireSystem) {
    validatePassword('ORACLE_SYSTEM_PASSWORD', cfg.systemPassword);
  }
  return cfg;
}

async function closeSafe(conn) {
  if (conn) {
    await conn.close().catch(() => undefined);
  }
}

async function connect(creds) {
  return oracledb.createConnection({
    user: creds.user,
    password: creds.password,
    connectString: creds.connectString,
  });
}

async function waitForOracle(creds, attempts = 120, gapMs = 5000) {
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const conn = await connect(creds);
      await closeSafe(conn);
      return;
    } catch (err) {
      if (i === attempts) {
        throw new Error(
          `Oracle at ${creds.connectString} did not become reachable after ${attempts} attempts. ` +
            'Start the container first:\n' +
            '  docker compose -f database/docker-compose.oracle.yml up -d\n' +
            `  (${err.message})`
        );
      }
      log(`[wait] Oracle not ready yet (${i}/${attempts})…`);
      await sleep(gapMs);
    }
  }
}

// ---------------------------------------------------------------------------
// sqlplus-in-container execution
// ---------------------------------------------------------------------------

function runSQLFile({ user, password, connectString, sqlFile, args = '' }) {
  const envEntries = {
    RIQ_ORA_USER: user,
    RIQ_ORA_PASSWORD: password,
    RIQ_ORA_CONNECT: connectString,
    RIQ_SQL_FILE: sqlFile,
    RIQ_SQL_ARGS: args,
  };
  const dockerArgs = ['compose', '-f', COMPOSE_FILE, 'exec', '-T'];
  for (const [key, value] of Object.entries(envEntries)) {
    dockerArgs.push('-e', `${key}=${value}`);
  }
  dockerArgs.push('oracle', 'bash', '/opt/oracle/scripts/sqlplus-run.sh');

  log(`[sql] ${sqlFile}`);
  const result = spawnSync('docker', dockerArgs, { stdio: 'inherit', encoding: 'utf8' });
  if (result.error) {
    throw new Error(`Failed to invoke docker: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`sqlplus exited with status ${result.status} while running ${sqlFile}`);
  }
}

// ---------------------------------------------------------------------------
// Bootstrap / housekeeping / lock
// ---------------------------------------------------------------------------

async function userExists(conn, userName) {
  const result = await conn.execute(
    'SELECT COUNT(*) AS c FROM dba_users WHERE username = :name',
    { name: userName.toUpperCase() },
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );
  return Number(result.rows?.[0]?.C ?? 0) > 0;
}

async function bootstrapUsers(sysConn, cfg) {
  const users = [
    {
      name: cfg.migrateUser,
      password: cfg.migratePassword,
      privileges: [
        'CREATE SESSION',
        'CREATE TABLE',
        'CREATE SEQUENCE',
        'CREATE TRIGGER',
        'CREATE PROCEDURE',
        'CREATE VIEW',
      ],
      quota: 'UNLIMITED',
    },
    {
      name: cfg.runtimeUser,
      password: cfg.runtimePassword,
      privileges: ['CREATE SESSION'],
      quota: '0',
    },
  ];

  for (const u of users) {
    if (await userExists(sysConn, u.name)) {
      log(`[bootstrap] user ${u.name} already exists`);
      continue;
    }
    const quotedUser = `"${u.name}"`;
    const quotedPassword = u.password.replace(/'/g, "''");
    await sysConn.execute(
      `CREATE USER ${quotedUser} IDENTIFIED BY '${quotedPassword}' ` +
        `DEFAULT TABLESPACE USERS QUOTA ${u.quota} ON USERS`
    );
    for (const privilege of u.privileges) {
      await sysConn.execute(`GRANT ${privilege} TO ${quotedUser}`);
    }
    log(`[bootstrap] created user ${u.name}`);
  }
}

async function ensureHousekeeping(conn) {
  await conn
    .execute(
      `CREATE TABLE schema_migrations (
         version      VARCHAR2(64) PRIMARY KEY,
         checksum     VARCHAR2(64) NOT NULL,
         description  VARCHAR2(255) NOT NULL,
         applied_at   TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP NOT NULL
       )`
    )
    .catch((err) => {
      if (err.errorNum !== 955) throw err; // ORA-00955: name already used
    });
  await conn
    .execute('CREATE TABLE schema_migration_lock (id NUMBER(1) PRIMARY KEY)')
    .catch((err) => {
      if (err.errorNum !== 955) throw err;
    });
  await conn
    .execute('INSERT INTO schema_migration_lock (id) VALUES (1)')
    .catch((err) => {
      if (err.errorNum !== 1) throw err; // ORA-00001: already seeded
    });
  await conn.commit();
}

async function acquireLock(conn, maxWaitMs = 60000) {
  const deadline = Date.now() + maxWaitMs;
  for (;;) {
    try {
      await conn.execute(
        'SELECT id FROM schema_migration_lock WHERE id = 1 FOR UPDATE NOWAIT',
        [],
        { autoCommit: false }
      );
      return;
    } catch (err) {
      if (err.errorNum === 54) {
        // ORA-00054: resource busy — another migration runner holds the lock
        if (Date.now() >= deadline) {
          throw new Error(
            'Another migration runner is holding schema_migration_lock. ' +
              'Wait for it to finish, or investigate before re-running.'
          );
        }
        log('[lock] another runner holds the migration lock; waiting…');
        await sleep(2000);
      } else {
        throw err;
      }
    }
  }
}

async function appliedVersions(conn) {
  const result = await conn.execute(
    'SELECT version, checksum FROM schema_migrations',
    [],
    { outFormat: oracledb.OUT_FORMAT_OBJECT }
  );
  return new Map((result.rows ?? []).map((row) => [row.VERSION, row.CHECKSUM]));
}

// ---------------------------------------------------------------------------
// Applying migrations and seeds
// ---------------------------------------------------------------------------

function listSqlFiles(dirName) {
  const dir = path.join(DB_DIR, dirName);
  return readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

async function applyScripts(workConn, applied, dirName, versionPrefix, cfg) {
  let appliedCount = 0;
  for (const file of listSqlFiles(dirName)) {
    const version = `${versionPrefix}${file.split('_')[0]}`;
    const raw = readFileSync(path.join(DB_DIR, dirName, file), 'utf8');
    const checksum = sha256(raw);
    const existing = applied.get(version);
    if (existing) {
      if (existing !== checksum) {
        throw new Error(
          `Checksum mismatch for ${dirName}/${file} (${version}): the file changed after it was applied.`
        );
      }
      continue;
    }
    runSQLFile({
      user: cfg.migrateUser,
      password: cfg.migratePassword,
      connectString: cfg.connectString,
      sqlFile: `/opt/oracle/${dirName}/${file}`,
    });
    await workConn.execute(
      `INSERT INTO schema_migrations (version, checksum, description, applied_at)
       VALUES (:version, :checksum, :description, SYSTIMESTAMP)`,
      { version, checksum, description: `${dirName}/${file}` }
    );
    await workConn.commit();
    appliedCount += 1;
    log(`[migrate] applied ${dirName}/${file} (${version})`);
  }
  return appliedCount;
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

async function runStatus(cfg) {
  try {
    const conn = await connect({
      user: cfg.migrateUser,
      password: cfg.migratePassword,
      connectString: cfg.connectString,
    });
    try {
      const applied = await appliedVersions(conn);
      if (applied.size === 0) {
        log('[status] no migrations have been applied yet');
        return;
      }
      log('[status] applied migrations:');
      for (const [version, checksum] of applied) {
        log(`  ${version}\t${checksum}`);
      }
    } finally {
      await closeSafe(conn);
    }
  } catch (err) {
    throw new Error(`Unable to read migration status: ${err.message}`);
  }
}

async function main() {
  const cfg = loadConfig({ requireSystem: bootstrapOnly });

  if (statusOnly) {
    await runStatus(cfg);
    return;
  }

  if (bootstrapOnly) {
    // One-time provisioning: the users may not exist yet, so wait/connect as SYSTEM.
    log('Bootstrap: provisioning users (SYSTEM).');
    await waitForOracle({
      user: cfg.systemUser,
      password: cfg.systemPassword,
      connectString: cfg.connectString,
    });
    const sysConn = await connect({
      user: cfg.systemUser,
      password: cfg.systemPassword,
      connectString: cfg.connectString,
    });
    try {
      await bootstrapUsers(sysConn, cfg);
    } finally {
      await closeSafe(sysConn);
    }
  } else {
    // Deploy runs are SYSTEM-free; the users exist after --bootstrap.
    await waitForOracle({
      user: cfg.migrateUser,
      password: cfg.migratePassword,
      connectString: cfg.connectString,
    });
  }

  if (resetOnly) {
    const resetConn = await connect({
      user: cfg.migrateUser,
      password: cfg.migratePassword,
      connectString: cfg.connectString,
    });
    try {
      await ensureHousekeeping(resetConn);
      await acquireLock(resetConn);
      runSQLFile({
        user: cfg.migrateUser,
        password: cfg.migratePassword,
        connectString: cfg.connectString,
        sqlFile: '/opt/oracle/sql/040_reset_runtime_data.sql',
      });
      log('[reset] runtime data cleared');
    } finally {
      await closeSafe(resetConn);
    }
    return;
  }

  // Migration run: the lock is held by a dedicated idle connection so it
  // survives the individual sqlplus sessions and dies with the process.
  const lockConn = await connect({
    user: cfg.migrateUser,
    password: cfg.migratePassword,
    connectString: cfg.connectString,
  });
  const workConn = await connect({
    user: cfg.migrateUser,
    password: cfg.migratePassword,
    connectString: cfg.connectString,
  });
  try {
    await ensureHousekeeping(workConn);
    await acquireLock(lockConn);

    const applied = await appliedVersions(workConn);
    const migrationsApplied = await applyScripts(workConn, applied, 'migrations', '', cfg);
    const seedsApplied = await applyScripts(workConn, applied, 'seed-data', 'seed-', cfg);

    // Direct DML grants run inside the same lock, every deployment. The schema
    // owner runs them (it owns the tables/sequences), so deployments never
    // need SYSTEM.
    runSQLFile({
      user: cfg.migrateUser,
      password: cfg.migratePassword,
      connectString: cfg.connectString,
      sqlFile: '/opt/oracle/sql/020_grant_runtime.sql',
      args: `${cfg.migrateUser} ${cfg.runtimeUser}`,
    });
    log('[grant] runtime DML privileges synced');

    log(`[migrate] applied ${migrationsApplied} migration(s), ${seedsApplied} seed(s)`);
    if (migrationsApplied === 0 && seedsApplied === 0) {
      log('[migrate] no pending migrations; nothing changed');
    }
  } finally {
    await closeSafe(lockConn);
    await closeSafe(workConn);
  }
}

main().catch((err) => {
  log(`[error] ${err.stack ?? err.message}`);
  process.exitCode = 1;
});
