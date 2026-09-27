# HumanAid

HumanAid helps people find local assistance through a map, resource search, and service information. The public site is [humanaidapp.org](https://humanaidapp.org).

## Status as of September 27, 2026

**Sprint 0 changes are local and unreleased.** They must not be described as deployed security fixes. No production migration, credential rotation, routing change, push, or deployment is part of this sprint.

The production site is unchanged by this local work. The current production request path remains Firebase Hosting to the Firebase Function `api`; the offline 211 adapter is not live.

| State | What is known |
| --- | --- |
| CURRENT — production observed | Firebase Hosting serves the frontend. Its relative `/api` requests reach Firebase Function `api`. Public Hosting and API health checks returned HTTP 200 during the audit. The serving JavaScript matched the local built asset and used relative API paths. |
| CURRENT — application features present in source | Mapbox map, PostgreSQL/PostGIS resource search, categories, resource details, Firebase sign-in, favorites, submissions and review, administrator editing, and reporting. Source presence is not proof that every workflow or security change is live. |
| LOCAL — preserved work and Sprint 0 | Mobile GlobalSearch and map resizing, AnalyticsDashboard, ReportInfoModal, administrator enhancements, backend scripts, tests, security hardening, and an offline NDP 211 V2 skeleton with synthetic fixtures. The [Sprint 0 report](docs/SPRINT_0_LOCAL_REPORT.md) records recovery and checks. |
| NEXT | Referral Desk: a reviewed workflow for staff to help someone find and follow up on suitable services. |
| PLANNED | 211 integration, verification agent, provider claiming, AI navigator, and HumanAid Intelligence. These are proposals, not available integrations or verified production capabilities. |

Resource counts, category counts, and previous AI cleanup results are historical dataset observations. They do not establish that every listing has been verified by a person or provider. Do not describe the whole directory as verified.

## Current architecture

```text
Browser → Firebase Hosting → /api/** → Firebase Function api
                                           ↓
                                  PostgreSQL / Cloud SQL
                                  with PostGIS
```

The configured Firebase project is `gocasino-1ecc9`. `firebase.json` serves `frontend/dist` and rewrites `/api/**` to the function. A separate Cloud Run service named `humanaid-api` also responded to a health check; the current frontend does not select its URL. Its deployed revision and configuration have not been established as equivalent to this working tree.

Firebase Authentication is already integrated; it is not a future feature. Sprint 0 adds server-side verification and authorization around the existing workflows. Browser Firebase and Mapbox configuration are public-client configuration; server credentials belong outside Git. See [SECURITY.md](SECURITY.md) and [SECURITY_ROTATION_REQUIRED.md](SECURITY_ROTATION_REQUIRED.md).

## Local development

Use the Node version declared in `backend/package.json` and the lockfiles. The existing Dockerfile is a separate deployment artifact and must be reviewed before any future container release.

From the repository root:

```bash
npm ci --prefix backend
npm ci --prefix frontend
cp -n backend/.env.example backend/.env
cp -n frontend/.env.example frontend/.env
```

The copy commands preserve existing environment files. Fill in new ignored environment files with local development settings. Never copy production credentials into a shared command, issue, test fixture, or documentation. Use `VITE_API_URL=/api` so Vite's development proxy sends requests to the local backend on port 4000. Frontend environment values are included in the browser build and must not contain server secrets.

Configure Firebase explicitly for the intended environment with `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, and `VITE_FIREBASE_APP_ID`. All four are required; missing or partial configuration is rejected, and no default production Firebase project is selected. Use an isolated development project for local sign-in and registration. Keep actual configuration in ignored environment files; documentation and test examples must use sanitized placeholders or synthetic values.

The backend uses `DB_USER`, `DB_PASSWORD`, `DB_NAME`, and either `DB_HOST`/`DB_PORT` or `INSTANCE_CONNECTION_NAME`. Other relevant controls include `DB_POOL_MAX`, `DB_SSL_MODE`, `DB_SSL_CA`, `FIREBASE_PROJECT_ID`/`GOOGLE_CLOUD_PROJECT`, and production `CORS_ORIGINS`; consult the current `.env.example` files and security documentation for exact requirements. A remote database in nonproduction requires an explicit `ALLOW_REMOTE_DATABASE=true`; do not enable it merely to make a local test pass.

Provision an isolated local PostgreSQL/PostGIS database with synthetic data. **`database/schema.sql` is a historical baseline, not a complete migration to the current runtime schema.** Later scripts and local features reference additional columns and tables, including `pending_submissions`, `resource_reports`, `users.is_admin`, and `users.photo_url`. Review and consolidate schema changes before use. Do not run historical repair, collection, or initialization scripts against production as a setup shortcut. The [database role runbook](docs/DATABASE_APP_ROLE_RUNBOOK.md) lists these compatibility checks.

Start the two development processes in separate terminals:

```bash
npm run dev --prefix backend
```

```bash
npm run dev --prefix frontend
```

Open `http://localhost:3000`. Use a dedicated development Firebase project or reviewed emulator setup and synthetic accounts; do not use real user data for regression tests. Initial administrator access must be provisioned by an authorized operator for a verified Firebase UID. There is no email-address shortcut that should grant administrator access.

## Checks

```bash
npm test --prefix backend -- --runInBand
npm test --prefix frontend -- --run
npm run build --prefix frontend
```

These commands do not deploy. Unit tests use mocks and do not establish production authorization, database-grant correctness, or cloud configuration. Database permission tests require a separate isolated staging database and explicit operator review; the SQL proposals have not been executed. Preserve test failures and inspect them before considering promotion.

## Repository map

| Path | Purpose |
| --- | --- |
| `frontend/src/App.jsx`, `components/`, `contexts/` | React interface, search, maps, sign-in, user and administrator workflows |
| `backend/src/server.js` | Express routes and Firebase Function export |
| `backend/src/scripts/`, `scripts/` | Maintenance and data tools; review individually before running |
| `database/schema.sql` | Historical schema baseline |
| `database/proposals/` | Unexecuted application-role templates and review queries |
| `firebase.json`, `.firebaserc` | Current Hosting/Functions configuration |
| `backend/Dockerfile` | Separate container path requiring staging review |

## Decisions and roadmap

- [ROADMAP.md](ROADMAP.md): CURRENT, NEXT, and PLANNED work and acceptance gates.
- [ARCHITECTURE_RECOMMENDATION.md](ARCHITECTURE_RECOMMENDATION.md): retain current routing while evaluating a staged Cloud Run migration.
- [Database application-role runbook](docs/DATABASE_APP_ROLE_RUNBOOK.md): current privileges, stricter target, secrets, tests, promotion, and rollback.
- [211 / Open Referral proposal](docs/OPEN_REFERRAL_211_DESIGN.md): isolated raw imports, provenance, verification, and HSDS mapping.
- [NDP 211 V2 skeleton](docs/NDP_211_V2_SKELETON.md): disabled adapter, synthetic contract tests, and remaining live-integration requirements.
- [PRD.md](PRD.md) and [CHANGELOG.md](CHANGELOG.md): historical product context; unfinished items and old deployment claims are not the current release status.

Before any later commit, review the diff and the credential-rotation inventory. Source cleanup does not remove credentials from history or revoke them. The owner performs credential rotation; production release requires a separate reviewed staging and promotion decision.
