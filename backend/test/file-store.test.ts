import { it, describe, expect, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFileRepositories } from '../src/repositories/file';
import { DEFAULT_TEMPLATE_ID } from '../src/types/domain';

describe('file-backed repository persistence (dev restart-survival)', () => {
  let dir = '';
  let filePath = '';

  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('survives a "restart": a second store sees the same data', async () => {
    dir = mkdtempSync(join(tmpdir(), 'resumeiq-file-'));
    filePath = join(dir, 'store.json');

    const first = createFileRepositories(filePath);
    await first.users.create({
      id: 'u-1',
      name: 'Arun',
      email: 'arun@example.com',
      passwordHash: 'hash',
      role: 'user',
    });
    await first.resumes.create({
      resumeId: 'r-1',
      userId: 'u-1',
      name: 'Master',
      templateId: DEFAULT_TEMPLATE_ID,
      versionId: 'v-1',
    });

    // Simulate a service restart: a brand-new repository set reading the file.
    const second = createFileRepositories(filePath);
    const user = await second.users.findByEmail('arun@example.com');
    expect(user?.name).toBe('Arun');
    const resume = await second.resumes.getForUser('u-1', 'r-1');
    expect(resume?.name).toBe('Master');
    expect(await second.resumes.getVersionForUser('u-1', 'v-1')).not.toBeNull();
  });

  it('persists content mutations across reloads', async () => {
    dir = mkdtempSync(join(tmpdir(), 'resumeiq-file2-'));
    filePath = join(dir, 'store.json');

    const first = createFileRepositories(filePath);
    await first.users.create({
      id: 'u-1',
      name: 'Arun',
      email: 'arun@example.com',
      passwordHash: 'hash',
      role: 'user',
    });
    await first.resumes.create({
      resumeId: 'r-1',
      userId: 'u-1',
      name: 'Master',
      templateId: DEFAULT_TEMPLATE_ID,
      versionId: 'v-1',
    });
    await first.resumes.updateContent('u-1', 'v-1', {
      ...(await (
        await import('../src/types/domain')
      ).emptyResumeContent),
      summary: 'Persisted summary',
    });

    const second = createFileRepositories(filePath);
    const version = await second.resumes.getVersionForUser('u-1', 'v-1');
    expect(version?.content.summary).toBe('Persisted summary');
  });
});
