import { ConflictError } from '../../http/errors';
import { UserRecord } from '../../types/domain';
import { CreateUserInput, UserRepository } from '../interfaces';
import { MemoryStore } from './memory-store';

export class MemoryUserRepository implements UserRepository {
  constructor(private readonly store: MemoryStore) {}

  async create(input: CreateUserInput): Promise<UserRecord> {
    const normalizedEmail = input.email.trim().toLowerCase();
    if (this.findByEmailSync(normalizedEmail)) {
      throw new ConflictError('An account with this email already exists.');
    }
    const record: UserRecord = {
      id: input.id,
      name: input.name.trim(),
      email: normalizedEmail,
      passwordHash: input.passwordHash,
      role: input.role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.store.users.set(record.id, record);
    this.store.touch();
    return record;
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.findByEmailSync(email) ?? null;
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.store.users.get(id) ?? null;
  }

  async list(): Promise<UserRecord[]> {
    return Array.from(this.store.users.values());
  }

  private findByEmailSync(email: string): UserRecord | undefined {
    const normalized = email.trim().toLowerCase();
    for (const record of this.store.users.values()) {
      if (record.email === normalized) {
        return record;
      }
    }
    return undefined;
  }
}
