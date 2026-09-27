# Production access and credential handling

The current frontend uses Firebase Hosting and its `/api/**` rewrite to Firebase
Function `api`. A separate `humanaid-api` Cloud Run service exists; the frontend
does not currently select it. See `../ARCHITECTURE_RECOMMENDATION.md` for the
proposed architecture and staging/promotion requirements.

## Required rotation

Old versions of this document contained a production database password. Removing
it here does not revoke it or remove it from Git history. The owner must follow
`../SECURITY_ROTATION_REQUIRED.md`. No credentials were rotated during Sprint 0.

## Configuration

Supply database credentials through environment variables backed by Secret
Manager in hosted environments. Keep local `.env` files private and ignored.
Never place credentials in source, command-line arguments, deployment commands,
support messages, or diagnostic output. Do not copy production credentials into
development or staging.

Store or update the database password in Google Secret Manager. Reference the
secret by name and a pinned version when binding it to the Firebase Function or
to Cloud Run's runtime `DB_PASSWORD` variable. Apply bindings only through a
separately approved release. Never put plaintext passwords in command-line
arguments or ordinary deployment environment-variable assignments.

Use a dedicated application database role after the least-privilege runbook has
passed staging validation. The application must not use the PostgreSQL superuser.
Schema migrations and operator/admin bootstrap use a separate operator identity.

## Operational access

Use an approved Cloud SQL connection method and a dedicated operator identity.
Request the least access needed, confirm the environment, and take a database
backup before an authorized migration. A checked-in SQL template is not approval
to run it against production. Do not run the historical maintenance scripts as a
test suite; several update or delete database records.

Production routing, infrastructure, credentials and data were not changed by
Sprint 0. Production deployment remains a separate approval step.
