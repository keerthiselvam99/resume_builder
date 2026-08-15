/**
 * Drift guard for the generated shared catalogue.
 *
 * Runs the generator's deterministic `--check` mode against the checked-in
 * root/shared/ats-template-catalogue.ts so a frontend catalogue change that
 * was not regenerated fails CI (via `npm run catalogue:check`). The file is
 * compared line-for-line against a fresh render of the frontend template
 * catalogue; no backend code imports frontend source at runtime.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const backendDir = resolve(__dirname, '..');
const outPath = resolve(backendDir, '../shared/ats-template-catalogue.ts');

function runCheck(): { stdout: string; stderr: string } {
  const result = execSync('npm run catalogue:check --silent', {
    cwd: backendDir,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { stdout: result, stderr: '' };
}

describe('generated ATS template catalogue', () => {
  test('checked-in file matches a fresh render of the frontend catalogue', () => {
    expect(() => runCheck()).not.toThrow();
  });

  test('reports all 100 template profiles', () => {
    const { stdout } = runCheck();
    expect(stdout).toMatch(/\(100 profiles\)/);
  });

  test('rejects a stale checked-in file', () => {
    const original = readFileSync(outPath, 'utf8');
    try {
      writeFileSync(
        outPath,
        original.replace(
          "DEFAULT_ATS_TEMPLATE_ID = 't-classic-ats-navy'",
          "DEFAULT_ATS_TEMPLATE_ID = 't-classic-ats-navy-stale'"
        ),
        'utf8'
      );
      expect(() => runCheck()).toThrow();
    } finally {
      writeFileSync(outPath, original, 'utf8');
    }
    expect(() => runCheck()).not.toThrow();
  });
});
