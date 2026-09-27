-- PROPOSAL ONLY. Not executed. Not a production migration.
-- Read docs/DATABASE_APP_ROLE_RUNBOOK.md, especially the administrator-route gate.
-- Requires psql, a reviewed staging database, and an administrative operator.
-- In a reviewed COPY only: remove the guard, set expected_database explicitly,
-- reconcile schema/PUBLIC grants, and review ROLLBACK before persisting anything.
-- No password, LOGIN, infrastructure change, extension creation, or schema DDL.
\set ON_ERROR_STOP on
BEGIN;

DO $guard$
BEGIN
  RAISE EXCEPTION 'TEMPLATE ONLY: review staging schema and admin separation; do not run unchanged';
END
$guard$;

SELECT current_database() = :'expected_database' AS database_matches \gset
\if :database_matches
\else
DO $guard$ BEGIN RAISE EXCEPTION 'Unexpected database'; END $guard$;
\endif

-- Deliberately fails if the role already exists: do not inherit unknown grants.
CREATE ROLE humanaid_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE
  NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 25;
ALTER ROLE humanaid_app IN DATABASE :"expected_database"
  SET search_path = pg_catalog, public;

-- Denying direct grants does not cancel PUBLIC grants. Stop for operator review.
-- No blanket PUBLIC revocation is performed by this template.
DO $preflight$
BEGIN
  IF has_database_privilege('humanaid_app', current_database(), 'CREATE')
     OR has_database_privilege('humanaid_app', current_database(), 'TEMPORARY') THEN
    RAISE EXCEPTION 'PUBLIC grants database CREATE/TEMP; review and regrant other roles explicitly';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_namespace n
    WHERE has_schema_privilege('humanaid_app', n.oid, 'CREATE')
  ) THEN
    RAISE EXCEPTION 'Inherited schema CREATE privilege must be resolved';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND (
        has_table_privilege('humanaid_app', c.oid, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
        OR has_any_column_privilege('humanaid_app', c.oid, 'INSERT,UPDATE,REFERENCES')
        OR ((n.nspname, c.relname) <> ('public', 'spatial_ref_sys') AND (
          has_table_privilege('humanaid_app', c.oid, 'SELECT')
          OR has_any_column_privilege('humanaid_app', c.oid, 'SELECT')
        ))
      )
  ) THEN
    RAISE EXCEPTION 'Inherited data privileges exist; review PUBLIC ACLs before explicit grants';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relkind = 'S' AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND has_sequence_privilege('humanaid_app', c.oid, 'USAGE,SELECT,UPDATE')
  ) THEN
    RAISE EXCEPTION 'Inherited sequence privileges exist; review PUBLIC ACLs first';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prosecdef AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND has_function_privilege('humanaid_app', p.oid, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'Executable SECURITY DEFINER routine needs explicit review';
  END IF;
END
$preflight$;

GRANT CONNECT ON DATABASE :"expected_database" TO humanaid_app;
GRANT USAGE ON SCHEMA public TO humanaid_app;

-- Tables selected with r.*, c.*, ps.*, or rr.* by current runtime queries.
GRANT SELECT ON public.resources, public.categories,
  public.pending_submissions, public.resource_reports, public.user_favorites
  TO humanaid_app;
GRANT SELECT (resource_id, category_id) ON public.resource_categories TO humanaid_app;
GRANT SELECT (id, name, slug) ON public.tags TO humanaid_app;
GRANT SELECT (resource_id, tag_id) ON public.resource_tags TO humanaid_app;
GRANT SELECT (id, firebase_uid, email, display_name, photo_url, last_login, is_admin, is_active)
  ON public.users TO humanaid_app;
GRANT SELECT (user_id, resource_id, action_type, details, ip_address, created_at)
  ON public.activity_log TO humanaid_app;

GRANT INSERT (name, slug, description, address, city, state, zip_code,
  phone, website, email, hours, primary_category_id, food_dist_onsite,
  food_dist_type, is_active, approval_status, location, created_at)
  ON public.resources TO humanaid_app;
GRANT UPDATE (name, slug, address, city, state, zip_code, phone, website,
  email, hours, primary_category_id, is_active, eligibility_requirements,
  appointment_required, walk_ins_accepted, food_dist_type, food_dist_onsite,
  service_area, languages_spoken, description, latitude, longitude, view_count)
  ON public.resources TO humanaid_app;

GRANT INSERT (name, slug) ON public.tags TO humanaid_app;
GRANT UPDATE (name) ON public.tags TO humanaid_app;
GRANT INSERT (resource_id, tag_id) ON public.resource_tags TO humanaid_app;
GRANT INSERT (name, description, address, city, state, zip_code, phone,
  website, email, hours, primary_category_id, tags, food_dist_onsite,
  food_dist_type, notes, submitted_by, submitted_by_name, submitted_by_uid,
  status, created_at) ON public.pending_submissions TO humanaid_app;
GRANT UPDATE (status, reviewed_at, reviewed_by)
  ON public.pending_submissions TO humanaid_app;

-- Strict target: no users.is_admin/user_type writes or identity-key updates.
-- Current sync explicitly INSERTs is_admin=FALSE, which still needs privilege:
-- remove that column from its INSERT after reviewing the safe default/triggers.
-- Existing admin promote/demote SQL MUST move to a separate operator path first.
GRANT INSERT (firebase_uid, email, display_name, photo_url, last_login)
  ON public.users TO humanaid_app;
GRANT UPDATE (email, display_name, photo_url, last_login)
  ON public.users TO humanaid_app;
GRANT INSERT (user_id, resource_id) ON public.user_favorites TO humanaid_app;
GRANT DELETE ON public.user_favorites TO humanaid_app;
GRANT INSERT (resource_id, issue_type, description, contact_email)
  ON public.resource_reports TO humanaid_app;
GRANT UPDATE (status, resolved_at) ON public.resource_reports TO humanaid_app;
GRANT INSERT (user_id, resource_id, action_type, details, ip_address, created_at)
  ON public.activity_log TO humanaid_app;

-- Resolve the actual six ID sequences; never grant ALL SEQUENCES/default rights.
DO $sequences$
DECLARE table_name text; sequence_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'resources', 'tags', 'pending_submissions', 'users', 'resource_reports', 'activity_log'
  ] LOOP
    sequence_name := pg_get_serial_sequence(format('public.%I', table_name), 'id');
    IF sequence_name IS NULL THEN
      RAISE EXCEPTION 'No owned ID sequence for public.%; review schema', table_name;
    END IF;
    EXECUTE format('GRANT USAGE ON SEQUENCE %s TO humanaid_app', sequence_name);
  END LOOP;
END
$sequences$;

-- Administrator-provisioned PostGIS in public is a prerequisite, not created here.
-- Stop and review if installed schemas/signatures differ. Standard catalog
-- routines and reviewed extension internals may retain normal PUBLIC permissions.
GRANT USAGE ON TYPE public.geometry, public.geography TO humanaid_app;
GRANT EXECUTE ON FUNCTION
  public.st_x(public.geometry),
  public.st_y(public.geometry),
  public.st_makepoint(double precision, double precision),
  public.st_setsrid(public.geometry, integer),
  public.st_distance(public.geography, public.geography, boolean),
  public.st_dwithin(public.geography, public.geography, double precision, boolean),
  public.geography(public.geometry),
  public.geometry(public.geography)
  TO humanaid_app;

DO $assertions$
BEGIN
  IF has_column_privilege('humanaid_app', 'public.users', 'is_admin', 'UPDATE')
     OR has_column_privilege('humanaid_app', 'public.users', 'is_admin', 'INSERT')
     OR has_column_privilege('humanaid_app', 'public.users', 'user_type', 'UPDATE')
     OR has_column_privilege('humanaid_app', 'public.users', 'user_type', 'INSERT')
     OR has_column_privilege('humanaid_app', 'public.users', 'firebase_uid', 'UPDATE')
     OR has_table_privilege('humanaid_app', 'public.users', 'DELETE') THEN
    RAISE EXCEPTION 'Strict app identity boundary failed';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON r.oid = m.member
    WHERE r.rolname = 'humanaid_app'
  ) THEN
    RAISE EXCEPTION 'App role has unexpected memberships';
  END IF;
END
$assertions$;

-- Default is a dry administrative review, even after removing the first guard.
-- NOLOGIN remains until a separate secure provisioning step. Do not add a password.
ROLLBACK;
