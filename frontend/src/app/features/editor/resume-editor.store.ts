import { computed, signal } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ResumeRepository } from '../../core/repositories/resume.repository';
import { Resume, ResumeContent, ResumeStatus, ResumeVersion } from '../../core/models/resume.model';

export type EditorSaveState = 'saved' | 'unsaved' | 'saving' | 'failed';

const DEFAULT_DEBOUNCE_MS = 700;

/**
 * Editor facade. Holds the working copy of a version's content and schedules
 * debounced autosaves through the ResumeRepository. Components never touch
 * localStorage directly — persistence is the repository's responsibility.
 */
export class ResumeEditorStore {
  private readonly resumeRepo: ResumeRepository;

  readonly version = signal<ResumeVersion | null>(null);
  readonly content = signal<ResumeContent | null>(null);
  readonly resume = signal<Resume | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly saveState = signal<EditorSaveState>('saved');

  /** Draft/saved lifecycle of the owning resume (defaults to saved). */
  readonly resumeStatus = computed<ResumeStatus>(() => this.resume()?.status ?? 'saved');

  private readonly debounceMs: number;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private saveInFlight = false;
  private pendingAfterInFlight = false;
  private lastSavedContent: ResumeContent | null = null;

  constructor(
    private readonly repo: ResumeRepository,
    debounceMs: number = DEFAULT_DEBOUNCE_MS,
  ) {
    this.resumeRepo = repo;
    this.debounceMs = debounceMs;
  }

  load(versionId: string): void {
    this.loading.set(true);
    this.errorMessage.set(null);
    this.resumeRepo.getVersion(versionId).subscribe({
      next: (version) => {
        if (!version) {
          this.errorMessage.set('Resume version not found.');
          this.loading.set(false);
          return;
        }
        this.version.set(version);
        const content = structuredClone(version.content);
        this.content.set(content);
        this.lastSavedContent = structuredClone(content);
        this.saveState.set('saved');
        this.resumeRepo.get(version.resumeId).subscribe({
          next: (resume) => {
            if (resume) {
              this.resume.set(resume);
            }
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        });
      },
      error: () => {
        this.errorMessage.set('Could not load this version. Please try again.');
        this.loading.set(false);
      },
    });
  }

  /**
   * Promotes the owning resume from draft to saved via the repository. The
   * caller owns the subscription; the store updates its resume snapshot when
   * the promotion succeeds. Content autosaves never do this.
   */
  saveResume(): Observable<Resume> {
    const resumeId = this.resume()?.id ?? this.version()?.resumeId;
    if (!resumeId) {
      return throwError(() => new Error('No resume is loaded.'));
    }
    return this.resumeRepo.markSaved(resumeId).pipe(tap((updated) => this.resume.set(updated)));
  }

  /** Apply a change produced by a form and schedule a debounced autosave. */
  patchContent(mutator: (content: ResumeContent) => ResumeContent): void {
    const current = this.content();
    if (!current) {
      return;
    }
    this.content.set(mutator(current));
    this.scheduleSave();
  }

  /** Immediately retry a failed save with the latest form content. */
  retry(): void {
    if (this.saveInFlight) {
      // Prevent duplicate concurrent retries: the in-flight save completion
      // will trigger exactly one follow-up save for the latest content.
      this.pendingAfterInFlight = true;
      return;
    }
    this.clearTimer();
    this.saveNow();
  }

  /**
   * Flush any pending debounced save immediately. Used before navigation so
   * edits that are waiting for the debounce are persisted first.
   */
  flush(): void {
    this.clearTimer();
    if (this.saveInFlight) {
      this.pendingAfterInFlight = true;
      return;
    }
    this.saveNow();
  }

  /**
   * Resolves once no save is pending or in flight, i.e. the store has reached
   * a terminal state ('saved' or 'failed'). Used by navigation protection.
   */
  waitForIdle(): Promise<void> {
    return new Promise((resolve) => {
      if (this.isIdle()) {
        resolve();
        return;
      }
      const interval = setInterval(() => {
        if (this.isIdle()) {
          clearInterval(interval);
          resolve();
        }
      }, 20);
    });
  }

  /** Clear any pending debounce timer. Call on destroy. */
  dispose(): void {
    this.clearTimer();
  }

  private clearTimer(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }

  private isIdle(): boolean {
    return !this.saveTimer && !this.saveInFlight && !this.pendingAfterInFlight;
  }

  private scheduleSave(): void {
    if (this.saveInFlight) {
      this.pendingAfterInFlight = true;
      return;
    }
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveState.set('unsaved');
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.saveNow();
    }, this.debounceMs);
  }

  private saveNow(): void {
    const version = this.version();
    const content = this.content();
    if (!version || !content) {
      return;
    }
    if (this.contentEquals(content, this.lastSavedContent)) {
      this.saveState.set('saved');
      return;
    }
    if (this.saveInFlight) {
      this.pendingAfterInFlight = true;
      return;
    }
    this.saveInFlight = true;
    this.saveState.set('saving');
    this.resumeRepo.updateContent(version.id, content).subscribe({
      next: (updated) => {
        this.saveInFlight = false;
        this.lastSavedContent = structuredClone(updated.content);
        this.version.set(updated);
        if (this.pendingAfterInFlight) {
          this.pendingAfterInFlight = false;
          this.saveNow();
        } else {
          this.saveState.set('saved');
        }
      },
      error: () => {
        this.saveInFlight = false;
        if (this.pendingAfterInFlight) {
          this.pendingAfterInFlight = false;
          this.saveNow();
        } else {
          this.saveState.set('failed');
        }
      },
    });
  }

  private contentEquals(a: ResumeContent, b: ResumeContent | null): boolean {
    return b !== null && JSON.stringify(a) === JSON.stringify(b);
  }
}
