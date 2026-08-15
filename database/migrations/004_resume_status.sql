-- =====================================================================
-- ResumeIQ :: Migration 004 — resume draft/saved lifecycle
-- New resumes are created as drafts. The explicit "Save resume" action in
-- the editor promotes a draft to saved. Existing resumes (created before
-- this lifecycle existed) default to 'saved' so nothing gets hidden from
-- the My Resumes list.
--
-- Run after: migrations/003_resume.sql
--   sqlplus app_user/password@FREEPDB1 @migrations/004_resume_status.sql
-- =====================================================================

ALTER TABLE resumes ADD status VARCHAR2(8) DEFAULT 'saved' NOT NULL;

ALTER TABLE resumes ADD CONSTRAINT ck_resumes_status CHECK (status IN ('draft', 'saved'));

CREATE INDEX idx_resumes_user_status ON resumes (user_id, status);

-- Schema version marker ----------------------------------------------------
UPDATE app_meta SET meta_value = '004' WHERE meta_key = 'schema_version';

COMMIT;
