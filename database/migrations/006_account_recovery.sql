DECLARE n NUMBER; BEGIN SELECT COUNT(*) INTO n FROM user_tab_columns WHERE table_name='APP_USERS' AND column_name='EMAIL_VERIFIED_AT'; IF n=0 THEN EXECUTE IMMEDIATE 'ALTER TABLE app_users ADD (email_verified_at TIMESTAMP DEFAULT SYSTIMESTAMP)'; END IF; END;
/
DECLARE n NUMBER; BEGIN SELECT COUNT(*) INTO n FROM user_tab_columns WHERE table_name='APP_USERS' AND column_name='AUTH_VERSION'; IF n=0 THEN EXECUTE IMMEDIATE 'ALTER TABLE app_users ADD (auth_version NUMBER(10) DEFAULT 0 NOT NULL)'; END IF; END;
/
UPDATE app_users SET email_verified_at = created_at WHERE email_verified_at IS NULL;
COMMIT;
BEGIN EXECUTE IMMEDIATE 'CREATE TABLE user_action_tokens (id VARCHAR2(64) PRIMARY KEY, user_id VARCHAR2(64) NOT NULL REFERENCES app_users(id) ON DELETE CASCADE, purpose VARCHAR2(32) NOT NULL CHECK (purpose IN (''verify_email'',''reset_password'')), token_hash VARCHAR2(64) NOT NULL UNIQUE, created_at TIMESTAMP NOT NULL, expires_at TIMESTAMP NOT NULL, consumed_at TIMESTAMP NULL, revoked_at TIMESTAMP NULL)'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE 'CREATE INDEX ix_action_tokens_user_purpose ON user_action_tokens(user_id,purpose,revoked_at)'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
BEGIN EXECUTE IMMEDIATE 'CREATE INDEX ix_action_tokens_expiry ON user_action_tokens(expires_at)'; EXCEPTION WHEN OTHERS THEN IF SQLCODE != -955 THEN RAISE; END IF; END;
/
MERGE INTO schema_version d USING (SELECT 6 version_number, 'account recovery' description FROM dual) s ON (d.version_number=s.version_number) WHEN NOT MATCHED THEN INSERT(version_number,description) VALUES(s.version_number,s.description);
COMMIT;
