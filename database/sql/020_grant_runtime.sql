-- =====================================================================
-- ResumeIQ :: Grant runtime DML privileges (direct, least-privilege)
-- Run as the schema owner (ORACLE_MIGRATE_USER) on every deployment AFTER
-- migrations (idempotent). The owner may GRANT on its own objects.
-- Args (sqlplus positional): &1 = schema owner / migration user,
--                            &2 = least-privileged runtime user.
--
-- The runtime user (RIQ_APP) holds only CREATE SESSION. The backend sets
-- CURRENT_SCHEMA to the owner schema on every pooled session, so unqualified
-- table/sequence names in the repository SQL resolve to the owner's objects,
-- while actual access is governed by the direct DML grants below. No
-- synonyms and no CREATE ANY SYNONYM are used.
--
-- Covered objects (auto-discovers the owner's current schema):
--   tables    SELECT, INSERT, UPDATE, DELETE   (all except housekeeping)
--   sequences SELECT                            (for future NEXTVAL use)
-- Housekeeping tables (schema_migrations, schema_migration_lock) are never
-- exposed to the runtime user.
-- =====================================================================

WHENEVER SQLERROR EXIT SQL.SQLCODE

BEGIN
  FOR t IN (
    SELECT table_name
      FROM all_tables
     WHERE owner = UPPER('&1')
       AND table_name NOT LIKE 'BIN$%'
       AND table_name NOT IN ('SCHEMA_MIGRATIONS', 'SCHEMA_MIGRATION_LOCK')
  ) LOOP
    EXECUTE IMMEDIATE 'GRANT SELECT, INSERT, UPDATE, DELETE ON "'
      || '&1' || '"."' || t.table_name || '" TO "' || '&2' || '"';
  END LOOP;

  FOR s IN (
    SELECT sequence_name
      FROM all_sequences
     WHERE sequence_owner = UPPER('&1')
  ) LOOP
    EXECUTE IMMEDIATE 'GRANT SELECT ON "'
      || '&1' || '"."' || s.sequence_name || '" TO "' || '&2' || '"';
  END LOOP;
END;
/