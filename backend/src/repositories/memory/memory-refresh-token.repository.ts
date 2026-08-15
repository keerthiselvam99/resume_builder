import { RefreshTokenRecord } from '../../types/domain';
import { CreateRefreshTokenInput, RefreshTokenRepository } from '../interfaces';
import { MemoryStore } from './memory-store';

export class MemoryRefreshTokenRepository implements RefreshTokenRepository {
  constructor(private readonly store: MemoryStore) {}

  async create(input: CreateRefreshTokenInput): Promise<void> {
    const record: RefreshTokenRecord = {
      id: input.id,
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null,
      replacedById: null,
      createdAt: new Date().toISOString(),
    };
    this.store.refreshTokens.set(record.id, record);
    this.store.touch();
  }

  async findByHash(hash: string): Promise<RefreshTokenRecord | null> {
    for (const record of this.store.refreshTokens.values()) {
      if (record.tokenHash === hash) {
        return record;
      }
    }
    return null;
  }

  async revoke(id: string, replacedById?: string): Promise<void> {
    const record = this.store.refreshTokens.get(id);
    if (!record) {
      return;
    }
    record.revokedAt = new Date().toISOString();
    record.replacedById = replacedById ?? null;
    this.store.touch();
  }

  async revokeAllForUser(userId: string): Promise<void> {
    let changed = false;
    for (const record of this.store.refreshTokens.values()) {
      if (record.userId === userId && record.revokedAt === null) {
        record.revokedAt = new Date().toISOString();
        changed = true;
      }
    }
    if (changed) {
      this.store.touch();
    }
  }
}
