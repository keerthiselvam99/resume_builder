import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Admin Oracle migration and repository SQL', () => {
  const root = join(__dirname, '..', '..');
  const migration = readFileSync(join(root, 'database/migrations/005_admin_mvp.sql'), 'utf8');
  const repository = readFileSync(
    join(__dirname, '../src/repositories/oracle/oracle-user.repository.ts'),
    'utf8'
  );
  it('adds constrained account status and target audit fields idempotently', () => {
    expect(migration).toContain('status_code');
    expect(migration).toContain("'active','disabled'");
    expect(migration).toContain('target_user_id');
    expect(migration).toContain('SQLCODE != -1430');
  });
  it('adds list and audit indexes and advances schema version', () => {
    expect(migration).toContain('idx_app_users_admin_list');
    expect(migration).toContain('idx_audit_target_created');
    expect(migration).toContain("meta_value='005'");
  });
  it('uses database filtering/pagination and a shared admin lock', () => {
    expect(repository).toContain('OFFSET :offset ROWS FETCH NEXT :pageSize ROWS ONLY');
    expect(repository).toContain('LOWER(u.name) LIKE :needle');
    expect(repository).toContain("code = 'admin' FOR UPDATE");
  });
});
