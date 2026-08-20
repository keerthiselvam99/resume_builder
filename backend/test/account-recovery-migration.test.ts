import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const sql = readFileSync(
  join(process.cwd(), '../database/migrations/006_account_recovery.sql'),
  'utf8'
);
describe('account recovery migration', () => {
  it('is idempotent and stores only token hashes', () => {
    expect(sql).toMatch(/user_tab_columns/i);
    expect(sql).toMatch(/token_hash/i);
    expect(sql).not.toMatch(/raw_token/i);
    expect(sql).toMatch(/verify_email/);
    expect(sql).toMatch(/reset_password/);
  });
  it('preserves existing users as verified and versions access sessions', () => {
    expect(sql).toMatch(/email_verified_at = created_at/i);
    expect(sql).toMatch(/auth_version/i);
  });
});
