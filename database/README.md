# ResumeIQ — Oracle Database

Local Oracle Database Free (23ai, Dockerized) with a versioned, idempotent
migration runner and a runtime verification gate.

> **Status: BLOCKED / NOT VERIFIED.**
> The seven-step runtime gate has **not** been executed: WSL2/Docker is not yet
> available on this machine. Until it runs against a real instance, live Oracle
> behaviour is unverified. Static checks (script parsing, Compose config,
> lint, format, TypeScript build, secret scanning, `.env` ignore rules) pass.
> Do not claim otherwise.

---

## Layout

```text
database/
├── docker-compose.oracle.yml   # disposable Oracle Free container + named volume
├── .env.example                # credential template (copy to .env; git-ignored)
├── migrations/                 # versioned schema changes (001_*.sql …)
├── seed-data/                  # reference/seed rows (roles, …)
├── sql/
│   ├── 020_grant_runtime.sql   # direct runtime DML grants (tables + sequences, owner-run)
│   └── 040_reset_runtime_data.sql  # FK-safe runtime-data reset
└── scripts/
    ├── apply-migrations.mjs    # migration runner (bootstrap / deploy / reset / status)
    ├── sqlplus-run.sh          # in-container sqlplus wrapper (no creds on argv)
    └── oracle-verify.ps1       # 7-step runtime verification gate
```

---

## Canonical workflow

### Prerequisites

- **Docker Desktop with a WSL2 backend** (or another working Docker engine).
- **Node.js 24+** with the backend installed once: `cd backend && npm install`
  (the runner uses `backend/node_modules/oracledb`).
- `database/.env` copied from `.env.example` and filled in:
  `ORACLE_SYSTEM_PASSWORD`, `ORACLE_MIGRATE_PASSWORD`, `ORACLE_PASSWORD`
  (optional overrides: `ORACLE_SYSTEM_USER`, `ORACLE_MIGRATE_USER`,
  `ORACLE_USER`, `ORACLE_OWNER_SCHEMA`, `ORACLE_CONNECT_STRING`).

### 1. Start the database (once per machine state)

```bash
docker compose -f database/docker-compose.oracle.yml up -d
```

The container boots Oracle Free with a named volume (`oracle-data`). Credentials
come from `database/.env` — nothing is committed or placed on any command line.

### 2. Bootstrap the users (one-time, privileged)

```bash
node database/scripts/apply-migrations.mjs --bootstrap
```

Creates the schema owner (`RIQ_MIGRATE`) and the least-privileged runtime user
(`RIQ_APP`). Requires `ORACLE_SYSTEM_PASSWORD`. Idempotent; safe to re-run.

### 3. Apply migrations (every deployment, SYSTEM-free)

```bash
node database/scripts/apply-migrations.mjs
```

Applies any pending migrations/seeds as the schema owner and syncs the runtime
DML grants. Needs no SYSTEM credentials and never recreates users. Other modes:
`--reset-data` (FK-safe runtime-data wipe) and `--status`
(applied migration versions + checksums).

### 4. Run the backend against Oracle

Provide the runtime credentials to the backend (auto-selects Oracle when the
Oracle vars are present, or set `DATA_STORE=oracle`):

```bash
cd backend
ORACLE_USER=RIQ_APP ORACLE_PASSWORD=… ORACLE_CONNECT_STRING=localhost:1521/FREEPDB1 npm start
```

Every pooled session sets `CURRENT_SCHEMA` to the owner schema
(`ORACLE_OWNER_SCHEMA`, default `RIQ_MIGRATE`), so the repositories'
unqualified table names resolve to the owner's objects while access stays
gated by the direct DML grants.

### 5. Verify the runtime (7-step gate)

```bash
powershell -File database/scripts/oracle-verify.ps1          # reuse the current volume
powershell -File database/scripts/oracle-verify.ps1 -Fresh    # disposable volume, destroy+recreate
```

Steps:

1. Fresh database migration succeeds
2. Re-running migrations makes no changes
3. Oracle repository contracts pass
4. Full HTTP persistence E2E passes
5. Resume data survives a **backend process restart** (process killed, new one started)
6. Resume data survives an **Oracle container restart** (`docker compose restart` — never `down -v` here)
7. Cross-user access remains rejected

Every step reports PASS or FAIL; any failure exits non-zero. `-Fresh` requires
a typed `DESTROY` confirmation and validates that the target is the dedicated
disposable volume (`container_name: resumeiq-oracle`, single named volume
`oracle-data`) before running `down -v`. Without Docker the first step fails
loudly and the run is recorded **BLOCKED / NOT VERIFIED**.

### 6. Opt-in integration tests (no container needed to run the suite itself)

The same contract assertions run against the in-memory adapter on every `npm
test`. To additionally run them against real Oracle, apply migrations and use
the Oracle profile (gated on `ORACLE_IT=1`):

```bash
cd backend
ORACLE_IT=1 ORACLE_USER=… ORACLE_PASSWORD=… ORACLE_CONNECT_STRING=… \
  npx vitest run -c vitest.oracle.config.ts test/repositories.contract.test.ts
ORACLE_IT=1 ORACLE_USER=… ORACLE_PASSWORD=… ORACLE_CONNECT_STRING=… \
  npx vitest run -c vitest.oracle.config.ts test/oracle-persistence.e2e.test.ts
```

The Oracle repositories are only considered verified when these profiles pass
against a reachable, migrated database.

---

## Security notes

- `database/.env` is git-ignored; only `.env.example` (no credentials) is committed.
- Passwords are never stored in committed files, on a command line, or in the
  container process args — they reach the container as environment variables.
- The runtime user holds only `SELECT/INSERT/UPDATE/DELETE` via direct grants on
  the owner's tables and sequences (`sql/020_grant_runtime.sql`); it has no DDL
  privileges and no synonym machinery.
- `--bootstrap` is the only mode that needs SYSTEM, and it is an explicit,
  one-time, idempotent step.

## Migration naming

Zero-padded, ordered, descriptive (`001_foundation.sql`). The runner records a
SHA-256 checksum per file and refuses to apply a changed migration out of order.
