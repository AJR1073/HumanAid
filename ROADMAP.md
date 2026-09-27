# HumanAid roadmap

Updated September 27, 2026. This is the current status summary; older PRD and changelog entries remain historical records.

## CURRENT — production evidence and existing application

- Public frontend and health endpoints respond through Firebase Hosting and Function `api`; PostgreSQL/PostGIS is the configured data architecture.
- The application includes map and category browsing, resource search and details, Firebase sign-in, favorites, submissions, administrator review/editing, and reports.
- A separate `humanaid-api` Cloud Run service exists, but current frontend requests use the Hosting `/api` route. Health responses alone do not identify its deployed source or prove feature parity.
- Existing directory data and AI cleanup outputs are retained. Neither a large record count nor an AI assessment is proof of provider or human verification.

## LOCAL / UNRELEASED — Sprint 0

The `security/hardening` branch contains the local product work and Sprint 0 implementation in reviewable commits. These changes are not deployed or pushed. The mobile GlobalSearch commit, analytics, reporting, administration, map behavior, security protections, operational tooling, tests, and proposals are preserved locally. The NDP 211 V2 adapter is an offline synthetic skeleton only; it has no live transport, production route, or authorization.

Local work includes:

- Verified Firebase ID tokens, administrator authorization, and token-bound personal actions.
- SSRF protection for URL scanning, bounded inputs, request limits, CORS, and nonrevealing errors/health responses.
- Removal of private credentials from current source, plus an owner-operated rotation inventory.
- Recovery material outside Git and a local `security/hardening` branch.
- A reviewed database-role plan, staging/promotion plan, and 211/HSDS proposal.
- An isolated NDP 211 V2 adapter skeleton with bounded synthetic dry runs and
  provenance tests; live operations remain disabled. See the
  [skeleton scope](docs/NDP_211_V2_SKELETON.md) and
  [local recovery/checkpoint report](docs/SPRINT_0_LOCAL_REPORT.md).

Release gate: backend tests, frontend tests, production build, reviewed security diff, completed owner credential rotation, and staging exercises. Passing local tests is not a production deployment. The database-role template remains blocked until schema and administrator-role compatibility decisions are resolved.

## NEXT — Referral Desk

Implement a staff-assisted referral workflow before an autonomous navigator:

1. Define staff roles, organization boundaries, consent, data minimization, retention, and access logging.
2. Capture a person's stated need without placing personal case details in public resource records or analytics.
3. Offer a shortlist showing service eligibility, coverage, contact methods, source, verification date, and uncertainty.
4. Let staff record a referral, follow-up date, and outcome with an audit trail. A referral is not a guaranteed placement or acceptance.
5. Test cross-user and cross-organization isolation, revocation, accessibility, correction, and deletion workflows with synthetic cases.

Entry gate: stable authenticated APIs and staging. Exit gate: authorized staff can create, review, and follow up on referrals; unauthorized users cannot read case details; no automatic provider outreach is enabled without an explicit workflow decision.

## PLANNED — subsequent capabilities

| Capability | Dependencies and acceptance criteria |
| --- | --- |
| 211 integration | Obtain source-specific access and redistribution terms; pin source/schema versions; isolate raw imports; validate mapping, deletions, duplicates, and per-fact provenance before reviewed publication. No live API is connected in Sprint 0. |
| Verification agent | Queue bounded checks with SSRF controls, source limits, retries, and evidence. Distinguish an automated observation from human/provider verification; route uncertain changes for review. |
| Provider claiming | Verify authority over the claimed organization/service independently of a supplied email or UID. Bound edit permissions, retain change history, and support rejection, dispute, expiry, and revocation. |
| AI navigator | Retrieve from published, permission-appropriate records; cite the facts and verification dates used; disclose uncertainty; provide a human handoff. No autonomous eligibility decisions, unsupported availability promises, or unapproved outreach. |
| HumanAid Intelligence | Define metrics, provenance, consent, retention, aggregation, and small-group disclosure protections. Validate data quality and interpretation before providing operational insights. |

Each capability needs its own reviewed scope, cost limits, security checks, and release decision. A database table or design document does not establish an implemented feature.

## Infrastructure decision gates

- Keep Firebase Hosting and its Function rewrite during Sprint 0.
- Trial a least-privileged database identity in isolated staging; resolve sync/default and administrator-path compatibility before removing `users.is_admin` grants.
- Evaluate Cloud Run API/container migration only after reproducible entrypoint, connection-budget, authentication, secrets, route-compatibility, and rollback tests.
- Run scheduled verification/import work separately from interactive requests, with distinct service identities and bounded database access.

See [ARCHITECTURE_RECOMMENDATION.md](ARCHITECTURE_RECOMMENDATION.md), [the database runbook](docs/DATABASE_APP_ROLE_RUNBOOK.md), and [the HSDS proposal](docs/OPEN_REFERRAL_211_DESIGN.md).
