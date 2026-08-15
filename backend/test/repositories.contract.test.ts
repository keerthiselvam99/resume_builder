import { describe, expect, it } from 'vitest';
import { ConflictError, NotFoundError } from '../src/http/errors';
import { createMemoryRepositories, MemoryStore, RepositorySet } from '../src/repositories/memory';
import { getRepositories } from '../src/repositories';
import { DEFAULT_TEMPLATE_ID, emptyResumeContent } from '../src/types/domain';

/**
 * The same assertions run against every adapter (memory always; Oracle only in
 * the opt-in profile). This is what makes the repository interfaces the single
 * source of truth between the fake and the real database.
 */

const oracleEnabled = process.env.ORACLE_IT === '1';

function memorySet(): RepositorySet {
  return createMemoryRepositories(new MemoryStore());
}

function runContract(name: string, factory: () => RepositorySet): void {
  describe(`repository contract — ${name}`, () => {
    it('creates and looks up a user by email and id', async () => {
      const set = factory();
      const created = await set.users.create({
        id: 'u-1',
        name: 'Arun Kumar',
        email: 'arun@example.com',
        passwordHash: 'hash',
        role: 'user',
      });
      expect(created.email).toBe('arun@example.com');
      expect(created.role).toBe('user');

      const byEmail = await set.users.findByEmail('ARUN@example.com');
      expect(byEmail?.id).toBe('u-1');
      const byId = await set.users.findById('u-1');
      expect(byId?.name).toBe('Arun Kumar');
      expect(await set.users.findByEmail('missing@example.com')).toBeNull();
    });

    it('rejects a duplicate email', async () => {
      const set = factory();
      await set.users.create({
        id: 'u-a',
        name: 'A',
        email: 'dup@example.com',
        passwordHash: 'h',
        role: 'user',
      });
      await expect(
        set.users.create({
          id: 'u-b',
          name: 'B',
          email: 'DUP@example.com',
          passwordHash: 'h',
          role: 'user',
        })
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('creates a resume with a master version and marks the first one primary', async () => {
      const set = factory();
      await seedUser(set, 'u-1');
      const first = await set.resumes.create({
        resumeId: 'r-1',
        userId: 'u-1',
        name: 'Master Resume',
        templateId: 't-classic-ats-navy',
        versionId: 'v-1',
      });
      expect(first.primary).toBe(true);

      const second = await set.resumes.create({
        resumeId: 'r-2',
        userId: 'u-1',
        name: 'Second',
        templateId: 't-premium-sidebar-navy',
        versionId: 'v-2',
      });
      expect(second.primary).toBe(false);

      const versions = await set.resumes.listVersions('u-1', 'r-1');
      expect(versions).toHaveLength(1);
      expect(versions[0].isMaster).toBe(true);
      expect(versions[0].templateId).toBe('t-classic-ats-navy');
      expect(versions[0].content).toEqual(emptyResumeContent);
    });

    it('scopes resumes and versions to the owning user', async () => {
      const set = factory();
      await seedUser(set, 'u-owner');
      await seedUser(set, 'u-other');
      await set.resumes.create({
        resumeId: 'r-own',
        userId: 'u-owner',
        name: 'Mine',
        templateId: DEFAULT_TEMPLATE_ID,
        versionId: 'v-own',
      });

      expect(await set.resumes.getForUser('u-owner', 'r-own')).not.toBeNull();
      expect(await set.resumes.getForUser('u-other', 'r-own')).toBeNull();
      expect(await set.resumes.listForUser('u-other')).toHaveLength(0);
      expect(await set.resumes.getVersionForUser('u-owner', 'v-own')).not.toBeNull();
      expect(await set.resumes.getVersionForUser('u-other', 'v-own')).toBeNull();
    });

    it('renames and renames only the target', async () => {
      const set = factory();
      await seedUser(set, 'u-1');
      await set.resumes.create({
        resumeId: 'r-1',
        userId: 'u-1',
        name: 'Old',
        templateId: DEFAULT_TEMPLATE_ID,
        versionId: 'v-1',
      });
      const renamed = await set.resumes.rename('u-1', 'r-1', 'New');
      expect(renamed.name).toBe('New');
      expect((await set.resumes.getForUser('u-1', 'r-1'))?.name).toBe('New');
      await expect(set.resumes.rename('u-other', 'r-1', 'x')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('duplicates a resume and clones its master version', async () => {
      const set = factory();
      await seedUser(set, 'u-1');
      await set.resumes.create({
        resumeId: 'r-1',
        userId: 'u-1',
        name: 'Master',
        templateId: 't-developer-console-navy',
        versionId: 'v-1',
      });
      const copy = await set.resumes.duplicate('u-1', 'r-1');
      expect(copy.id).not.toBe('r-1');
      expect(copy.name).toBe('Master (copy)');
      expect(copy.primary).toBe(false);
      expect(copy.status).toBe('draft');

      const versions = await set.resumes.listVersions('u-1', copy.id);
      expect(versions).toHaveLength(1);
      expect(versions[0].templateId).toBe('t-developer-console-navy');
      expect(versions[0].isMaster).toBe(true);
    });

    it('creates a resume as draft and marks it saved via markSaved', async () => {
      const set = factory();
      await seedUser(set, 'u-1');
      await set.resumes.create({
        resumeId: 'r-1',
        userId: 'u-1',
        name: 'R',
        templateId: DEFAULT_TEMPLATE_ID,
        versionId: 'v-1',
      });
      expect((await set.resumes.getForUser('u-1', 'r-1'))?.status).toBe('draft');

      const saved = await set.resumes.markSaved('u-1', 'r-1');
      expect(saved.status).toBe('saved');
      expect((await set.resumes.getForUser('u-1', 'r-1'))?.status).toBe('saved');

      const idempotent = await set.resumes.markSaved('u-1', 'r-1');
      expect(idempotent.status).toBe('saved');
      await expect(set.resumes.markSaved('u-other', 'r-1')).rejects.toBeInstanceOf(NotFoundError);
    });

    it('setPrimary leaves exactly one primary per user', async () => {
      const set = factory();
      await seedUser(set, 'u-1');
      for (const id of ['r-1', 'r-2', 'r-3']) {
        await set.resumes.create({
          resumeId: id,
          userId: 'u-1',
          name: id,
          templateId: DEFAULT_TEMPLATE_ID,
          versionId: `v-${id}`,
        });
      }
      await set.resumes.setPrimary('u-1', 'r-3');
      const all = await set.resumes.listForUser('u-1');
      expect(all.filter((r) => r.primary)).toHaveLength(1);
      expect(all.find((r) => r.id === 'r-3')?.primary).toBe(true);
    });

    it('delete removes the resume and its versions', async () => {
      const set = factory();
      await seedUser(set, 'u-1');
      await set.resumes.create({
        resumeId: 'r-1',
        userId: 'u-1',
        name: 'R',
        templateId: DEFAULT_TEMPLATE_ID,
        versionId: 'v-1',
      });
      await set.resumes.createVersion('u-1', {
        versionId: 'v-2',
        resumeId: 'r-1',
        name: 'Tailored',
      });
      await set.resumes.delete('u-1', 'r-1');
      expect(await set.resumes.getForUser('u-1', 'r-1')).toBeNull();
      expect(await set.resumes.listVersions('u-1', 'r-1')).toHaveLength(0);
    });

    it('creates a version from a source version', async () => {
      const set = factory();
      await seedUser(set, 'u-1');
      await set.resumes.create({
        resumeId: 'r-1',
        userId: 'u-1',
        name: 'R',
        templateId: 't-executive-banner-navy',
        versionId: 'v-1',
      });
      await set.resumes.updateContent('u-1', 'v-1', {
        ...emptyResumeContent,
        summary: 'Hello world',
      });
      const version = await set.resumes.createVersion('u-1', {
        versionId: 'v-2',
        resumeId: 'r-1',
        name: 'Tailored',
        sourceVersionId: 'v-1',
      });
      expect(version.isTailored).toBe(true);
      expect(version.templateId).toBe('t-executive-banner-navy');
      expect(version.content.summary).toBe('Hello world');
    });

    it('clones a version preserving content and flags', async () => {
      const set = factory();
      await seedUser(set, 'u-1');
      await set.resumes.create({
        resumeId: 'r-1',
        userId: 'u-1',
        name: 'R',
        templateId: 't-classic-ats-navy',
        versionId: 'v-1',
      });
      await set.resumes.updateContent('u-1', 'v-1', { ...emptyResumeContent, skills: ['Angular'] });
      const clone = await set.resumes.cloneVersion('u-1', 'v-1', 'Clone');
      expect(clone.id).not.toBe('v-1');
      expect(clone.content.skills).toEqual(['Angular']);
      expect(clone.published).toBe(false);
      expect(clone.isMaster).toBe(false);
    });

    it('publishes a version and then blocks content/template edits', async () => {
      const set = factory();
      await seedUser(set, 'u-1');
      await set.resumes.create({
        resumeId: 'r-1',
        userId: 'u-1',
        name: 'R',
        templateId: 't-classic-ats-navy',
        versionId: 'v-1',
      });
      const published = await set.resumes.publishVersion('u-1', 'v-1');
      expect(published.published).toBe(true);

      await expect(
        set.resumes.updateContent('u-1', 'v-1', { ...emptyResumeContent, summary: 'x' })
      ).rejects.toBeInstanceOf(ConflictError);
      await expect(
        set.resumes.updateTemplate('u-1', 'v-1', 't-premium-sidebar-navy')
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it('persists content and template updates', async () => {
      const set = factory();
      await seedUser(set, 'u-1');
      await set.resumes.create({
        resumeId: 'r-1',
        userId: 'u-1',
        name: 'R',
        templateId: 't-classic-ats-navy',
        versionId: 'v-1',
      });
      const content = {
        ...emptyResumeContent,
        summary: 'Updated summary',
        skills: ['Oracle', 'PL/SQL'],
      };
      const updated = await set.resumes.updateContent('u-1', 'v-1', content);
      expect(updated.content.summary).toBe('Updated summary');
      expect((await set.resumes.getVersionForUser('u-1', 'v-1'))?.content.skills).toEqual([
        'Oracle',
        'PL/SQL',
      ]);

      const templated = await set.resumes.updateTemplate('u-1', 'v-1', 't-editorial-navy');
      expect(templated.templateId).toBe('t-editorial-navy');
    });

    it('compares two versions and reports missing ones as null', async () => {
      const set = factory();
      await seedUser(set, 'u-1');
      await set.resumes.create({
        resumeId: 'r-1',
        userId: 'u-1',
        name: 'R',
        templateId: DEFAULT_TEMPLATE_ID,
        versionId: 'v-1',
      });
      await set.resumes.createVersion('u-1', { versionId: 'v-2', resumeId: 'r-1', name: 'V2' });
      const pair = await set.resumes.compare('u-1', 'v-1', 'v-2');
      expect(pair).not.toBeNull();
      expect(pair?.versionA.id).toBe('v-1');
      expect(await set.resumes.compare('u-1', 'v-1', 'v-missing')).toBeNull();
    });

    it('stores refresh tokens, revokes one, and revokes all for a user', async () => {
      const set = factory();
      await set.refreshTokens.create({
        id: 't-1',
        userId: 'u-1',
        tokenHash: 'hash-a',
        expiresAt: '2099-01-01T00:00:00.000Z',
      });
      await set.refreshTokens.create({
        id: 't-2',
        userId: 'u-1',
        tokenHash: 'hash-b',
        expiresAt: '2099-01-01T00:00:00.000Z',
      });
      const found = await set.refreshTokens.findByHash('hash-a');
      expect(found?.id).toBe('t-1');

      await set.refreshTokens.revoke('t-1', 't-2');
      expect((await set.refreshTokens.findByHash('hash-a'))?.revokedAt).not.toBeNull();

      await set.refreshTokens.revokeAllForUser('u-1');
      expect((await set.refreshTokens.findByHash('hash-b'))?.revokedAt).not.toBeNull();
    });

    it('records audit events', async () => {
      const set = factory();
      await set.audit.record({ actorUserId: 'u-1', action: 'auth.login', ipAddress: '127.0.0.1' });
      await set.audit.record({ actorUserId: null, action: 'auth.login-failed', details: 'bad' });
      if (set instanceof Object && 'store' in set) {
        const store = (set as { store?: MemoryStore }).store;
        expect(store?.auditEvents).toHaveLength(2);
      }
    });
  });
}

runContract('memory', memorySet);

if (oracleEnabled) {
  runContract('oracle', () => getRepositories());
}

async function seedUser(set: RepositorySet, id: string): Promise<void> {
  await set.users.create({
    id,
    name: `User ${id}`,
    email: `${id}@example.com`,
    passwordHash: 'not-used-in-contract',
    role: 'user',
  });
}
