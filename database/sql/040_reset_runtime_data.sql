-- =====================================================================
-- ResumeIQ :: Reset runtime data (FK-safe, trigger-aware)
-- Run as the schema owner / migration user. Used between Oracle test runs
-- to give every suite a clean baseline.
--
-- Published versions cannot be deleted (RAISE_APPLICATION_ERROR -20001), so
-- the immutability trigger on RESUME_VERSIONS is disabled for the reset.
-- Deletion order follows the foreign keys (children before parents) so no
-- orphan rows or FK violations remain. Roles and the schema itself are kept.
-- Idempotent: safe to re-run.
-- =====================================================================

WHENEVER SQLERROR EXIT SQL.SQLCODE

ALTER TABLE resume_versions DISABLE ALL TRIGGERS;

DELETE FROM resume_versions;
DELETE FROM resumes;
DELETE FROM refresh_tokens;
DELETE FROM audit_logs;
DELETE FROM app_users; -- cascades user_roles

ALTER TABLE resume_versions ENABLE ALL TRIGGERS;

COMMIT;
