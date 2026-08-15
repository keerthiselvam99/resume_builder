-- =====================================================================
-- ResumeIQ :: Migration 003 — resumes and immutable versions
-- Resumes, resume versions (content stored as JSON in a CLOB) and the
-- published-version immutability guard.
--
-- Run after: migrations/002_auth.sql
--   sqlplus app_user/password@FREEPDB1 @migrations/003_resume.sql
-- =====================================================================

-- Resumes ---------------------------------------------------------------
CREATE TABLE resumes (
    id         VARCHAR2(36)  PRIMARY KEY,
    user_id    VARCHAR2(36)  NOT NULL,
    name       VARCHAR2(200) NOT NULL,
    is_primary NUMBER(1)     DEFAULT 0 NOT NULL,
    created_at TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT ck_resumes_is_primary CHECK (is_primary IN (0, 1)),
    CONSTRAINT fk_resumes_user FOREIGN KEY (user_id) REFERENCES app_users (id) ON DELETE CASCADE
);

CREATE INDEX idx_resumes_user ON resumes (user_id);

-- At most one primary resume per user. Function-based unique index: the
-- expression is NULL (ignored) for non-primary rows, so only the single
-- primary row per user must be unique.
CREATE UNIQUE INDEX uq_resumes_one_primary
    ON resumes (CASE WHEN is_primary = 1 THEN user_id END);

-- Resume versions -------------------------------------------------------
CREATE TABLE resume_versions (
    id           VARCHAR2(36)   PRIMARY KEY,
    resume_id    VARCHAR2(36)   NOT NULL,
    name         VARCHAR2(200)  NOT NULL,
    is_master    NUMBER(1)      DEFAULT 0 NOT NULL,
    is_tailored  NUMBER(1)      DEFAULT 0 NOT NULL,
    template_id  VARCHAR2(120)  NOT NULL,
    published    NUMBER(1)      DEFAULT 0 NOT NULL,
    content_json CLOB           NOT NULL,
    created_at   TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at   TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT ck_resume_versions_flags CHECK (
        is_master IN (0, 1) AND is_tailored IN (0, 1) AND published IN (0, 1)
    ),
    CONSTRAINT ck_resume_versions_json CHECK (content_json IS JSON),
    CONSTRAINT fk_resume_versions_resume FOREIGN KEY (resume_id) REFERENCES resumes (id) ON DELETE CASCADE
);

CREATE INDEX idx_resume_versions_resume ON resume_versions (resume_id);

-- Updated-at maintenance --------------------------------------------------
CREATE OR REPLACE TRIGGER trg_resumes_updated_at
BEFORE UPDATE ON resumes
FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/

CREATE OR REPLACE TRIGGER trg_resume_versions_updated_at
BEFORE UPDATE ON resume_versions
FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/

-- Published-version immutability -----------------------------------------
-- A published version may not be unpublished, and its content or template
-- may not change. Applications map ORA-20001 to HTTP 409. Publishing itself
-- is allowed (published 0 -> 1). Renames and timestamps are allowed.
CREATE OR REPLACE TRIGGER trg_resume_versions_immutable
BEFORE UPDATE ON resume_versions
FOR EACH ROW
BEGIN
    IF :OLD.published = 1 AND :NEW.published = 0 THEN
        RAISE_APPLICATION_ERROR(-20001, 'Published versions cannot be unpublished.');
    END IF;
    IF :OLD.published = 1 AND (
        DBMS_LOB.COMPARE(:NEW.content_json, :OLD.content_json) <> 0
        OR :NEW.template_id != :OLD.template_id
    ) THEN
        RAISE_APPLICATION_ERROR(-20001, 'Published versions are immutable. Clone to edit.');
    END IF;
END;
/

-- Published versions cannot be deleted ------------------------------------
CREATE OR REPLACE TRIGGER trg_resume_versions_no_delete_published
BEFORE DELETE ON resume_versions
FOR EACH ROW
BEGIN
    IF :OLD.published = 1 THEN
        RAISE_APPLICATION_ERROR(-20001, 'Published versions cannot be deleted.');
    END IF;
END;
/

-- Schema version marker ----------------------------------------------------
UPDATE app_meta SET meta_value = '003' WHERE meta_key = 'schema_version';

COMMIT;
