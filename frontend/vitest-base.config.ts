import { defineConfig } from 'vitest/config';

// Loaded by the Angular unit-test builder (@angular/build:unit-test) via the
// "runnerConfig": true option. Supplements the builder's generated Vitest
// configuration.
//
// Rationale:
//  - sequence.concurrent: false keeps tests within a file strictly sequential,
//    removing ordering-dependent flakes in the editor/gallery suites.
//  - Generous timeouts mean a loaded CI/parallel run never kills a test that is
//    merely slow; the suites themselves poll for conditions rather than sleep.
//  - retry: 0 keeps runs authoritative — a failure is a failure, not something
//    hidden by automatic reruns.
export default defineConfig({
  test: {
    sequence: { concurrent: false },
    testTimeout: 15_000,
    hookTimeout: 30_000,
    retry: 0,
  },
});
