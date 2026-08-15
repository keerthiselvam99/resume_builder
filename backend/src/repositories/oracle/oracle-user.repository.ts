import oracledb from 'oracledb';
import { ConflictError } from '../../http/errors';
import { UserRecord } from '../../types/domain';
import { CreateUserInput, UserRepository } from '../interfaces';
import { isDuplicateKey, TS_MASK, withConnection } from './common';

interface UserRow {
  ID: string;
  NAME: string;
  EMAIL: string;
  PASSWORD_HASH: string;
  ROLE_CODE: string;
  CREATED_AT: string;
  UPDATED_AT: string;
}

export class OracleUserRepository implements UserRepository {
  async create(input: CreateUserInput): Promise<UserRecord> {
    const email = input.email.trim().toLowerCase();
    const createdAt = new Date().toISOString();
    return withConnection(async (conn) => {
      try {
        await conn.execute(
          `INSERT INTO app_users (id, name, email, password_hash, created_at, updated_at)
           VALUES (:id, :name, :email, :passwordHash,
                   TO_TIMESTAMP(:createdAt, '${TS_MASK}'), TO_TIMESTAMP(:createdAt, '${TS_MASK}'))`,
          {
            id: input.id,
            name: input.name.trim(),
            email,
            passwordHash: input.passwordHash,
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
                r.code AS role_code,
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

  private async findBy(column: 'id' | 'email', value: string): Promise<UserRecord | null> {
    return withConnection(async (conn) => {
      const where = column === 'email' ? 'u.email = :value' : 'u.id = :value';
      const result = await conn.execute<UserRow>(
        `SELECT u.id, u.name, u.email, u.password_hash,
                r.code AS role_code,
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
    createdAt: row.CREATED_AT,
    updatedAt: row.UPDATED_AT,
  };
}
