-- =====================================================================
-- ResumeIQ :: Migration 002 — authentication
-- Users, roles, refresh tokens and audit logs.
--
-- Run after: migrations/001_foundation.sql
--   sqlplus app_user/password@FREEPDB1 @migrations/002_auth.sql
-- =====================================================================

-- Roles ----------------------------------------------------------------
CREATE TABLE roles (
    id   VARCHAR2(36)  PRIMARY KEY,
    code VARCHAR2(20)  NOT NULL,
    name VARCHAR2(100) NOT NULL,
    CONSTRAINT uq_roles_code UNIQUE (code)
);

INSERT INTO roles (id, code, name) VALUES ('role-user',  'user',  'Standard user');
INSERT INTO roles (id, code, name) VALUES ('role-admin', 'admin', 'Administrator');

-- Application users ----------------------------------------------------
CREATE TABLE app_users (
    id            VARCHAR2(36)   PRIMARY KEY,
    name          VARCHAR2(200)  NOT NULL,
    email         VARCHAR2(320)  NOT NULL,
    password_hash VARCHAR2(512)  NOT NULL,
    created_at    TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
    updated_at    TIMESTAMP      DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT uq_app_users_email UNIQUE (email)
);

CREATE INDEX idx_app_users_email ON app_users (email);

-- User-to-role mapping -------------------------------------------------
CREATE TABLE user_roles (
    user_id VARCHAR2(36) NOT NULL,
    role_id VARCHAR2(36) NOT NULL,
    CONSTRAINT pk_user_roles PRIMARY KEY (user_id, role_id),
    CONSTRAINT fk_user_roles_user FOREIGN KEY (user_id) REFERENCES app_users (id) ON DELETE CASCADE,
    CONSTRAINT fk_user_roles_role FOREIGN KEY (role_id) REFERENCES roles (id)
);

-- Refresh tokens (stored hashed; revocable and rotatable) --------------
CREATE TABLE refresh_tokens (
    id             VARCHAR2(36) PRIMARY KEY,
    user_id        VARCHAR2(36) NOT NULL,
    token_hash     VARCHAR2(64) NOT NULL,
    expires_at     TIMESTAMP    NOT NULL,
    revoked_at     TIMESTAMP,
    replaced_by_id VARCHAR2(36),
    created_at     TIMESTAMP    DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT uq_refresh_tokens_hash UNIQUE (token_hash),
    CONSTRAINT fk_refresh_tokens_user FOREIGN KEY (user_id) REFERENCES app_users (id) ON DELETE CASCADE
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);

-- Audit log --------------------------------------------------------------
CREATE TABLE audit_logs (
    id            VARCHAR2(36)  PRIMARY KEY,
    actor_user_id VARCHAR2(36),
    action        VARCHAR2(100) NOT NULL,
    details       VARCHAR2(2000),
    ip_address    VARCHAR2(45),
    created_at    TIMESTAMP     DEFAULT SYSTIMESTAMP NOT NULL,
    CONSTRAINT fk_audit_actor FOREIGN KEY (actor_user_id) REFERENCES app_users (id) ON DELETE SET NULL
);

CREATE INDEX idx_audit_actor ON audit_logs (actor_user_id);
CREATE INDEX idx_audit_created ON audit_logs (created_at);

-- Updated-at maintenance ------------------------------------------------
CREATE OR REPLACE TRIGGER trg_app_users_updated_at
BEFORE UPDATE ON app_users
FOR EACH ROW
BEGIN
    :NEW.updated_at := SYSTIMESTAMP;
END;
/

-- Schema version marker --------------------------------------------------
UPDATE app_meta SET meta_value = '002' WHERE meta_key = 'schema_version';

COMMIT;
