# Sprint 0 local checkpoint — September 27, 2026

This report describes the local `security/hardening-clean` branch and its Candidate 09 documentation checkpoint. The Sprint 0 commits are local and unreleased. The production site is unchanged; nothing was pushed, merged, or deployed, and no migration or credential rotation was performed. No live 211 API was contacted.

## Repository and recovery

The clean review worktree is `/home/admx/CascadeProjects/HumanAid-clean-review`; it starts from stored `origin/main` at `a7651e1641b0fb30eb071f0b52bf7d68bfe4f116`. The original `/home/admx/CascadeProjects/HumanAid` worktree and `security/hardening` branch remain preserved. A recovery branch and private supplemental recovery snapshot preserve that worktree's staged Candidate 09 diff, tracked unstaged diff, status, and untracked held scripts. The recovery materials remain outside Git and must not be uploaded or committed. The mobile-search work was recreated without the generated Firebase Hosting cache.

### Local commit history

The following SHAs and messages are read from Git history, in order. They are local commits and do not indicate deployment:

| Candidate | Commit | Message |
| --- | --- | --- |
| Recreated mobile-search work | `c9c27f8ca8ed52507e35199f9f7e474b423714f8` | `feat: implement mobile global search with collapsible filters and dynamic map resizing` |
| 01 | `6fb79d5a5337e4a0c4aecf248c410629aeb97ebc` | `chore(security): remove credential defaults and require environment-based Firebase configuration` |
| 02 | `baa8f86ef43504d1a530aa47c2b7d0adf6f87f75` | `fix(security): enforce authenticated client and API boundaries` |
| 03 | `7f1f644f724beaccb3a7fb08d43b593b783dada5` | `feat(analytics): preserve authenticated analytics and tracking` |
| 04 | `0a28cc0264ced9e3f2d5a5423525736f7c33ca05` | `feat(admin): preserve reporting resource review and administrator workflows` |
| 05 | `e3e55dec95dc920b3f45fcfd4b0be22525e9b6bb` | `fix(search): preserve mobile search and map behavior` |
| 06 | `60d645b4d94f2021a52364087b4f73e13b2870d5` | `chore(operations): harden bootstrap and maintenance tooling` |
| 07 | `58a689ed00efea0dbfdd68820cf3dad0f41e6353` | `docs(database): add least-privilege and architecture proposals` |
| 08 | `53ec2d76d80c5588b66fc5351425746262c5dffc` | `feat(211): add disabled NDP V2 and Open Referral foundation` |

Candidate 09 consists of this documentation checkpoint. `docs/REPORT_RESOLUTION_AUDIT_FOLLOWUP.md` was committed with Candidate 04 and is not part of Candidate 09. The generated `.firebase/hosting.ZnJvbnRlbmQvZGlzdA.cache` has no change in the clean branch relative to `origin/main`.

## Implementation checkpoint

The local commits retain the existing product work while adding backend Firebase token verification and administrator authorization, token-bound user actions, SSRF protections for URL scanning, input/rate/CORS hardening, and safer public resource responses. Frontend Firebase configuration uses environment variables; source cleanup does not rotate historical credentials. Analytics writes with related counters are transactional. Cleanup and categorization batches are transactional. Report resolution is guarded against overwriting an already-resolved report.

Operational bootstrap and maintenance scripts have additional safety guards. Four scripts remain deliberately held, uncommitted, and unexecuted:

| File | Reason held |
| --- | --- |
| `backend/src/scripts/add_transportation_services.js` | Contains unreviewed real resource data, approximate coordinates, and direct inserts; also lacks client release. |
| `backend/src/scripts/seed_analytics.js` | Adds fabricated production-shaped activity and view counts; also lacks client release. |
| `backend/src/scripts/test_get_resource.js` | Remote-target TLS guard is inconsistent with its database pool TLS configuration. |
| `backend/src/scripts/create_activity_log.js` | Contains schema mutation and lacks client release. |

The report-resolution route is protected by authenticated-admin middleware and obtains authorization from the verified Firebase token plus the active administrator record. Repeated resolution is guarded. Reviewer identity is **not persisted**, and the API does not accept reviewer identity from caller input. The checked-in historical schema does not define `resource_reports`; the actual production schema remains to be reconciled. No migration or production schema inspection was performed. See [the report-resolution audit follow-up](REPORT_RESOLUTION_AUDIT_FOLLOWUP.md), committed with Candidate 04.

The NDP 211 V2 adapter rejects live operations and accepts only its bounded HumanAid synthetic envelope for offline dry runs. It has no HTTP transport, credentials, production route, scheduler, database writes, or path that returns Trial data. The fixture is fictional, not an NDP wire payload or HSDS-conformant export. HumanAid has no production 211 authorization; Trial data is not approved for production use. Source-specific permissions, attribution, retention, and redistribution terms remain prerequisites. See [the skeleton](NDP_211_V2_SKELETON.md) and [Open Referral design](OPEN_REFERRAL_211_DESIGN.md).

## Latest validation

The following results are from the isolated staged Candidate 09 snapshot, including Candidates 01–08 and only the approved Candidate 09 documentation. No live service or database was used.

| Check | Result |
| --- | --- |
| Dedicated NDP 211 V2 contract tests | 28 passed |
| Full backend suite | 283 tests passed across 11 suites |
| Full frontend suite | 62 tests passed across 11 files |
| Frontend production build | Passed |
| Current-source secret scan | Zero findings |
| Staged-content secret scan | Zero findings |
| Cached whitespace check | Passed |

The build reports existing large-bundle and stale browser compatibility-data warnings; neither failed the build. Test output includes expected generic error logs for negative-path tests. Secret scanning is heuristic and excludes ignored environment files and Git history; a zero-finding result does not establish that historical credentials have been rotated.

Tests use mocks and synthetic data. They do not prove production database-schema compatibility, cloud configuration, remote grants, live Firebase behavior, or deployment readiness. SQL proposals remain unexecuted. The report-resolution audit field remains an outstanding schema review item.

## Production and release status

Firebase Hosting → Firebase Function `api` remains the current production request architecture. Cloud Run is only a future staged evaluation. The production site and routing are unchanged. Sprint 0 security work and the 211 adapter are local/unreleased; the 211 integration is not live. Referral Desk is next. AI Navigator, provider claiming, verification agent, and HumanAid Intelligence remain planned.

Historical collection counts and automated AI cleanup are observations only; they do not establish human/provider verification or complete coverage for Illinois, Missouri, or any other region. No HumanAid directory-wide verification claim is made.

Remaining release gates include owner-operated credential rotation, schema reconciliation and reviewer-audit design, isolated staging exercises, and a separately approved release decision. The database role SQL proposals were not run. These local commits do not authorize a push or deployment.
