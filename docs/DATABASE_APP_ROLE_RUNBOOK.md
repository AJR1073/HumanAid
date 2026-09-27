# Database application role: review and migration runbook

**Proposal only. No database commands in this document or the SQL templates were executed. Do not apply them to production during Sprint 0.**

## Decision and compatibility gate

Replace application use of the `postgres` administrative identity with a narrowly granted role, provisioned first in isolated staging. Keep schema ownership, extension installation, migrations, grants, and identity administration outside the normal application role.

There are two distinct permission profiles:

1. **Current protected-runtime compatibility:** normal application grants plus `INSERT (is_admin)` and `UPDATE (is_admin)` on `users`. Hardened user sync explicitly inserts `FALSE` into `is_admin`, which still requires the INSERT privilege; only the protected administrator promotion/demotion routes update that column. Verified Firebase authentication, a verified email, and an existing database administrator flag restrict who can invoke those routes, but a compromised database application credential could still alter administrator flags. This profile is less privileged than a database administrator but is **not** the final privilege boundary requested here.
2. **Recommended separated-operator target:** normal application grants without any INSERT/UPDATE privilege on `users.is_admin`, no `users` DELETE, no identity-key UPDATE, and no database-role administration. First remove `is_admin` from the sync INSERT after confirming a safe `FALSE` database default and reviewing triggers; also move promotion/demotion to a separate operator tool or independently authorized administration service. The SQL template implements this target and will break current sync and promotion/demotion SQL if applied before these changes.

**Do not switch credentials until this difference is resolved and tested.** Merely wrapping `UPDATE users SET is_admin=...` in a `SECURITY DEFINER` function accepting a caller-supplied actor UID would not solve the problem: a caller holding the app credential could impersonate that actor. An administration service must verify Firebase identity independently and hold a separate narrowly scoped database identity; its credential must not be available to the public API process.

The API must not create an administrator because of an email string in a request or an email allowlist. The protected promotion flow resolves the target UID, checks the current Firebase account through the Admin SDK, requires a matching verified email and an enabled account, and updates by that verified UID. Before promotion, review the intended target's authority and existing administrators; review existing administrator accounts for verified emails before releasing this requirement so legitimate operators are not unexpectedly locked out.

Initial administrator bootstrap is an explicit operator action: verify the intended Firebase project and UID, confirm the corresponding enabled account and verified email with its owner, locate that UID's database row, update exactly that row through the operator channel, record the action, and test authorization. Do not auto-bootstrap the first user.

## Evidence and schema drift

The grant inventory comes from SQL in `backend/src/server.js`: resources/search/categories, submissions and approval, favorites/user sync, resource editing, administrator role changes, reports, and analytics. It excludes maintenance scripts, collectors, schema repair scripts, and proposed future features. Those need separate identities and review; granting the web API their permissions would defeat this exercise.

`database/schema.sql` is not the complete current schema. It omits `pending_submissions` and `resource_reports`, `users.is_admin` and `photo_url`, and columns used by later resource queries such as `hours`, `latitude`, and `longitude`. Its resource update trigger expects `updated_at`, whereas the baseline resource table declares `last_updated`. Scripts describe later fixes, but no live schema or trigger reconciliation was performed here. Staging must reproduce and reconcile the actual schema before role tests.

## Runtime grant ledger

All objects below are assumed to be in `public`; an operator must confirm actual schemas, defaults, owners, constraints, triggers, and sequence ownership. A statement referencing `table.*` requires access to every selected column. PostgreSQL grants are additive, including `PUBLIC` and memberships: a narrow direct grant cannot cancel a broader inherited grant. Table grants also do not grant sequence access. [PostgreSQL GRANT](https://www.postgresql.org/docs/current/sql-grant.html).

| Object | Current query requirement | Recommended app-role grant |
| --- | --- | --- |
| Database | Open pool connections | `CONNECT` only; no `CREATE` or `TEMPORARY` |
| Schema `public` | Resolve application tables/types/functions | `USAGE` only; no `CREATE` or ownership |
| `resources` | Search/details/admin listings use `r.*`; approval inserts; edits, cleanup, categorization, and view counters update | `SELECT`; column INSERT/UPDATE listed below; no DELETE/TRUNCATE |
| `categories` | Category lists use `c.*`; joins and classification read metadata | `SELECT` only |
| `resource_categories` | Count query reads category membership | `SELECT (resource_id, category_id)` only |
| `tags` | Search reads identifiers/labels; approval upserts tag names | `SELECT (id, name, slug)`, `INSERT (name, slug)`, `UPDATE (name)` |
| `resource_tags` | Search reads membership; approval inserts links | `SELECT (resource_id, tag_id)`, `INSERT (resource_id, tag_id)` |
| `pending_submissions` | Review uses `ps.*`; intake inserts; approval locks a pending row with `SELECT ... FOR UPDATE` and changes status/actor/time in one transaction | `SELECT`; column INSERT/UPDATE listed below (the UPDATE grant also supports the row lock; [PostgreSQL SELECT privileges](https://www.postgresql.org/docs/current/sql-select.html)) |
| `users` | Token-to-user/admin lookup, profile sync, favorites identity, administrator list and analytics join | `SELECT (id, firebase_uid, email, display_name, photo_url, last_login, is_admin, is_active)`; safe profile INSERT/UPDATE below |
| `user_favorites` | Read/check/toggle membership | `SELECT`, `INSERT (user_id, resource_id)`, `DELETE`; no UPDATE |
| `resource_reports` | Public report insertion; administrator uses `rr.*` and resolves report | `SELECT`, `INSERT (resource_id, issue_type, description, contact_email)`, `UPDATE (status, resolved_at)` |
| `activity_log` | Analytics writes and aggregates events | `SELECT (user_id, resource_id, action_type, details, ip_address, created_at)`, INSERT on the same six columns; no UPDATE/DELETE |
| Owned ID sequences for `resources`, `tags`, `pending_submissions`, `users`, `resource_reports`, `activity_log` | Defaults allocate new IDs | `USAGE` only on each sequence returned by `pg_get_serial_sequence`; no blanket grant to all sequences |

Column write allowlists implemented by the template:

- `resources` INSERT: `name, slug, description, address, city, state, zip_code, phone, website, email, hours, primary_category_id, food_dist_onsite, food_dist_type, is_active, approval_status, location, created_at`. Protected approval explicitly inserts `approval_status='approved'` and commits resource, tag links, and submission status together; no approval-status UPDATE grant is needed for this flow.
- `resources` UPDATE: `name, slug, address, city, state, zip_code, phone, website, email, hours, primary_category_id, is_active, eligibility_requirements, appointment_required, walk_ins_accepted, food_dist_type, food_dist_onsite, service_area, languages_spoken, description, latitude, longitude, view_count`.
- `pending_submissions` INSERT: `name, description, address, city, state, zip_code, phone, website, email, hours, primary_category_id, tags, food_dist_onsite, food_dist_type, notes, submitted_by, submitted_by_name, submitted_by_uid, status, created_at`.
- `pending_submissions` UPDATE: `status, reviewed_at, reviewed_by`.
- Target `users` INSERT: `firebase_uid, email, display_name, photo_url, last_login`. UPDATE: `email, display_name, photo_url, last_login`. Defaults and triggers must keep new users non-administrators. Current hardened sync explicitly names `is_admin` with literal `FALSE` on INSERT; its conflict UPDATE never changes `is_admin`. A later change must omit that INSERT column before using the strict target role.
- **Compatibility-only additions:** current hardened sync requires `INSERT (is_admin)` and the preserved authenticated promote/demote routes require `UPDATE (is_admin)` on `users`. Both additions are intentionally absent from the target SQL. If temporarily retained, record the remaining escalation risk and a dated plan for safe default-based sync and the separate operator path; do not describe that profile as preventing app-credential administrator changes.

Expected conventional sequence names are `resources_id_seq`, `tags_id_seq`, `pending_submissions_id_seq`, `users_id_seq`, `resource_reports_id_seq`, and `activity_log_id_seq`. The template resolves ownership rather than assuming those names. A missing/nonserial ID default is a schema-review blocker. `resource_tags`, `resource_categories`, and `user_favorites` need no sequence grants for their composite keys. `categories_id_seq` is not needed because runtime routes do not insert categories.

There is no runtime grant justification for sponsorship, donation, volunteer, arbitrary external-source, or future Referral Desk tables. Do not use `GRANT ALL`, `GRANT ... ON ALL TABLES`, or automatic broad future-table grants.

## PostGIS, routines, and ownership

An administrator provisions and upgrades PostGIS (and any required `pg_trgm` extension) and runs schema/index migrations. The app role must not own the database, schema, application tables, sequences, extensions, or privileged routines; it must have no `SUPERUSER`, `CREATEDB`, `CREATEROLE`, `REPLICATION`, `BYPASSRLS`, privileged memberships, or grant options.

Current geometry queries require the geometry/geography types, casts between them, `ST_X`, `ST_Y`, `ST_MakePoint`, `ST_SetSRID`, geography `ST_Distance`, and geography `ST_DWithin`. The template lists the used signatures. Check installed extension schema/signatures and effective EXECUTE permissions rather than granting every function in `public`. Ordinary PostgreSQL text-search/JSON/aggregate routines remain available through reviewed standard catalog permissions. [ST_MakePoint](https://postgis.net/docs/ST_MakePoint.html), [ST_Distance](https://postgis.net/docs/ST_Distance.html), [ST_DWithin](https://postgis.net/docs/ST_DWithin.html).

Audit executable `SECURITY DEFINER` routines and privileged triggers before granting access. Triggers can change data beyond the explicit column list and need separate inspection. `NOINHERIT` alone does not make granted role memberships safe. Set a controlled search path and deny CREATE in every reachable writable schema. [PostgreSQL schemas](https://www.postgresql.org/docs/current/ddl-schemas.html).

## Stage 1 — inventory and prepare, without changing production

1. Record the source revision, current backend/Hosting releases, database version, schema revision, extension versions, existing login identities, and nonsecret configuration. Identify every API/worker/script still using the administrative database account.
2. Create an explicitly authorized isolated staging database with synthetic fixtures and matching PostgreSQL/PostGIS versions. Do not restore production personal data just to test grants.
3. Inspect schemas, object owners, columns/defaults, triggers, constraints, sequence ownership, role memberships, existing ACLs, and default privileges. The companion [review SQL](../database/proposals/app_role_privilege_review.sql) reads catalogs only; it is not an automated pass/fail test and has not been run.
4. Reconcile baseline schema drift and the administrator-route compatibility gate above. Review `users.is_admin`/`user_type` defaults and all triggers so profile insertion cannot grant privileges indirectly.
5. Address privileges inherited from `PUBLIC`. The target template deliberately aborts when broad inherited privileges are present rather than silently revoking access used by unrelated services. For a dedicated, reviewed database an operator may need to revoke PUBLIC database CREATE/TEMP, schema CREATE, table/column rights, or EXECUTE on identified privileged routines, then explicitly restore required rights to other reviewed roles. Capture the old ACLs first. This is not a blanket production command.
6. Inspect default privileges for **each object-creating owner**. Revoke unwanted automatic grants for future objects, and explicitly grant each reviewed application capability after a migration. A schema-scoped default revoke cannot cancel a global default grant. [ALTER DEFAULT PRIVILEGES](https://www.postgresql.org/docs/current/sql-alterdefaultprivileges.html).

## Stage 2 — create the target role in staging

Review [humanaid_app_role.sql](../database/proposals/humanaid_app_role.sql). It starts with an unconditional exception and ends in ROLLBACK. The operator must work on a reviewed staging copy, remove the deliberate guard, provide the expected database name, and only replace ROLLBACK with COMMIT after the intended privileges are reviewed. Do not modify or run it as a production shortcut.

The role is created with `NOLOGIN` and no password. Existing roles are not silently altered. Run the catalog review and inspect effective grants before an operator enables login and securely sets a staging-only credential or configures a reviewed IAM database identity. Do not put a password in SQL text, shell history, process arguments, logs, Git, or this runbook. A later production identity is separately provisioned; do not reuse the staging password.

## Stage 3 — actual grant tests in isolated staging

Run using the new role, not an administrative connection pretending to test it. Use synthetic fixtures, transactions where appropriate, and a disposable database; sequence values are not rolled back. Tests must prove both success and denial:

| Must succeed | Must fail under the strict target |
| --- | --- |
| Geospatial search, text search, categories, counts, details | CREATE DATABASE/SCHEMA/TABLE/EXTENSION; ALTER/DROP app tables; CREATE ROLE; SET ROLE to an owner/admin |
| Approved test resource insertion and tag upsert/link | Resource DELETE/TRUNCATE; ungranted resource columns; arbitrary sequences or sequence `setval` |
| Submission insertion/listing and status review | Category INSERT/UPDATE/DELETE; unrelated table access |
| Token-bound profile sync and favorites toggle | INSERT/UPDATE `users.is_admin` or `user_type`; UPDATE `firebase_uid`; DELETE users |
| Report intake and resolution | Activity-log UPDATE/DELETE/TRUNCATE; unauthorized privilege GRANT |
| Event insert and administrator analytics aggregation | Calls to unreviewed privileged routines; writable schemas through PUBLIC/membership |

Separately test HTTP 401, 403, administrator success with a verified email, rejection of unverified-email administrators, cross-user isolation, revocation, and bootstrap. Test promotion against current Firebase target identity/email/disabled state, and confirm it updates the verified UID. Demotion currently targets the database email and removes the flag; test it separately with an authorized administrator. Test concurrent duplicate approval and transaction rollback so a failed approval leaves neither partial resource/tag changes nor a reviewed submission. Database role checks are not user authorization: the shared app role can act on multiple users' rows within its grants, so server token binding remains essential. Test the proposed separate operator path's identity checks and audit trail before enabling it.

Use catalog assertions (`has_table_privilege`, `has_column_privilege`, `has_sequence_privilege`, memberships and ownership) **and real allowed/denied statements**. A mock `pg.Pool` unit test cannot validate PostgreSQL permissions. Treat any needed grant outside this ledger as a reviewed code/schema change, not a reason to grant broad access.

## Stage 4 — managed secrets and staging deployment

Use `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_POOL_MAX`, and either `INSTANCE_CONNECTION_NAME` or `DB_HOST`/`DB_PORT`. Runtime TLS controls are `DB_SSL_MODE` and `DB_SSL_CA`; use verified TLS for production TCP or the reviewed Cloud SQL socket/connector. Do not weaken transport checks to resolve a grant failure.

The operator stores a distinct password in Secret Manager and grants only the staging runtime service identity access to that secret. Bind it to the Function, or map a pinned version to the Cloud Run revision's `DB_PASSWORD` environment variable. Keep the PostgreSQL user and cloud service-account identity conceptually separate. Secret Manager does not itself create SQL privileges. Verify secrets resolve at runtime and that no administrative credential remains an application fallback. [Functions secret binding](https://firebase.google.com/docs/functions/config-env), [Cloud Run secret references](https://docs.cloud.google.com/run/docs/configuring/services/secrets).

Record nonsecret version IDs, not values. Staging smoke tests must cover new connections after restart, pool exhaustion/backoff, TLS/connector failures, all application features, and rejected grants. Observe logs/metrics without recording tokens, passwords, full connection strings, or personal payloads.

## Stage 5 — later production promotion and rollback

Production work requires a separate reviewed release decision and owner-operated credential rotation. Once staging passes:

1. Take an approved recoverable database backup and capture existing ACLs/configuration. Resolve the administrator separation gate; select compatible backend code.
2. Provision the reviewed production role and secret through the operator process. Grant required SQL permissions and exact secret access without changing schema ownership.
3. Stage a backend revision using the new identity; verify health and feature contracts, then promote through the architecture runbook. Record the rollout and rollback thresholds.
4. Confirm all running revisions, workers, scheduled jobs, and tools have stopped using the administrative account. Drain old pools and revisions. Remove the app runtime's access to old administrator-secret versions and remove the old credential/configuration fallback. The owner rotates the exposed administrator password; retain a separate operational recovery identity and do not disable Cloud SQL administration blindly.
5. Re-run effective-grant checks and alert on permission errors, failed login spikes, excess connections, and rejected privilege operations. Do not grant `postgres` access back to the app in response to an error.

Rollback: restore a known-good **compatible** backend revision using the restricted identity and reviewed secret version, or disable the affected feature while investigating. Do not roll back to exposed credentials or the old superuser application configuration. Preserve new data; traffic rollback does not undo data mutations. Leave unused role/secret cleanup to a later reviewed action after the observation window.

## Validation status

The proposal was derived from local source and primary documentation. Neither template was executed; no live schema, SQL grants, database identity, managed secret, or production infrastructure was changed. The final local test/build report is separate from this future staging database validation.
