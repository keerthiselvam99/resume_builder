-- ResumeIQ migration 005: Admin MVP account state and safe audit targeting.
-- Idempotent PL/SQL blocks permit safe re-application by the migration runner.
BEGIN
  EXECUTE IMMEDIATE q'[ALTER TABLE app_users ADD (status_code VARCHAR2(20) DEFAULT 'active' NOT NULL)]';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -1430 THEN RAISE; END IF;
END;
/
BEGIN EXECUTE IMMEDIATE q'[ALTER TABLE app_users ADD CONSTRAINT ck_app_users_status CHECK (status_code IN ('active','disabled'))]';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -2264 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE 'CREATE INDEX idx_app_users_admin_list ON app_users (status_code, email, created_at, id)';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE 'ALTER TABLE audit_logs ADD (target_user_id VARCHAR2(36))';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -1430 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE 'ALTER TABLE audit_logs ADD CONSTRAINT fk_audit_target FOREIGN KEY (target_user_id) REFERENCES app_users(id) ON DELETE SET NULL';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -2264 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE 'CREATE INDEX idx_audit_target_created ON audit_logs (target_user_id, created_at)';
EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
UPDATE app_meta SET meta_value='005' WHERE meta_key='schema_version';
COMMIT;
