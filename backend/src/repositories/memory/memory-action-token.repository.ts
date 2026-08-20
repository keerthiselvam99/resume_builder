import { ActionTokenPurpose, ActionTokenRecord } from '../../types/domain';
import { ActionTokenRepository } from '../interfaces';
import { MemoryStore } from './memory-store';

export class MemoryActionTokenRepository implements ActionTokenRepository {
  private queue: Promise<void> = Promise.resolve();
  constructor(private readonly store: MemoryStore) {}

  async createReplacing(input: Omit<ActionTokenRecord, 'consumedAt' | 'revokedAt'>) {
    return this.exclusive(async () => {
      for (const token of this.store.actionTokens.values()) {
        if (
          token.userId === input.userId &&
          token.purpose === input.purpose &&
          !token.consumedAt &&
          !token.revokedAt
        )
          token.revokedAt = input.createdAt;
      }
      const record: ActionTokenRecord = { ...input, consumedAt: null, revokedAt: null };
      this.store.actionTokens.set(record.id, record);
      this.store.touch();
      return { ...record };
    });
  }

  async consume(tokenHash: string, purpose: ActionTokenPurpose, now: string) {
    return this.exclusive(async () => {
      const token = [...this.store.actionTokens.values()].find(
        (item) => item.tokenHash === tokenHash && item.purpose === purpose
      );
      if (!token || token.consumedAt || token.revokedAt || token.expiresAt <= now) return null;
      token.consumedAt = now;
      this.store.touch();
      return { ...token };
    });
  }

  async revokeAllForUser(userId: string, purpose?: ActionTokenPurpose) {
    const now = new Date().toISOString();
    for (const token of this.store.actionTokens.values()) {
      if (
        token.userId === userId &&
        (!purpose || token.purpose === purpose) &&
        !token.consumedAt &&
        !token.revokedAt
      )
        token.revokedAt = now;
    }
    this.store.touch();
  }

  async cleanupExpired(now: string) {
    let removed = 0;
    for (const [id, token] of this.store.actionTokens) {
      if (token.expiresAt <= now) {
        this.store.actionTokens.delete(id);
        removed++;
      }
    }
    if (removed) this.store.touch();
    return removed;
  }

  private async exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.queue;
    let release!: () => void;
    this.queue = new Promise<void>((resolve) => (release = resolve));
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }
}
