import { vi } from 'vitest';
import { of, throwError, delay, lastValueFrom } from 'rxjs';
import { ResumeRepository } from '../../core/repositories/resume.repository';
import { Resume, ResumeVersion, ResumeContent } from '../../core/models/resume.model';
import { ResumeEditorStore } from './resume-editor.store';

const version: ResumeVersion = {
  id: 'v-master',
  resumeId: 'r-master',
  name: 'Master Resume',
  published: true,
  isMaster: true,
  isTailored: false,
  templateId: 't-classic-ats-navy',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  content: {
    contacts: {
      fullName: 'Arun Kumar',
      email: 'arun@example.com',
      phone: '+91 98765 43210',
      location: 'Bengaluru, India',
      linkedinUrl: '',
      githubUrl: '',
      portfolioUrl: '',
    },
    summary: 'Full-stack developer.',
    skills: ['Angular', 'TypeScript'],
    experiences: [],
    projects: [],
    education: [],
    certifications: [],
    achievements: [],
    awards: [],
    languages: [],
    customSections: [],
  },
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Polls until `predicate` becomes true instead of sleeping a fixed amount of
// time. Fixed sleeps are the flake source: the simulated repository latency is
// 300ms and a loaded/parallel run can delay timers past the original margin.
async function until(predicate: () => boolean, timeout = 3000, interval = 25): Promise<void> {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}

function repoMock(): { repo: ResumeRepository; updates: ResumeContent[] } {
  const updates: ResumeContent[] = [];
  const resume: Resume = {
    id: 'r-master',
    userId: 'u-demo',
    name: 'Master Resume',
    primary: true,
    status: 'saved',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };
  const repo: ResumeRepository = {
    list: () => of([resume]),
    get: () => of(resume),
    create: () => of(resume),
    rename: () => of(resume),
    duplicate: () => of(resume),
    delete: () => of(undefined),
    setPrimary: () => of(resume),
    markSaved: () => of(resume),
    listVersions: () => of([version]),
    getVersion: () => of(version).pipe(delay(300)),
    createVersion: () => of(version),
    cloneVersion: () => of(version),
    publishVersion: () => of(version),
    updateTemplate: () => of(version),
    updateContent: (_id: string, content: ResumeContent) => {
      updates.push(structuredClone(content));
      return of({ ...version, content, updatedAt: new Date().toISOString() }).pipe(delay(300));
    },
    compare: () => of({ versionA: version, versionB: version }),
  };
  return { repo, updates };
}

describe('ResumeEditorStore', () => {
  it('loads a version and exposes its content with saveState saved', async () => {
    const { repo } = repoMock();
    const store = new ResumeEditorStore(repo);
    store.load('v-master');
    expect(store.loading()).toBe(true);
    await until(() => !store.loading());
    expect(store.loading()).toBe(false);
    expect(store.version()?.id).toBe('v-master');
    expect(store.content()?.contacts.fullName).toBe('Arun Kumar');
    expect(store.saveState()).toBe('saved');
  });

  it('reports an error when the version is not found', async () => {
    const repo: ResumeRepository = repoMock().repo;
    vi.spyOn(repo, 'getVersion').mockReturnValue(of(null));
    const store = new ResumeEditorStore(repo);
    store.load('missing');
    await until(() => !store.loading());
    expect(store.errorMessage()).toBe('Resume version not found.');
  });

  it('does not autosave immediately after load', async () => {
    const { repo, updates } = repoMock();
    const store = new ResumeEditorStore(repo, 40);
    store.load('v-master');
    await until(() => !store.loading());
    await wait(100);
    expect(updates).toHaveLength(0);
    expect(store.saveState()).toBe('saved');
  });

  it('autosaves after the debounce and reports saving then saved', async () => {
    const { repo, updates } = repoMock();
    const store = new ResumeEditorStore(repo, 40);
    store.load('v-master');
    await until(() => !store.loading());

    store.patchContent((c) => ({ ...c, summary: 'Edited summary.' }));
    expect(store.saveState()).toBe('unsaved');
    await until(() => store.saveState() === 'saving');
    await until(() => store.saveState() === 'saved');
    expect(updates).toHaveLength(1);
    expect(updates[0].summary).toBe('Edited summary.');
  });

  it('does not save when patched content is identical to last saved', async () => {
    const { repo, updates } = repoMock();
    const store = new ResumeEditorStore(repo, 40);
    store.load('v-master');
    await until(() => !store.loading());

    store.patchContent((c) => ({ ...c }));
    await wait(100);
    await until(() => store.saveState() === 'saved');
    expect(updates).toHaveLength(0);
    expect(store.saveState()).toBe('saved');
  });

  it('queues the latest change when a save is already in flight', async () => {
    const { repo, updates } = repoMock();
    const store = new ResumeEditorStore(repo, 40);
    store.load('v-master');
    await until(() => !store.loading());

    store.patchContent((c) => ({ ...c, summary: 'First edit.' }));
    await until(() => store.saveState() === 'saving'); // save in flight
    store.patchContent((c) => ({ ...c, summary: 'Latest edit.' }));
    await until(() => store.saveState() === 'saved');
    expect(updates.length).toBeGreaterThanOrEqual(2);
    expect(updates[updates.length - 1].summary).toBe('Latest edit.');
  });

  it('marks failed on error and retry re-saves', async () => {
    const { repo } = repoMock();
    let fail = true;
    vi.spyOn(repo, 'updateContent').mockImplementation((_id: string, content: ResumeContent) => {
      if (fail) {
        fail = false;
        return throwError(() => new Error('boom'));
      }
      return of({ ...version, content });
    });

    const store = new ResumeEditorStore(repo, 40);
    store.load('v-master');
    await until(() => !store.loading());

    store.patchContent((c) => ({ ...c, summary: 'Will fail.' }));
    await until(() => store.saveState() === 'failed');

    store.retry();
    await until(() => store.saveState() === 'saved');
  });

  it('dispose clears a pending debounce', async () => {
    const { repo, updates } = repoMock();
    const store = new ResumeEditorStore(repo, 40);
    store.load('v-master');
    await until(() => !store.loading());

    store.patchContent((c) => ({ ...c, summary: 'Never saved.' }));
    store.dispose();
    await wait(200);
    expect(updates).toHaveLength(0);
  });

  it('retry persists the latest edited content after a failure', async () => {
    const { repo } = repoMock();
    let fail = true;
    vi.spyOn(repo, 'updateContent').mockImplementation((_id: string, content: ResumeContent) => {
      if (fail) {
        fail = false;
        return throwError(() => new Error('boom'));
      }
      return of({ ...version, content });
    });

    const store = new ResumeEditorStore(repo, 40);
    store.load('v-master');
    await until(() => !store.loading());

    store.patchContent((c) => ({ ...c, summary: 'First edit.' }));
    await until(() => store.saveState() === 'failed');

    // User keeps editing after the failure.
    store.patchContent((c) => ({ ...c, summary: 'Latest edit after failure.' }));
    store.retry();
    await until(() => store.saveState() === 'saved');

    const saved = store.content();
    expect(saved?.summary).toBe('Latest edit after failure.');
  });

  it('does not start a concurrent save when retry fires while a save is in flight', async () => {
    const { repo } = repoMock();
    let calls = 0;
    vi.spyOn(repo, 'updateContent').mockImplementation(() => {
      calls += 1;
      return of({ ...version }).pipe(delay(300));
    });

    const store = new ResumeEditorStore(repo, 40);
    store.load('v-master');
    await until(() => !store.loading());

    store.patchContent((c) => ({ ...c, summary: 'Edit.' }));
    await until(() => store.saveState() === 'saving'); // save in flight
    store.retry(); // during flight: should queue a follow-up, not a duplicate concurrent save
    await until(() => store.saveState() === 'saved');
    // exactly one original save + one follow-up for the latest content — no runaway
    expect(calls).toBe(2);
  });

  it('flush forces pending edits to persist and waitForIdle resolves after save', async () => {
    const { repo, updates } = repoMock();
    const store = new ResumeEditorStore(repo, 5000);
    store.load('v-master');
    await until(() => !store.loading());

    store.patchContent((c) => ({ ...c, summary: 'Flushed now.' }));
    expect(updates).toHaveLength(0);

    let idle = false;
    void store.waitForIdle().then(() => {
      idle = true;
    });
    store.flush();
    await until(() => store.saveState() === 'saving');
    expect(idle).toBe(false);

    await until(() => store.saveState() === 'saved');
    expect(updates[0].summary).toBe('Flushed now.');
  });

  it('exposes the resume status after load', async () => {
    const { repo } = repoMock();
    const store = new ResumeEditorStore(repo);
    store.load('v-master');
    await until(() => !store.loading());
    expect(store.resumeStatus()).toBe('saved');
  });

  it('saveResume persists a draft and updates the resume status', async () => {
    const { repo } = repoMock();
    const draft: Resume = {
      id: 'r-master',
      userId: 'u-demo',
      name: 'Master Resume',
      primary: false,
      status: 'draft',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    };
    vi.spyOn(repo, 'get').mockReturnValue(of(draft));
    vi.spyOn(repo, 'markSaved').mockReturnValue(of({ ...draft, status: 'saved' }));

    const store = new ResumeEditorStore(repo);
    store.load('v-master');
    await until(() => !store.loading());
    expect(store.resumeStatus()).toBe('draft');

    await lastValueFrom(store.saveResume());
    expect(store.resumeStatus()).toBe('saved');
    expect(store.resume()?.status).toBe('saved');
  });

  it('waitForIdle resolves immediately when nothing is pending', async () => {
    const { repo } = repoMock();
    const store = new ResumeEditorStore(repo, 40);
    store.load('v-master');
    await until(() => !store.loading());

    let resolved = false;
    void store.waitForIdle().then(() => {
      resolved = true;
    });
    await until(() => resolved);
    expect(resolved).toBe(true);
  });
});
