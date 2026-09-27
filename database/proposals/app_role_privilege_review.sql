-- READ-ONLY CATALOG REVIEW TEMPLATE. Not executed by Sprint 0.
-- No data rows or credential values are selected. Review output privately.
-- This inventory is not a substitute for allowed/denied SQL and HTTP tests.
\set ON_ERROR_STOP on
BEGIN READ ONLY;

SELECT current_database() AS database_name, current_user AS inspection_user,
       current_setting('server_version') AS server_version;
SELECT extname, extversion, n.nspname AS extension_schema
FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE extname IN ('postgis', 'pg_trgm');

SELECT rolname, rolcanlogin, rolsuper, rolcreatedb, rolcreaterole,
       rolreplication, rolbypassrls, rolinherit, rolconnlimit
FROM pg_roles WHERE rolname = 'humanaid_app';
SELECT parent.rolname AS granted_role, member.rolname AS member_role, m.admin_option
FROM pg_auth_members m
JOIN pg_roles parent ON parent.oid = m.roleid
JOIN pg_roles member ON member.oid = m.member
WHERE member.rolname = 'humanaid_app';

SELECT r.rolname,
       has_database_privilege(r.oid, current_database(), 'CONNECT') AS can_connect,
       has_database_privilege(r.oid, current_database(), 'CREATE') AS can_create,
       has_database_privilege(r.oid, current_database(), 'TEMPORARY') AS can_temp
FROM pg_roles r WHERE r.rolname = 'humanaid_app';
SELECT n.nspname, pg_get_userbyid(n.nspowner) AS owner,
       has_schema_privilege(r.oid, n.oid, 'USAGE') AS can_use,
       has_schema_privilege(r.oid, n.oid, 'CREATE') AS can_create
FROM pg_namespace n CROSS JOIN pg_roles r
WHERE r.rolname = 'humanaid_app'
  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND n.nspname NOT LIKE 'pg_toast%';

WITH expected(name) AS (VALUES ('resources'), ('categories'), ('resource_categories'),
  ('tags'), ('resource_tags'), ('pending_submissions'), ('users'),
  ('user_favorites'), ('resource_reports'), ('activity_log'))
SELECT name, to_regclass('public.' || name) AS actual_relation,
       CASE WHEN to_regclass('public.' || name) IS NOT NULL
         AND name IN ('resources', 'tags', 'pending_submissions', 'users', 'resource_reports', 'activity_log')
         THEN pg_get_serial_sequence('public.' || name, 'id')
         ELSE NULL END AS id_sequence
FROM expected;

SELECT n.nspname, c.relname, pg_get_userbyid(c.relowner) AS owner, c.relkind,
       has_table_privilege(r.oid, c.oid, 'SELECT') AS table_select,
       has_table_privilege(r.oid, c.oid, 'INSERT') AS table_insert,
       has_table_privilege(r.oid, c.oid, 'UPDATE') AS table_update,
       has_table_privilege(r.oid, c.oid, 'DELETE') AS can_delete,
       has_table_privilege(r.oid, c.oid, 'TRUNCATE') AS can_truncate,
       has_table_privilege(r.oid, c.oid, 'TRIGGER') AS can_trigger,
       has_table_privilege(r.oid, c.oid, 'REFERENCES') AS can_reference
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace CROSS JOIN pg_roles r
WHERE r.rolname = 'humanaid_app' AND n.nspname = 'public'
  AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
ORDER BY c.relname;

-- Column grants are distinct from table grants, including ON CONFLICT requirements.
SELECT c.relname, a.attname,
       has_column_privilege(r.oid, c.oid, a.attnum, 'SELECT') AS can_select,
       has_column_privilege(r.oid, c.oid, a.attnum, 'INSERT') AS can_insert,
       has_column_privilege(r.oid, c.oid, a.attnum, 'UPDATE') AS can_update,
       has_column_privilege(r.oid, c.oid, a.attnum, 'UPDATE WITH GRANT OPTION') AS can_grant_update
FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
JOIN pg_namespace n ON n.oid = c.relnamespace CROSS JOIN pg_roles r
WHERE r.rolname = 'humanaid_app' AND n.nspname = 'public'
  AND c.relkind IN ('r', 'p') AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY c.relname, a.attnum;

SELECT n.nspname, c.relname, pg_get_userbyid(c.relowner) AS owner,
       has_sequence_privilege(r.oid, c.oid, 'USAGE') AS can_nextval,
       has_sequence_privilege(r.oid, c.oid, 'SELECT') AS can_select,
       has_sequence_privilege(r.oid, c.oid, 'UPDATE') AS can_setval
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace CROSS JOIN pg_roles r
WHERE r.rolname = 'humanaid_app' AND c.relkind = 'S' AND n.nspname = 'public';

SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS arguments,
       pg_get_userbyid(p.proowner) AS owner, p.prosecdef,
       has_function_privilege(r.oid, p.oid, 'EXECUTE') AS can_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace CROSS JOIN pg_roles r
WHERE r.rolname = 'humanaid_app' AND p.prosecdef
  AND n.nspname NOT IN ('pg_catalog', 'information_schema');

-- Names/ownership only: do not print arbitrary function bodies or data defaults.
SELECT c.relname, t.tgname, p.proname AS trigger_function,
       p.prosecdef, pg_get_userbyid(p.proowner) AS function_owner
FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc p ON p.oid = t.tgfoid
WHERE n.nspname = 'public' AND NOT t.tgisinternal;
SELECT pg_get_userbyid(d.defaclrole) AS object_creator,
       n.nspname AS schema_name, d.defaclobjtype, d.defaclacl
FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace;

ROLLBACK;
