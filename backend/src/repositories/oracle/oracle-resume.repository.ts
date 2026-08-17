import { randomUUID } from 'node:crypto';
import oracledb from 'oracledb';
import { ConflictError, NotFoundError } from '../../http/errors';
import {
  DEFAULT_TEMPLATE_ID,
  emptyResumeContent,
  Resume,
  ResumeContent,
  ResumeStatus,
  ResumeVersion,
} from '../../types/domain';
import { CreateResumeInput, CreateVersionInput, ResumeRepository } from '../interfaces';
import { isDuplicateKey, isPublishedGuard, TS_MASK, withConnection } from './common';

interface ResumeRow {
  ID: string;
  USER_ID: string;
  NAME: string;
  IS_PRIMARY: number;
  STATUS: string;
  CREATED_AT: string;
  UPDATED_AT: string;
}

interface VersionRow {
  ID: string;
  RESUME_ID: string;
  NAME: string;
  PUBLISHED: number;
  IS_MASTER: number;
  IS_TAILORED: number;
  TEMPLATE_ID: string;
  CONTENT_JSON: string;
  CREATED_AT: string;
  UPDATED_AT: string;
}

interface AdminResumeCountRow {
  TOTAL: number;
  SAVED: number | null;
  DRAFTS: number | null;
}

const RESUME_COLUMNS = `id, user_id, name, is_primary, status,
       TO_CHAR(created_at, '${TS_MASK}') AS created_at,
       TO_CHAR(updated_at, '${TS_MASK}') AS updated_at`;

const VERSION_COLUMNS = `id, resume_id, name, published, is_master, is_tailored, template_id,
       content_json,
       TO_CHAR(created_at, '${TS_MASK}') AS created_at,
       TO_CHAR(updated_at, '${TS_MASK}') AS updated_at`;

export class OracleResumeRepository implements ResumeRepository {
  async adminCounts(): Promise<{ total: number; saved: number; drafts: number }> {
    return withConnection(async (conn) => {
      const result = await conn.execute<AdminResumeCountRow>(
        `SELECT COUNT(*) total, SUM(CASE WHEN status = 'saved' THEN 1 ELSE 0 END) saved, SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) drafts FROM resumes`,
        [],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const row = result.rows?.[0];
      return {
        total: Number(row?.TOTAL ?? 0),
        saved: Number(row?.SAVED ?? 0),
        drafts: Number(row?.DRAFTS ?? 0),
      };
    });
  }
  async listForUser(userId: string): Promise<Resume[]> {
    return withConnection(async (conn) => {
      const result = await conn.execute<ResumeRow>(
        `SELECT ${RESUME_COLUMNS} FROM resumes
         WHERE user_id = :userId
         ORDER BY created_at ASC`,
        { userId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      return (result.rows ?? []).map(mapResumeRow);
    });
  }

  async getForUser(userId: string, resumeId: string): Promise<Resume | null> {
    return withConnection(async (conn) => {
      const result = await conn.execute<ResumeRow>(
        `SELECT ${RESUME_COLUMNS} FROM resumes
         WHERE id = :resumeId AND user_id = :userId`,
        { resumeId, userId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const row = result.rows?.[0];
      return row ? mapResumeRow(row) : null;
    });
  }

  async create(input: CreateResumeInput): Promise<Resume> {
    const timestamp = new Date().toISOString();
    const primary = !(await this.userHasResumes(input.userId));
    return withConnection(async (conn) => {
      try {
        await conn.execute(
          `INSERT INTO resumes (id, user_id, name, is_primary, status, created_at, updated_at)
           VALUES (:id, :userId, :name, :isPrimary, 'draft',
                   TO_TIMESTAMP(:ts, '${TS_MASK}'), TO_TIMESTAMP(:ts, '${TS_MASK}'))`,
          {
            id: input.resumeId,
            userId: input.userId,
            name: input.name.trim(),
            isPrimary: primary ? 1 : 0,
            ts: timestamp,
          },
          { autoCommit: false }
        );
        await conn.execute(
          `INSERT INTO resume_versions
             (id, resume_id, name, is_master, is_tailored, template_id, published, content_json, created_at, updated_at)
           VALUES (:id, :resumeId, 'Master Resume', 1, 0, :templateId, 0, :content,
                   TO_TIMESTAMP(:ts, '${TS_MASK}'), TO_TIMESTAMP(:ts, '${TS_MASK}'))`,
          {
            id: input.versionId,
            resumeId: input.resumeId,
            templateId: input.templateId,
            content: { val: JSON.stringify(emptyResumeContent), type: oracledb.CLOB },
            ts: timestamp,
          },
          { autoCommit: false }
        );
        await conn.commit();
      } catch (err) {
        await conn.rollback().catch(() => undefined);
        if (isDuplicateKey(err)) {
          throw new ConflictError('Resume id already exists.');
        }
        throw err;
      }
      return {
        id: input.resumeId,
        userId: input.userId,
        name: input.name.trim(),
        primary,
        status: 'draft',
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    });
  }

  async rename(userId: string, resumeId: string, name: string): Promise<Resume> {
    const timestamp = new Date().toISOString();
    return withConnection(async (conn) => {
      const updated = await conn.execute(
        `UPDATE resumes SET name = :name, updated_at = TO_TIMESTAMP(:ts, '${TS_MASK}')
         WHERE id = :resumeId AND user_id = :userId`,
        { name: name.trim(), ts: timestamp, resumeId, userId }
      );
      if (updated.rowsAffected === 0) {
        throw new NotFoundError('Resume not found.');
      }
      const reloaded = await this.getForUser(userId, resumeId);
      if (!reloaded) {
        throw new NotFoundError('Resume not found.');
      }
      return reloaded;
    });
  }

  async duplicate(userId: string, resumeId: string): Promise<Resume> {
    const source = await this.getForUser(userId, resumeId);
    if (!source) {
      throw new NotFoundError('Resume not found.');
    }
    const master = await this.findMaster(resumeId);
    const timestamp = new Date().toISOString();
    const copyId = `r-${randomUUID()}`;
    return withConnection(async (conn) => {
      try {
        await conn.execute(
          `INSERT INTO resumes (id, user_id, name, is_primary, status, created_at, updated_at)
           VALUES (:id, :userId, :name, 0, 'draft',
                   TO_TIMESTAMP(:ts, '${TS_MASK}'), TO_TIMESTAMP(:ts, '${TS_MASK}'))`,
          { id: copyId, userId, name: `${source.name} (copy)`, ts: timestamp },
          { autoCommit: false }
        );
        if (master) {
          await conn.execute(
            `INSERT INTO resume_versions
               (id, resume_id, name, is_master, is_tailored, template_id, published, content_json, created_at, updated_at)
             VALUES (:id, :resumeId, :name, 1, 0, :templateId, 0, :content,
                     TO_TIMESTAMP(:ts, '${TS_MASK}'), TO_TIMESTAMP(:ts, '${TS_MASK}'))`,
            {
              id: `v-${randomUUID()}`,
              resumeId: copyId,
              name: master.name,
              templateId: master.templateId,
              content: { val: JSON.stringify(master.content), type: oracledb.CLOB },
              ts: timestamp,
            },
            { autoCommit: false }
          );
        }
        await conn.commit();
      } catch (err) {
        await conn.rollback().catch(() => undefined);
        throw err;
      }
      return {
        id: copyId,
        userId,
        name: `${source.name} (copy)`,
        primary: false,
        status: 'draft',
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    });
  }

  async delete(userId: string, resumeId: string): Promise<void> {
    return withConnection(async (conn) => {
      const result = await conn.execute(
        `DELETE FROM resumes WHERE id = :resumeId AND user_id = :userId`,
        { resumeId, userId }
      );
      if (result.rowsAffected === 0) {
        throw new NotFoundError('Resume not found.');
      }
    });
  }

  async setPrimary(userId: string, resumeId: string): Promise<Resume> {
    const timestamp = new Date().toISOString();
    return withConnection(async (conn) => {
      const target = await this.getForUser(userId, resumeId);
      if (!target) {
        throw new NotFoundError('Resume not found.');
      }
      await conn.execute(
        `UPDATE resumes
         SET is_primary = CASE WHEN id = :resumeId THEN 1 ELSE 0 END,
             updated_at = TO_TIMESTAMP(:ts, '${TS_MASK}')
         WHERE user_id = :userId`,
        { resumeId, userId, ts: timestamp }
      );
      return { ...target, primary: true, updatedAt: timestamp };
    });
  }

  async markSaved(userId: string, resumeId: string): Promise<Resume> {
    const timestamp = new Date().toISOString();
    return withConnection(async (conn) => {
      const target = await this.getForUser(userId, resumeId);
      if (!target) {
        throw new NotFoundError('Resume not found.');
      }
      if (target.status === 'saved') {
        return target;
      }
      const updated = await conn.execute(
        `UPDATE resumes
         SET status = 'saved', updated_at = TO_TIMESTAMP(:ts, '${TS_MASK}')
         WHERE id = :resumeId AND user_id = :userId`,
        { resumeId, userId, ts: timestamp }
      );
      if (updated.rowsAffected === 0) {
        throw new NotFoundError('Resume not found.');
      }
      return { ...target, status: 'saved' as ResumeStatus, updatedAt: timestamp };
    });
  }

  async listVersions(userId: string, resumeId: string): Promise<ResumeVersion[]> {
    return withConnection(async (conn) => {
      const result = await conn.execute<VersionRow>(
        `SELECT ${VERSION_COLUMNS} FROM resume_versions v
         JOIN resumes r ON r.id = v.resume_id
         WHERE v.resume_id = :resumeId AND r.user_id = :userId
         ORDER BY v.created_at ASC`,
        { resumeId, userId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      return (result.rows ?? []).map(mapVersionRow);
    });
  }

  async getVersionForUser(userId: string, versionId: string): Promise<ResumeVersion | null> {
    return withConnection(async (conn) => {
      const result = await conn.execute<VersionRow>(
        `SELECT ${VERSION_COLUMNS} FROM resume_versions v
         JOIN resumes r ON r.id = v.resume_id
         WHERE v.id = :versionId AND r.user_id = :userId`,
        { versionId, userId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const row = result.rows?.[0];
      return row ? mapVersionRow(row) : null;
    });
  }

  async createVersion(userId: string, input: CreateVersionInput): Promise<ResumeVersion> {
    const resume = await this.getForUser(userId, input.resumeId);
    if (!resume) {
      throw new NotFoundError('Resume not found.');
    }
    let source: ResumeVersion | null = null;
    let master: ResumeVersion | null = null;
    if (input.sourceVersionId) {
      source = await this.getVersionForUser(userId, input.sourceVersionId);
      if (!source || source.resumeId !== input.resumeId) {
        throw new NotFoundError('Source version not found.');
      }
    } else {
      master = await this.findMaster(input.resumeId);
    }
    const base = source ?? master;
    const versionId = input.versionId;
    const timestamp = new Date().toISOString();
    return withConnection(async (conn) => {
      await conn.execute(
        `INSERT INTO resume_versions
           (id, resume_id, name, is_master, is_tailored, template_id, published, content_json, created_at, updated_at)
         VALUES (:id, :resumeId, :name, 0, :isTailored, :templateId, 0, :content,
                 TO_TIMESTAMP(:ts, '${TS_MASK}'), TO_TIMESTAMP(:ts, '${TS_MASK}'))`,
        {
          id: versionId,
          resumeId: input.resumeId,
          name: input.name.trim(),
          isTailored: source ? 1 : 0,
          templateId: base?.templateId ?? DEFAULT_TEMPLATE_ID,
          content: {
            val: JSON.stringify(base?.content ?? emptyResumeContent),
            type: oracledb.CLOB,
          },
          ts: timestamp,
        }
      );
      return {
        id: versionId,
        resumeId: input.resumeId,
        name: input.name.trim(),
        published: false,
        isMaster: false,
        isTailored: Boolean(source),
        templateId: base?.templateId ?? DEFAULT_TEMPLATE_ID,
        createdAt: timestamp,
        updatedAt: timestamp,
        content: structuredClone(base?.content ?? emptyResumeContent),
      };
    });
  }

  async cloneVersion(userId: string, versionId: string, name: string): Promise<ResumeVersion> {
    const source = await this.getVersionForUser(userId, versionId);
    if (!source) {
      throw new NotFoundError('Version not found.');
    }
    const cloneId = `v-${randomUUID()}`;
    const timestamp = new Date().toISOString();
    return withConnection(async (conn) => {
      await conn.execute(
        `INSERT INTO resume_versions
           (id, resume_id, name, is_master, is_tailored, template_id, published, content_json, created_at, updated_at)
         VALUES (:id, :resumeId, :name, 0, :isTailored, :templateId, 0, :content,
                 TO_TIMESTAMP(:ts, '${TS_MASK}'), TO_TIMESTAMP(:ts, '${TS_MASK}'))`,
        {
          id: cloneId,
          resumeId: source.resumeId,
          name: name.trim(),
          isTailored: source.isTailored ? 1 : 0,
          templateId: source.templateId,
          content: { val: JSON.stringify(source.content), type: oracledb.CLOB },
          ts: timestamp,
        }
      );
      return {
        id: cloneId,
        resumeId: source.resumeId,
        name: name.trim(),
        published: false,
        isMaster: false,
        isTailored: source.isTailored,
        templateId: source.templateId,
        createdAt: timestamp,
        updatedAt: timestamp,
        content: structuredClone(source.content),
      };
    });
  }

  async publishVersion(userId: string, versionId: string): Promise<ResumeVersion> {
    const timestamp = new Date().toISOString();
    return withConnection(async (conn) => {
      const result = await conn.execute(
        `UPDATE resume_versions v
         SET published = 1, updated_at = TO_TIMESTAMP(:ts, '${TS_MASK}')
         WHERE v.id = :versionId
           AND EXISTS (SELECT 1 FROM resumes r WHERE r.id = v.resume_id AND r.user_id = :userId)`,
        { ts: timestamp, versionId, userId }
      );
      if (result.rowsAffected === 0) {
        throw new NotFoundError('Version not found.');
      }
      const reloaded = await this.getVersionForUser(userId, versionId);
      if (!reloaded) {
        throw new NotFoundError('Version not found.');
      }
      return reloaded;
    });
  }

  async updateContent(
    userId: string,
    versionId: string,
    content: ResumeContent
  ): Promise<ResumeVersion> {
    const timestamp = new Date().toISOString();
    return withConnection(async (conn) => {
      try {
        const result = await conn.execute(
          `UPDATE resume_versions v
           SET content_json = :content, updated_at = TO_TIMESTAMP(:ts, '${TS_MASK}')
           WHERE v.id = :versionId
             AND EXISTS (SELECT 1 FROM resumes r WHERE r.id = v.resume_id AND r.user_id = :userId)`,
          {
            content: { val: JSON.stringify(content), type: oracledb.CLOB },
            ts: timestamp,
            versionId,
            userId,
          }
        );
        if (result.rowsAffected === 0) {
          throw new NotFoundError('Version not found.');
        }
        const reloaded = await this.getVersionForUser(userId, versionId);
        if (!reloaded) {
          throw new NotFoundError('Version not found.');
        }
        return reloaded;
      } catch (err) {
        if (isPublishedGuard(err)) {
          throw new ConflictError(
            'This version is published and cannot be modified. Clone it to create an editable copy.'
          );
        }
        throw err;
      }
    });
  }

  async updateTemplate(
    userId: string,
    versionId: string,
    templateId: string
  ): Promise<ResumeVersion> {
    const timestamp = new Date().toISOString();
    return withConnection(async (conn) => {
      try {
        const result = await conn.execute(
          `UPDATE resume_versions v
           SET template_id = :templateId, updated_at = TO_TIMESTAMP(:ts, '${TS_MASK}')
           WHERE v.id = :versionId
             AND EXISTS (SELECT 1 FROM resumes r WHERE r.id = v.resume_id AND r.user_id = :userId)`,
          { templateId, ts: timestamp, versionId, userId }
        );
        if (result.rowsAffected === 0) {
          throw new NotFoundError('Version not found.');
        }
        const reloaded = await this.getVersionForUser(userId, versionId);
        if (!reloaded) {
          throw new NotFoundError('Version not found.');
        }
        return reloaded;
      } catch (err) {
        if (isPublishedGuard(err)) {
          throw new ConflictError(
            'This version is published and cannot be modified. Clone it to create an editable copy.'
          );
        }
        throw err;
      }
    });
  }

  async compare(
    userId: string,
    versionA: string,
    versionB: string
  ): Promise<{ versionA: ResumeVersion; versionB: ResumeVersion } | null> {
    const a = await this.getVersionForUser(userId, versionA);
    const b = await this.getVersionForUser(userId, versionB);
    if (!a || !b) {
      return null;
    }
    return { versionA: a, versionB: b };
  }

  private async userHasResumes(userId: string): Promise<boolean> {
    return withConnection(async (conn) => {
      const result = await conn.execute<{ C: number }>(
        `SELECT COUNT(*) AS c FROM resumes WHERE user_id = :userId`,
        { userId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      return Number(result.rows?.[0]?.C ?? 0) > 0;
    });
  }

  private async findMaster(resumeId: string): Promise<ResumeVersion | null> {
    return withConnection(async (conn) => {
      const result = await conn.execute<VersionRow>(
        `SELECT ${VERSION_COLUMNS} FROM resume_versions
         WHERE resume_id = :resumeId AND is_master = 1`,
        { resumeId },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const row = result.rows?.[0];
      return row ? mapVersionRow(row) : null;
    });
  }
}

function mapResumeRow(row: ResumeRow): Resume {
  return {
    id: row.ID,
    userId: row.USER_ID,
    name: row.NAME,
    primary: row.IS_PRIMARY === 1,
    status: normalizeStatus(row.STATUS),
    createdAt: row.CREATED_AT,
    updatedAt: row.UPDATED_AT,
  };
}

function normalizeStatus(value: string | null | undefined): ResumeStatus {
  return value === 'draft' ? 'draft' : 'saved';
}

function mapVersionRow(row: VersionRow): ResumeVersion {
  let content: ResumeContent;
  try {
    content = JSON.parse(row.CONTENT_JSON) as ResumeContent;
  } catch {
    content = structuredClone(emptyResumeContent);
  }
  return {
    id: row.ID,
    resumeId: row.RESUME_ID,
    name: row.NAME,
    published: row.PUBLISHED === 1,
    isMaster: row.IS_MASTER === 1,
    isTailored: row.IS_TAILORED === 1,
    templateId: row.TEMPLATE_ID,
    createdAt: row.CREATED_AT,
    updatedAt: row.UPDATED_AT,
    content,
  };
}
