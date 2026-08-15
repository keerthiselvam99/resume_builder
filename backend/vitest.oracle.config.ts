import { defineConfig } from 'vitest/config';

/**
 * Real-Oracle integration profile. Run only against a reachable Oracle with
 * credentials configured in the environment:
 *
 *   npx vitest run -c vitest.oracle.config.ts test/repositories.contract.test.ts
 *
 * Requires: ORACLE_USER, ORACLE_PASSWORD, ORACLE_CONNECT_STRING and
 * ORACLE_IT=1 (the contract suite only enables the Oracle adapter when this is
 * set). The migrations in database/migrations/ must already be applied.
 */
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['test/**/*.test.ts'],
    env: {
      DATA_STORE: 'oracle',
      ORACLE_IT: '1',
      AUTH_JWT_SECRET: 'oracle-it-secret-that-is-long-enough-1234567890',
    },
    // Real-DB tests are slow; raise timeouts and allow long hangs on CI-less runs.
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
