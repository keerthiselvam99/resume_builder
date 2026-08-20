import oracledb from 'oracledb';
import { ConflictError, ForbiddenError, NotFoundError } from '../../http/errors';
import { UserRecord } from '../../types/domain';
import { AdminUserQuery, CreateUserInput, PageResult, UserRepository } from '../interfaces';
import { isDuplicateKey, TS_MASK, withConnection } from './common';

interface UserRow {
  ID: string;
  NAME: string;
  EMAIL: string;
  PASSWORD_HASH: string;
  ROLE_CODE: string;
  CREATED_AT: string;
  UPDATED_AT: string;
  STATUS_CODE: string;
  EMAIL_VERIFIED_AT?: string | null;
  AUTH_VERSION?: number;
}

interface AdminCountRow {
  TOTAL: number;
  ACTIVE: number | null;
  DISABLED: number | null;
  USERS: number | null;
  ADMINS: number | null;
}

export class OracleUserRepository implements UserRepository {
  async create(input: CreateUserInput): Promise<UserRecord> {
    const email = input.email.trim().toLowerCase();
    const createdAt = new Date().toISOString();
    return withConnection(async (conn) => {
      try {
        await conn.execute(
          `INSERT INTO app_users (id, name, email, password_hash, email_verified_at, created_at, updated_at)
           VALUES (:id, :name, :email, :passwordHash, :emailVerifiedAt,
                   TO_TIMESTAMP(:createdAt, '${TS_MASK}'), TO_TIMESTAMP(:createdAt, '${TS_MASK}'))`,
          {
            id: input.id,
            name: input.name.trim(),
            email,
            passwordHash: input.passwordHash,
            emailVerifiedAt: input.emailVerifiedAt ? new Date(input.emailVerifiedAt) : null,
            createdAt,
          },
          { autoCommit: false }
        );
        await conn.execute(
          `INSERT INTO user_roles (user_id, role_id)
           SELECT :userId, r.id FROM roles r WHERE r.code = :role`,
          { userId: input.id, role: input.role },
          { autoCommit: false }
        );
        await conn.commit();
      } catch (err) {
        await conn.rollback().catch(() => undefined);
        if (isDuplicateKey(err)) {
          throw new ConflictError('An account with this email already exists.');
        }
        throw err;
      }
      return {
        id: input.id,
        name: input.name.trim(),
        email,
        passwordHash: input.passwordHash,
        role: input.role,
        status: 'active',
        emailVerifiedAt: input.emailVerifiedAt,
        createdAt,
        updatedAt: createdAt,
      };
    });
  }

  async findByEmail(email: string): Promise<UserRecord | null> {
    return this.findBy('email', email);
  }

  async findById(id: string): Promise<UserRecord | null> {
    return this.findBy('id', id);
  }

  async list(): Promise<UserRecord[]> {
    return withConnection(async (conn) => {
      const result = await conn.execute<UserRow>(
        `SELECT u.id, u.name, u.email, u.password_hash,
                r.code AS role_code, u.status_code,
                TO_CHAR(u.created_at, '${TS_MASK}') AS created_at,
                TO_CHAR(u.updated_at, '${TS_MASK}') AS updated_at
         FROM app_users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id
         ORDER BY u.created_at ASC`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      return (result.rows ?? []).map(mapUserRow);
    });
  }

  async listPage(query: AdminUserQuery): Promise<PageResult<UserRecord>> {
    const columns = {
      name: 'u.name',
      email: 'u.email',
      createdAt: 'u.created_at',
      updatedAt: 'u.updated_at',
    } as const;
    const where = [
      `(:q IS NULL OR LOWER(u.name) LIKE :needle OR LOWER(u.email) LIKE :needle)`,
      `(:role IS NULL OR r.code = :role)`,
      `(:status IS NULL OR u.status_code = :status)`,
    ];
    const binds = {
      q: query.q ?? null,
      needle: query.q ? `%${query.q.trim().toLowerCase()}%` : null,
      role: query.role ?? null,
      status: query.status ?? null,
    };
    return withConnection(async (conn) => {
      const count = await conn.execute<{ TOTAL: number }>(
        `SELECT COUNT(*) total FROM app_users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE ${where.join(' AND ')}`,
        binds,
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const offset = (query.page - 1) * query.pageSize;
      const result = await conn.execute<UserRow>(
        `SELECT u.id,u.name,u.email,u.password_hash,r.code role_code,u.status_code,TO_CHAR(u.created_at,'${TS_MASK}') created_at,TO_CHAR(u.updated_at,'${TS_MASK}') updated_at FROM app_users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE ${where.join(' AND ')} ORDER BY ${columns[query.sort]} ${query.direction.toUpperCase()}, u.id ${query.direction.toUpperCase()} OFFSET :offset ROWS FETCH NEXT :pageSize ROWS ONLY`,
        { ...binds, offset, pageSize: query.pageSize },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      return {
        items: (result.rows ?? []).map(mapUserRow),
        total: Number(count.rows?.[0]?.TOTAL ?? 0),
        page: query.page,
        pageSize: query.pageSize,
      };
    });
  }
  async countActiveAdmins(): Promise<number> {
    return withConnection(async (conn) => {
      const result = await conn.execute<{ TOTAL: number }>(
        `SELECT COUNT(*) total
         FROM app_users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id
         WHERE r.code = 'admin' AND u.status_code = 'active'`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      return Number(result.rows?.[0]?.TOTAL ?? 0);
    });
  }

  async adminCounts() {
    return withConnection(async (conn) => {
      const result = await conn.execute<AdminCountRow>(
        `SELECT COUNT(*) total,
                SUM(CASE WHEN u.status_code = 'active' THEN 1 ELSE 0 END) active,
                SUM(CASE WHEN u.status_code = 'disabled' THEN 1 ELSE 0 END) disabled,
                SUM(CASE WHEN r.code = 'user' THEN 1 ELSE 0 END) users,
                SUM(CASE WHEN r.code = 'admin' THEN 1 ELSE 0 END) admins
         FROM app_users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const row = result.rows?.[0];
      return {
        total: Number(row?.TOTAL ?? 0),
        active: Number(row?.ACTIVE ?? 0),
        disabled: Number(row?.DISABLED ?? 0),
        users: Number(row?.USERS ?? 0),
        admins: Number(row?.ADMINS ?? 0),
      };
    });
  }
  async updateRoleAtomic(
    actorId: string,
    userId: string,
    role: UserRecord['role']
  ): Promise<UserRecord> {
    const user = await this.findById(userId);
    if (!user) throw new NotFoundError('User not found.');
    if (actorId === userId && role === 'user')
      throw new ForbiddenError('Administrators cannot demote themselves.');
    if (
      user.role === 'admin' &&
      role === 'user' &&
      user.status === 'active' &&
      (await this.countActiveAdmins()) <= 1
    )
      throw new ForbiddenError('The last active administrator cannot be demoted.');
    await withConnection(async (conn) => {
      await conn.execute(`SELECT id FROM roles WHERE code = 'admin' FOR UPDATE`);
      if (user.role === 'admin' && user.status === 'active' && role === 'user') {
        const count = await conn.execute<{ TOTAL: number }>(
          `SELECT COUNT(*) total FROM app_users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE r.code='admin' AND u.status_code='active'`,
          [],
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (Number(count.rows?.[0]?.TOTAL ?? 0) <= 1)
          throw new ForbiddenError('The last active administrator cannot be demoted.');
      }
      await conn.execute(
        `DELETE FROM user_roles WHERE user_id = :userId`,
        { userId },
        { autoCommit: false }
      );
      await conn.execute(
        `INSERT INTO user_roles (user_id, role_id) SELECT :userId, id FROM roles WHERE code = :role`,
        { userId, role },
        { autoCommit: true }
      );
    });
    return (await this.findById(userId))!;
  }
  async updateStatusAtomic(
    actorId: string,
    userId: string,
    status: UserRecord['status']
  ): Promise<UserRecord> {
    const user = await this.findById(userId);
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
    await withConnection(async (conn) => {
      await conn.execute(`SELECT id FROM roles WHERE code = 'admin' FOR UPDATE`);
      if (user.role === 'admin' && user.status === 'active' && status === 'disabled') {
        const count = await conn.execute<{ TOTAL: number }>(
          `SELECT COUNT(*) total FROM app_users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id WHERE r.code='admin' AND u.status_code='active'`,
          [],
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
        if (Number(count.rows?.[0]?.TOTAL ?? 0) <= 1)
          throw new ForbiddenError('The last active administrator cannot be disabled.');
      }
      await conn.execute(
        `UPDATE app_users SET status_code = :status WHERE id = :userId`,
        { status, userId },
        { autoCommit: true }
      );
    });
    return (await this.findById(userId))!;
  }

  async markEmailVerified(userId: string, verifiedAt: string): Promise<UserRecord> {
    await withConnection(async (conn) => {
      const result = await conn.execute(
        `UPDATE app_users SET email_verified_at=TO_TIMESTAMP(:verifiedAt,'${TS_MASK}'), updated_at=TO_TIMESTAMP(:verifiedAt,'${TS_MASK}') WHERE id=:userId`,
        { userId, verifiedAt }
      );
      if (!result.rowsAffected) throw new NotFoundError('User not found.');
    });
    return (await this.findById(userId))!;
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await withConnection(async (conn) => {
      const result = await conn.execute(
        `UPDATE app_users SET password_hash=:passwordHash, auth_version=auth_version+1, updated_at=SYSTIMESTAMP WHERE id=:userId`,
        { userId, passwordHash }
      );
      if (!result.rowsAffected) throw new NotFoundError('User not found.');
    });
  }

  private async findBy(column: 'id' | 'email', value: string): Promise<UserRecord | null> {
    return withConnection(async (conn) => {
      const where = column === 'email' ? 'u.email = :value' : 'u.id = :value';
      const result = await conn.execute<UserRow>(
        `SELECT u.id, u.name, u.email, u.password_hash,
                r.code AS role_code, u.status_code,
                TO_CHAR(u.email_verified_at, '${TS_MASK}') AS email_verified_at,
                u.auth_version,
                TO_CHAR(u.created_at, '${TS_MASK}') AS created_at,
                TO_CHAR(u.updated_at, '${TS_MASK}') AS updated_at
         FROM app_users u
         JOIN user_roles ur ON ur.user_id = u.id
         JOIN roles r ON r.id = ur.role_id
         WHERE ${where}`,
        { value: column === 'email' ? value.trim().toLowerCase() : value },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const row = result.rows?.[0];
      return row ? mapUserRow(row) : null;
    });
  }
}

function mapUserRow(row: UserRow): UserRecord {
  return {
    id: row.ID,
    name: row.NAME,
    email: row.EMAIL,
    passwordHash: row.PASSWORD_HASH,
    role: row.ROLE_CODE === 'admin' ? 'admin' : 'user',
    status: row.STATUS_CODE === 'disabled' ? 'disabled' : 'active',
    emailVerifiedAt: row.EMAIL_VERIFIED_AT,
    authVersion: Number(row.AUTH_VERSION ?? 0),
    createdAt: row.CREATED_AT,
    updatedAt: row.UPDATED_AT,
  };
}
