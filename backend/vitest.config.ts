import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['test/**/*.test.ts'],
    // The PDF-export spec launches a headless Chromium worker per test file.
    // When it runs concurrently with resume.api.test.ts (which also exports
    // PDFs), the cold-browser launch exceeds Vitest's 5000ms default timeout.
    // Serializing the files removes that CPU contention and makes the suite
    // deterministic. The longer timeout is headroom for slow compute/CI.
    fileParallelism: false,
    testTimeout: 15_000,
    // Tests always use the in-memory store regardless of any .env Oracle
    // credentials; the real-Oracle contract suite runs via vitest.oracle.config.ts.
    // Rate limits are raised so app-level suites (which register/log in many
    // times from one IP) do not trip the production defaults.
    env: {
      DATA_STORE: 'memory',
      AUTH_JWT_SECRET: 'test-only-secret-that-is-long-enough-1234567890',
      AUTH_RATE_LIMIT_LOGIN_MAX: '100000',
      AUTH_RATE_LIMIT_REGISTER_MAX: '100000',
      AUTH_RATE_LIMIT_REFRESH_MAX: '100000',
    },
  },
});
