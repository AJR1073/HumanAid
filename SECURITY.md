# HumanAid security and local promotion checklist

Sprint 0 hardening is local and unreleased. Production still needs owner credential
rotation, staging validation and a separately approved release. Source removal
neither revokes an exposed credential nor removes it from Git history.

## Recovery and private files

A recovery branch preserves the starting commit. Separate private archives and
patches preserve dirty, untracked and ignored files. Their locations are in the
Sprint 0 report, outside this repository. They contain old credentials and must
remain private; do not attach them to a PR or share link. Backup directories use
0700 and files use 0600. Private local environment files use 0600.

`.env*`, `*.env`, credential/key files and environment backups are ignored by Git.
The browser's build includes every `VITE_*` value; none may hold a server secret.
Run `python3 scripts/check_secrets.py` before staging changes. It reports candidate
file locations and secret types only. It is a heuristic check, not a credential
validity test or proof that historical commits are clean. Review the staged diff
without copying secret-bearing removed lines into logs or messages.

## Authentication and authorization

The frontend gets the signed-in user's Firebase ID token and sends it in an
`Authorization: Bearer` header to the configured HumanAid API only. API requests
do not follow redirects. Mapbox/external calls never use this token helper.

The API uses Firebase Admin `verifyIdToken(..., true)` and derives UID/email from
the verified token. Expired, revoked, malformed or invalid tokens fail with 401.
A verified Firebase email and current database administrator flag for the verified UID are required for
administrative routes; other authenticated users receive 403. Browser route
visibility and `isAdmin` state are display conveniences, not authority. Favorites
and profile sync are bound to the token UID; mismatched browser identity/role
claims are rejected. No hardcoded email may grant administrator status.

Use Application Default Credentials or an attached runtime service identity.
Configure the correct `FIREBASE_PROJECT_ID`. Never ship service-account JSON.
Production must not enable the Firebase Auth emulator. Development/staging must
use isolated Firebase projects or reviewed emulator settings and synthetic users.
The frontend requires explicit `VITE_FIREBASE_API_KEY`,
`VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and
`VITE_FIREBASE_APP_ID` values for the intended environment. Missing or partial
configuration is rejected; there is no default production Firebase configuration.
Keep actual values in ignored environment files and use sanitized placeholders or
synthetic values in documentation and tests. Configure an isolated development
project before testing sign-in or registration locally.

Before promotion, an authorized owner must review existing database administrator
flags and Firebase accounts: earlier unauthenticated endpoints may have changed
them. New middleware does not prove historical administrator assignments are safe.

Initial administrator bootstrap is an explicit operator action for a real,
verified Firebase UID. `promote_admin.js` requires both `ALLOW_ADMIN_BOOTSTRAP=true`
and `ALLOW_DATABASE_MAINTENANCE=true`, operator database configuration, Firebase
Admin identity access, and an active synced user with a matching verified email.
Remote bootstrap also requires `ALLOW_REMOTE_DATABASE=true` and `DB_SSL=true`
with verified TLS; `DB_SSL_CA` supplies a CA when needed. Firebase Auth emulators
are rejected for this privileged operation. The old fabricated-UID insertion
script is retired. Unit tests inject synthetic identities and database clients;
never run a real bootstrap as a test.

## Public client keys

The Firebase browser API key identifies the client project; it is not an Admin
SDK credential. Review API restrictions, authorized authentication domains,
quotas and applicable Firebase security rules. Those remote settings were not
changed or audited by this local sprint. [Firebase API key guidance](https://firebase.google.com/docs/projects/api-keys).

Use a Mapbox public token with the minimum browser scopes and restrictions for
approved production/staging/local origins. Never put a secret Mapbox token in
`VITE_MAPBOX_TOKEN`. Use separate tokens and quotas where practical.
[Mapbox token guidance](https://docs.mapbox.com/accounts/guides/tokens/).

## URL scanning and API boundaries

URL scanning requires authentication and is limited to public HTTP/HTTPS HTML.
All DNS addresses and redirect destinations are validated; connections use the
validated IP while retaining hostname/TLS verification. Private, loopback,
link-local, metadata, internal and special-purpose addresses are rejected. The
fetcher bounds the whole operation to 10 seconds, three redirects, and 2 MiB each
for wire and decoded response data. It accepts HTML/XHTML only, disables shared
socket reuse and does not consume environment proxy settings.

The API uses a 64 KiB JSON body limit, endpoint validation, and bounded per-process
rate limits. `/api/health` exposes basic status only; database diagnostics are not
public. Database and SDK error details must not be returned to clients.

Public resource details use an explicit response allowlist. Internal submitter,
approver and verifier IDs, moderation/engagement metadata, raw database geometry,
and future database columns are excluded. Existing directory and editor fields
remain available, including derived latitude/longitude.

Production CORS requires exact HTTPS `CORS_ORIGINS` (comma-separated); wildcard
origins are rejected. No-Origin requests still require normal authentication on
protected routes. `TRUST_PROXY_HOPS=0` is the conservative default. Determine and
test the real proxy chain in staging before changing it; arbitrary trust of
forwarded IP headers permits rate-limit spoofing. In-memory rate limits apply to
one process and do not establish a fleet-wide abuse quota. Review a shared/edge
limit before scaling or high-volume exposure.

## Database and operational scripts

Runtime credentials and pool limits come from environment configuration. Remote
nonproduction database access requires `ALLOW_REMOTE_DATABASE=true`. Production
TCP connections require `DB_SSL_MODE=verify-full`, with the correct CA where
needed, or use a reviewed Cloud SQL socket binding. Do not disable verification
just to make a deployment pass. See the app-role runbook for staged grants and
Secret Manager adoption; its templates have not been executed.

New maintenance scripts require `ALLOW_DATABASE_MAINTENANCE=true` plus explicit
operator DB configuration. Remote maintenance additionally requires verified TLS
(`DB_SSL=true`) and `ALLOW_REMOTE_DATABASE=true`. Existing historical repair and
collection scripts still need individual review; many mutate data. The report
verification script requires explicit mutation approval, a local/staging URL,
a fixture report ID and a Firebase admin ID token; known production Hosting
names are blocked. These opt-ins are safeguards, not authorization to run them.

## Safe promotion sequence

1. Owner rotates exposed credentials using `SECURITY_ROTATION_REQUIRED.md`.
2. Review the sanitized changes and stage source/docs/tests explicitly, excluding
   environment files, datasets, recovery archives, cache files and generated builds.
3. Run backend/frontend tests, frontend build and the secret scan. Commit locally
   only after review; pushing remains a separate instruction.
4. Follow `ARCHITECTURE_RECOMMENDATION.md` for isolated staging, schema/role checks,
   real Firebase token tests, browser verification and release/rollback evidence.
5. Inventory and test all exposed backend entrypoints, including direct Function
   URLs and the separate Cloud Run service; harden or restrict each through a
   separately authorized release. Hosting routing alone is not this inventory.
6. Obtain separate production release approval. Neither tests nor a local build
   authorize deployment, routing changes, credential rotation or migrations.
