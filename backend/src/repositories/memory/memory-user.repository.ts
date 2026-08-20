import { ConflictError, ForbiddenError, NotFoundError } from '../../http/errors';
import { UserRecord } from '../../types/domain';
import { AdminUserQuery, CreateUserInput, PageResult, UserRepository } from '../interfaces';
import { MemoryStore } from './memory-store';

export class MemoryUserRepository implements UserRepository {
  private mutationQueue: Promise<void> = Promise.resolve();
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
      status: 'active',
      emailVerifiedAt: input.emailVerifiedAt,
      authVersion: 0,
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

  async listPage(query: AdminUserQuery): Promise<PageResult<UserRecord>> {
    const needle = query.q?.trim().toLowerCase();
    const items = Array.from(this.store.users.values()).filter(
      (user) =>
        (!needle || user.name.toLowerCase().includes(needle) || user.email.includes(needle)) &&
        (!query.role || user.role === query.role) &&
        (!query.status || user.status === query.status)
    );
    items.sort((a, b) => {
      const av = a[query.sort].toLowerCase();
      const bv = b[query.sort].toLowerCase();
      const result = av.localeCompare(bv) || a.id.localeCompare(b.id);
      return query.direction === 'asc' ? result : -result;
    });
    const start = (query.page - 1) * query.pageSize;
    return {
      items: items.slice(start, start + query.pageSize),
      total: items.length,
      page: query.page,
      pageSize: query.pageSize,
    };
  }

  async countActiveAdmins(): Promise<number> {
    return Array.from(this.store.users.values()).filter(
      (u) => u.role === 'admin' && u.status === 'active'
    ).length;
  }

  async adminCounts() {
    const records = Array.from(this.store.users.values());
    return {
      total: records.length,
      active: records.filter((user) => user.status === 'active').length,
      disabled: records.filter((user) => user.status === 'disabled').length,
      users: records.filter((user) => user.role === 'user').length,
      admins: records.filter((user) => user.role === 'admin').length,
    };
  }

  async markEmailVerified(userId: string, verifiedAt: string): Promise<UserRecord> {
    const user = this.store.users.get(userId);
    if (!user) throw new NotFoundError('User not found.');
    user.emailVerifiedAt = verifiedAt;
    user.updatedAt = verifiedAt;
    this.store.touch();
    return { ...user };
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    const user = this.store.users.get(userId);
    if (!user) throw new NotFoundError('User not found.');
    user.passwordHash = passwordHash;
    user.authVersion = (user.authVersion ?? 0) + 1;
    user.updatedAt = new Date().toISOString();
    this.store.touch();
  }

  async updateRoleAtomic(
    actorId: string,
    userId: string,
    role: UserRecord['role']
  ): Promise<UserRecord> {
    return this.exclusive(async () => {
      const user = this.store.users.get(userId);
      if (!user) throw new NotFoundError('User not found.');
      if (actorId === userId && role !== 'admin')
        throw new ForbiddenError('Administrators cannot demote themselves.');
      if (
        user.role === 'admin' &&
        role === 'user' &&
        user.status === 'active' &&
        (await this.countActiveAdmins()) <= 1
      )
        throw new ForbiddenError('The last active administrator cannot be demoted.');
      user.role = role;
      user.updatedAt = new Date().toISOString();
      this.store.touch();
      return { ...user };
    });
  }

  async updateStatusAtomic(
    actorId: string,
    userId: string,
    status: UserRecord['status']
  ): Promise<UserRecord> {
    return this.exclusive(async () => {
      const user = this.store.users.get(userId);
      if (!user) throw new NotFoundError('User not found.');
      if (actorId === userId && status === 'disabled')
        throw new ForbiddenError('Administrators cannot disable themselves.');
      if (
        user.role === 'admin' &&
        user.status === 'active' &&
        status === 'disabled' &&
        (await this.countActiveAdmins()) <= 1
      )
        throw new ForbiddenError('The last active administrator cannot be disabled.');
      user.status = status;
      user.updatedAt = new Date().toISOString();
      this.store.touch();
      return { ...user };
    });
  }

  private async exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.mutationQueue;
    let release!: () => void;
    this.mutationQueue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
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
