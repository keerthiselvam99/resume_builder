# ResumeIQ — Smart Resume Builder

A resume-building application that helps users create professional resumes, check ATS readability, compare a resume with a job description, improve content, and download a job-specific PDF.

- **Frontend:** Angular 22.1.0 (pinned to generated patch version; supported through June 2028), TypeScript, RxJS/Signals
- **Backend:** Node.js 24 LTS, Express.js, TypeScript
- **Database:** Oracle Database (19c/23ai) with PL/SQL business logic
- **DB access:** `node-oracledb` Thin mode (no Instant Client required)

> The authoritative product specification lives in [docs/requirements.md](docs/requirements.md).

---

## Repository layout

```text
resume-iq/
├── frontend/     # Angular application
├── backend/      # Node.js 24 + Express + TypeScript REST API
├── database/     # Oracle migrations, PL/SQL packages/procedures/functions/triggers, seed data
├── docs/         # requirements.md, database-design.md, api-specification.yaml
└── README.md     # this file
```

---

## Current status

Foundation milestone in progress:

- [x] Angular application scaffolded
- [x] Node.js 24 + Express + TypeScript backend
- [x] Oracle connectivity via `node-oracledb` Thin mode
- [x] `/api/v1/health` endpoint (app + database status)
- [x] Angular health indicator wired to the backend
- [x] Database migration and seed folders
- [x] Linting (ESLint), formatting (Prettier), unit tests (Vitest)
- [x] `.env.example` — no real credentials committed
- [ ] End-to-end live verification against a running Oracle instance — **BLOCKED / NOT VERIFIED** (WSL2/Docker not yet available; gate is ready in `database/scripts/oracle-verify.ps1`)

Development order after the foundation: **Authentication → Resume CRUD → Live preview → Templates → PDF export → Versioning → ATS analysis → Job matching → Evidence-backed AI features.**

---

## Prerequisites

| Tool            | Version                                                      |
| --------------- | ------------------------------------------------------------ |
| Node.js         | 24 LTS (Node.js 20 is EOL — do not use)                      |
| npm             | 11+                                                          |
| Oracle Database | 19c or 23ai (local or container, e.g. `FREEPDB1`)            |
| Git             | Recommended, optional for local runs (used for versioning)   |

---

## Setup

### Full local application (recommended)

From this repository root, run:

```powershell
npm run start:full
```

This starts the Oracle-free in-memory backend on `http://127.0.0.1:3000`, warms
the PDF worker, and starts the HTTP frontend with the existing API proxy at
`http://127.0.0.1:4201`. Open that frontend URL, choose **Create account**, and
register with a test name, email, and password (or use **Log in** for an account
created during the current run). Backend liveness is available at `/livez`; PDF
readiness is available at `http://127.0.0.1:3000/pdfz` and returns HTTP 200 once
Chromium is warm. Press Ctrl+C once to stop both child processes.

Ports 3000 and 4201 are fixed. If startup reports an occupied port, stop the
process already listening on that port and run the command again. The in-memory
local repository intentionally resets accounts and resumes whenever the full
application is stopped; Oracle is not required.

### 1. Backend

```bash
cd backend
cp .env.example .env    # then fill in your Oracle credentials
npm install
npm run dev             # http://localhost:3000
```

Required `.env` values:

```env
ORACLE_USER=
ORACLE_PASSWORD=
ORACLE_CONNECT_STRING=localhost:1521/FREEPDB1
```

### 2. Provision Oracle and apply the schema

The canonical workflow lives in [database/README.md](database/README.md) — a
Dockerized Oracle Free instance, a one-time `--bootstrap` step, and a SYSTEM-free
migration runner. Follow it there rather than applying SQL by hand.

### 3. Frontend

```bash
cd frontend
npm install
npm start               # http://localhost:4200 (proxies /api → :3000)
```

---

## Health check

```bash
curl http://localhost:3000/api/v1/health
```

```json
{ "app": "ok", "database": "up", "timestamp": "...", "version": "0.1.0" }
```

If Oracle is unreachable, the endpoint returns HTTP 503 with `"database": "down"` instead of crashing.

The Angular app (`http://localhost:4200`) renders the same status via the health component.

---

## Scripts

### Backend (`cd backend`)

| Script            | Purpose                            |
| ----------------- | ---------------------------------- |
| `npm run dev`     | Run with `tsx watch`               |
| `npm run build`   | Compile TypeScript to `dist/`      |
| `npm start`       | Run compiled server                |
| `npm run lint`    | ESLint                             |
| `npm run format`  | Prettier write                     |
| `npm run format:check` | Prettier check                |
| `npm test`        | Vitest (unit + API tests)          |

### Frontend (`cd frontend`)

| Script               | Purpose                        |
| -------------------- | ------------------------------ |
| `npm start`          | Dev server on :4200            |
| `npm run build`      | Production build               |
| `npm test`           | Vitest unit tests              |
| `npm run lint`       | ESLint (TS + HTML templates)   |
| `npm run format`     | Prettier write                 |
| `npm run format:check` | Prettier check               |

---

## Security notes

- `.env` is git-ignored; only `.env.example` (no real credentials) is committed.
- Oracle queries use bind variables (parameterized) — no string interpolation into SQL.
- Resume content is never written to application logs.
- Passwords are hashed; refresh tokens are stored safely.

---

## Documentation

- [docs/production-email.md](docs/production-email.md) — Resend transactional-email setup and operational guidance

- [docs/requirements.md](docs/requirements.md) — authoritative product specification (FRs, DB design, PL/SQL packages, API endpoints, acceptance criteria)
- [database/README.md](database/README.md) — canonical Oracle provisioning + verification workflow
- `docs/database-design.md` — Oracle schema, recorded test Oracle version (pending)
- `docs/api-specification.yaml` — OpenAPI spec (pending)

## Handoff notes

- **Git is not installed** on this machine and is treated as a non-blocking environment limitation. No Git emulation or installation will be attempted unless explicitly authorized.
- No real Oracle credentials are committed. Live DB verification still requires a reachable Oracle instance and a filled `.env`.
