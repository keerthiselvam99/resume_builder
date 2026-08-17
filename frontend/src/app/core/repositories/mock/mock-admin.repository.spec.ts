import { beforeEach, describe, expect, it } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { MockAdminRepository } from './mock-admin.repository';

describe('MockAdminRepository', () => {
  let repository: MockAdminRepository;
  beforeEach(() => {
    localStorage.clear();
    repository = new MockAdminRepository();
  });
  it('renders content-aware summary and seeded users', async () => {
    expect(await firstValueFrom(repository.summary())).toMatchObject({
      totalUsers: 3,
      adminCount: 1,
      activeUsers: 3,
    });
  });
  it('searches, filters and paginates deterministically', async () => {
    const result = await firstValueFrom(
      repository.users({ page: 1, pageSize: 1, q: 'casey', role: 'user', status: 'active' }),
    );
    expect(result.items.map((user) => user.email)).toEqual(['casey@example.com']);
    expect(result.totalPages).toBe(1);
  });
  it('persists role changes and audit events', async () => {
    await firstValueFrom(repository.updateRole('u-casey', 'admin'));
    expect(
      (
        await firstValueFrom(
          new MockAdminRepository().users({ page: 1, pageSize: 10, role: 'admin' }),
        )
      ).total,
    ).toBe(2);
    expect(
      (await firstValueFrom(repository.audits({ page: 1, pageSize: 10 }))).items[0].action,
    ).toBe('admin.role-granted');
  });
  it('persists status changes and updates summary counts', async () => {
    await firstValueFrom(repository.updateStatus('u-riley', 'disabled'));
    expect(await firstValueFrom(new MockAdminRepository().summary())).toMatchObject({
      activeUsers: 2,
      disabledUsers: 1,
    });
  });
  it('preserves mutations after repository recreation', async () => {
    await firstValueFrom(repository.updateStatus('u-casey', 'disabled'));
    const result = await firstValueFrom(
      new MockAdminRepository().users({ page: 1, pageSize: 10, status: 'disabled' }),
    );
    expect(result.items.map((user) => user.id)).toContain('u-casey');
  });
  it('returns an empty filtered state', async () => {
    expect(
      (await firstValueFrom(repository.users({ page: 1, pageSize: 10, q: 'nobody' }))).items,
    ).toEqual([]);
  });
});
