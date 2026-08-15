-- =====================================================================
-- ResumeIQ :: Seed data 001
-- Loaded after migrations. Foundation milestone only seeds the schema
-- version marker; feature seeds (roles, templates, skill dictionary)
-- arrive with their respective migrations.
-- =====================================================================

UPDATE app_meta
SET meta_value = 'seeded'
WHERE meta_key = 'schema_version';

COMMIT;
