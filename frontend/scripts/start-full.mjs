#!/usr/bin/env node
// Launches the full local application: the backend API with the PDF worker
// pre-warmed plus the HTTP-mode frontend (useMockApi=false) on port 4201, where
// the Download PDF button talks to the real, verified export service.
//
//   npm run start:full
//
// Demo mode (npm start, port 4200) deliberately disables PDF export because
// there is no backend to render it. Use this script instead to get working PDF
// download: http://127.0.0.1:4201
//
// Both processes are spawned as `node` directly (their JS entry points), not
// through npm.cmd/.sh: on Windows, spawning a `.cmd` wrapper throws EINVAL
// under recent Node versions and shares a cmd batch job with the caller's
// console, which makes Ctrl+C show a hanging "Terminate batch job" prompt.

import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const backendDir = join(root, '..', 'backend');

// Windows processes can carry non-string (undefined) env entries that make
// child_process.spawn throw EINVAL; copy only string values, then override.
function safeEnv(extra = {}) {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') {
      env[key] = value;
    }
  }
  return { ...env, ...extra };
}

function run(nodeArgs, cwd, env, label) {
  const child = spawn(process.execPath, nodeArgs, {
    cwd,
    env,
    stdio: 'inherit',
    windowsHide: true,
  });
  child.on('error', (err) => {
    console.error(`[start:full] failed to start ${label}: ${err.message}`);
  });
  return child;
}

const backend = run(
  [join(backendDir, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'src/server.ts'],
  backendDir,
  safeEnv({ PDF_WARMUP: 'true', DATA_STORE: 'memory', DEV_EMAIL_CAPTURE: 'true' }),
  'backend',
);

const frontend = run(
  [
    join(root, 'node_modules', '@angular', 'cli', 'bin', 'ng.js'),
    'serve',
    '--configuration',
    'e2e-http',
    '--host',
    '127.0.0.1',
    '--port',
    '4201',
  ],
  root,
  safeEnv(),
  'frontend',
);

function shutdown() {
  backend.kill('SIGTERM');
  frontend.kill('SIGTERM');
}

process.on('SIGINT', () => {
  shutdown();
  process.exit(130);
});
process.on('SIGTERM', () => {
  shutdown();
  process.exit(143);
});

const exit = (label) => (code) => {
  console.error(`[start:full] ${label} exited with code ${code ?? 0}; stopping the other process.`);
  shutdown();
  process.exit(code ?? 0);
};

backend.on('exit', exit('backend'));
frontend.on('exit', exit('frontend'));

console.log('[start:full] Full application starting…');
console.log('[start:full]   Backend API : http://127.0.0.1:3000  (PDF worker warm-up enabled)');
console.log('[start:full]   Full app     : http://127.0.0.1:4201  (Download PDF works here)');
console.log('[start:full]   Press Ctrl+C to stop.');
