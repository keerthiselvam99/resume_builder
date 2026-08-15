import { Observable, of, delay, throwError } from 'rxjs';

/** Old template IDs → new canonical IDs */
const TEMPLATE_ID_MIGRATION: Record<string, string> = {
  't-ats': 't-classic-ats-navy',
  't-modern': 't-premium-sidebar-navy',
  't-developer': 't-developer-console-navy',
};

/**
 * Development-only persistence backed by localStorage. NOT secure storage —
 * used only for the mock-first UI milestone. When the real API exists,
 * HTTP repository implementations replace these without component changes.
 */
export class MockStore {
  private static readonly PREFIX = 'resumeiq_';

  /** Current schema version. Bump when a new migration is introduced. */
  private static readonly MIGRATION_VERSION = 2;
  private static readonly MIGRATION_VERSION_KEY = 'migration_version';

  /**
   * Run once per session to migrate old template IDs in localStorage.
   * Versioned and idempotent: after a successful migration the version
   * marker is persisted, so repeated calls (and later page loads) are no-ops.
   */
  static migrate(): void {
    const applied = MockStore.read<number>(MockStore.MIGRATION_VERSION_KEY, 0);
    if (applied >= MockStore.MIGRATION_VERSION) {
      return;
    }

    try {
      // Migration 1: remap old template IDs on versions.
      if (applied < 1) {
        const rawVersions = localStorage.getItem(MockStore.PREFIX + 'versions');
        if (rawVersions) {
          const versions = JSON.parse(rawVersions) as { templateId?: string }[];
          let changed = false;
          for (const v of versions) {
            if (v.templateId && TEMPLATE_ID_MIGRATION[v.templateId]) {
              v.templateId = TEMPLATE_ID_MIGRATION[v.templateId];
              changed = true;
            }
          }
          if (changed) {
            localStorage.setItem(MockStore.PREFIX + 'versions', JSON.stringify(versions));
          }
        }
      }

      // Migration 2: resumes created before the draft/saved lifecycle have no
      // status. Treat them as saved so nothing disappears from My Resumes.
      if (applied < 2) {
        const rawResumes = localStorage.getItem(MockStore.PREFIX + 'resumes');
        if (rawResumes) {
          const resumes = JSON.parse(rawResumes) as { status?: string }[];
          if (resumes.some((r) => r.status !== 'draft' && r.status !== 'saved')) {
            for (const r of resumes) {
              if (r.status !== 'draft' && r.status !== 'saved') {
                r.status = 'saved';
              }
            }
            localStorage.setItem(MockStore.PREFIX + 'resumes', JSON.stringify(resumes));
          }
        }
      }

      MockStore.write(MockStore.MIGRATION_VERSION_KEY, MockStore.MIGRATION_VERSION);
    } catch {
      // Ignore migration errors — fall back to defaults
    }
  }

  static read<T>(key: string, fallback: T): T {
    const raw = localStorage.getItem(MockStore.PREFIX + key);
    if (raw === null) {
      return fallback;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  static write<T>(key: string, value: T): void {
    localStorage.setItem(MockStore.PREFIX + key, JSON.stringify(value));
  }

  static remove(key: string): void {
    localStorage.removeItem(MockStore.PREFIX + key);
  }

  static generateId(): string {
    return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

export function mockResponse<T>(data: T, delayMs = 300): Observable<T> {
  return of(data).pipe(delay(delayMs));
}

export function mockError(message: string, delayMs = 300): Observable<never> {
  return throwError(() => new Error(message)).pipe(delay(delayMs));
}

export interface MockBehavior {
  /** Simulate a backend outage for a specific operation key. */
  failNext: Record<string, string | undefined>;
}
