-- =====================================================================
-- ResumeIQ :: Foundation migration 001
-- Schema base required by the health check and the first vertical flow
-- (create resume -> save in Oracle -> retrieve -> preview).
--
-- Run order:
--   1. migrations/001_foundation.sql   (this file)
--   2. seed-data/001_roles.sql
--
-- Run with SQLcl or SQL*Plus as the application schema owner:
--   sqlplus app_user/password@FREEPDB1 @migrations/001_foundation.sql
-- =====================================================================

-- Reserved for future migrations. The foundation milestone only creates
-- the minimum objects the application needs to prove Oracle connectivity:
-- a placeholder sequence and table used by the health/readiness flow.

CREATE SEQUENCE resumeiq_foundation_seq START WITH 1 INCREMENT BY 1;

CREATE TABLE app_meta (
    meta_key   VARCHAR2(100) PRIMARY KEY,
    meta_value VARCHAR2(4000),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP
);

INSERT INTO app_meta (meta_key, meta_value)
VALUES ('schema_version', '001');

COMMIT;
