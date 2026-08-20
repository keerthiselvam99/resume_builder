import { defineConfig, devices } from '@playwright/test';

const MOCK_BASE = 'http://127.0.0.1:4200';
const HTTP_BASE = 'http://127.0.0.1:4201';
const BACKEND_URL = 'http://127.0.0.1:3000';

// Authoritative E2E runs always start fresh web servers; reusing a stale dev
// server can silently produce misleading results. Server reuse is opt-in for
// local development only and requires the explicit flag below:
//
//   E2E_REUSE_SERVERS=1 npm run e2e
const reuseExistingServer = process.env['E2E_REUSE_SERVERS'] === '1';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: process.env['CI'] ? 2 : 0,
  reporter: 'html',

  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  webServer: [
    {
      // Backend API (auth, resumes, versions, PDF export). /livez is the
      // Oracle-free liveness probe: it returns 200 without database access.
      command: 'npm run serve',
      cwd: '../backend',
      url: `${BACKEND_URL}/livez`,
      reuseExistingServer,
      timeout: 120_000,
      env: {
        DATA_STORE: 'memory',
        AUTH_JWT_SECRET: 'resumeiq-e2e-insecure-secret-at-least-16-chars',
        AUTH_RATE_LIMIT_REGISTER_MAX: '10000',
        AUTH_RATE_LIMIT_LOGIN_MAX: '10000',
        AUTH_RATE_LIMIT_REFRESH_MAX: '10000',
        ADMIN_BOOTSTRAP_EMAIL: 'admin.e2e@example.com',
        NODE_ENV: 'test',
        EMAIL_PROVIDER: 'capture',
        PUBLIC_APP_URL: 'http://127.0.0.1:4201',
        E2E_LEGACY_AUTO_VERIFY: 'true',
        // Warm the PDF Chromium worker at boot so the first real export never
        // pays the cold browser-launch cost inside the response budget. The
        // pdf-export spec polls /pdfz before exporting as the readiness gate.
        PDF_WARMUP: 'true',
      },
    },
    {
      // Mock track: Angular with localStorage-backed repositories (the app's
      // default environment). Only /api/pdf is reached through the proxy.
      command: 'npm run start -- --host 127.0.0.1 --port 4200',
      url: MOCK_BASE,
      reuseExistingServer,
      timeout: 120_000,
    },
    {
      // HTTP track: Angular built with useMockApi=false, so every /api call
      // goes through the dev-server proxy to the real backend on :3000.
      command: 'npm run start -- --configuration e2e-http --host 127.0.0.1 --port 4201',
      url: HTTP_BASE,
      reuseExistingServer,
      timeout: 120_000,
    },
  ],

  projects: [
    {
      // Existing UI journey against the mock repositories. The snapshot
      // baselines below named after this project.
      name: 'chromium',
      testIgnore:
        /(editor-http-persistence|ats-analysis-http|pdf-export|dummy-resume-acceptance|job-matcher-acceptance|admin-acceptance|account-recovery-acceptance)\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: MOCK_BASE,
      },
    },
    {
      // Real-backend persistence, cross-user isolation and PDF export checks.
      // Kept in a disjoint project so they never run against the mock server.
      // Serial: these tests share one live backend, one dev-server proxy and
      // one Chromium PDF worker; parallelizing them crashes page sessions under
      // concurrent heavy preview rendering, so they must not be fullyParallel.
      workers: 1,
      name: 'http-persistence',
      testMatch:
        /(editor-http-persistence|ats-analysis-http|pdf-export|dummy-resume-acceptance|job-matcher-acceptance|admin-acceptance|account-recovery-acceptance)\.spec\.ts$/,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: HTTP_BASE,
      },
    },
  ],
});
