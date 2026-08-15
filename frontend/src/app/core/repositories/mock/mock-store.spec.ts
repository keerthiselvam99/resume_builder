import { describe, it, expect, beforeEach } from 'vitest';
import { MockStore } from './mock-store';

const VERSION_KEY = 'migration_version';
const VERSIONED_KEY = (key: string) => `resumeiq_${key}`;

interface VersionLike {
  id: string;
  templateId?: string;
}

function writeVersions(versions: VersionLike[]): void {
  localStorage.setItem(VERSIONED_KEY('versions'), JSON.stringify(versions));
}

function readVersions(): VersionLike[] {
  return JSON.parse(localStorage.getItem(VERSIONED_KEY('versions')) ?? '[]') as VersionLike[];
}

describe('MockStore.migrate', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('is safe on fresh storage and records the migration version', () => {
    MockStore.migrate();
    expect(localStorage.getItem(VERSIONED_KEY(VERSION_KEY))).toBe('2');
    expect(MockStore.read(VERSION_KEY, 0)).toBe(2);
  });

  it('migrates legacy t-ats, t-modern and t-developer IDs to canonical ids', () => {
    writeVersions([
      { id: 'v-1', templateId: 't-ats' },
      { id: 'v-2', templateId: 't-modern' },
      { id: 'v-3', templateId: 't-developer' },
      { id: 'v-4', templateId: 't-executive-banner-navy' },
    ]);

    MockStore.migrate();

    const versions = readVersions();
    expect(versions.find((v) => v.id === 'v-1')?.templateId).toBe('t-classic-ats-navy');
    expect(versions.find((v) => v.id === 'v-2')?.templateId).toBe('t-premium-sidebar-navy');
    expect(versions.find((v) => v.id === 'v-3')?.templateId).toBe('t-developer-console-navy');
    expect(versions.find((v) => v.id === 'v-4')?.templateId).toBe('t-executive-banner-navy');
    expect(localStorage.getItem(VERSIONED_KEY(VERSION_KEY))).toBe('2');
  });

  it('is idempotent across repeated calls', () => {
    writeVersions([
      { id: 'v-1', templateId: 't-ats' },
      { id: 'v-2', templateId: 't-modern' },
      { id: 'v-3', templateId: 't-developer' },
    ]);

    MockStore.migrate();
    MockStore.migrate();
    MockStore.migrate();

    const versions = readVersions();
    expect(versions).toHaveLength(3);
    expect(versions.map((v) => v.templateId)).toEqual([
      't-classic-ats-navy',
      't-premium-sidebar-navy',
      't-developer-console-navy',
    ]);
  });

  it('is a no-op on already-migrated data', () => {
    const migrated = [
      { id: 'v-1', templateId: 't-classic-ats-navy' },
      { id: 'v-2', templateId: 't-premium-sidebar-navy' },
    ];
    writeVersions(migrated);
    localStorage.setItem(VERSIONED_KEY(VERSION_KEY), '2');

    MockStore.migrate();

    expect(readVersions()).toEqual(migrated);
    expect(localStorage.getItem(VERSIONED_KEY(VERSION_KEY))).toBe('2');
  });

  it('normalizes resumes without a status to saved during migration 2', () => {
    const legacy = [
      { id: 'r-1', name: 'Old', primary: true },
      { id: 'r-2', name: 'Drafty', primary: false, status: 'draft' },
    ];
    localStorage.setItem(VERSIONED_KEY('resumes'), JSON.stringify(legacy));

    MockStore.migrate();

    const resumes = JSON.parse(localStorage.getItem(VERSIONED_KEY('resumes')) ?? '[]') as {
      id: string;
      status: string;
    }[];
    expect(resumes.find((r) => r.id === 'r-1')?.status).toBe('saved');
    expect(resumes.find((r) => r.id === 'r-2')?.status).toBe('draft');
    expect(localStorage.getItem(VERSIONED_KEY(VERSION_KEY))).toBe('2');
  });
});
