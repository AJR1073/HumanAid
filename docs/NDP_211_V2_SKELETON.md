# NDP 211 V2: local offline skeleton

This follow-on to Sprint 0 creates an isolated backend adapter boundary and synthetic contract tests. It does not connect HumanAid to 211. No live account, subscription, credential, HTTP request, import, database migration, public route, scheduler, or directory write is created. There is no environment flag that enables live access.

The local repository contains the [211 / Open Referral design](OPEN_REFERRAL_211_DESIGN.md), but no earlier NDP V2-specific instructions, approved endpoint/schema contract, source permissions, or data-use agreement. This implementation follows the available design and records that gap instead of inventing an NDP response shape. The existing integer resource IDs and API remain unchanged.

## Source contract boundary

The official [NDP developer portal](https://apiportal.211.org/) describes Search, Export, Query, Suggest and Filter V2 and marks V2 as preview. Its [getting-started guide](https://apiportal.211.org/get-started-overview) describes developer registration, product subscriptions and API documentation access. These public pages were checked on 2026-09-27; they do not establish HumanAid's authorization, license scope, endpoint paths, or precise response schemas.

`backend/src/integrations/ndp211-v2/index.js` exports a disabled adapter with `search`, `query`, `export`, `suggest` and `filters` boundaries. Each rejects with `LIVE_ACCESS_DISABLED`. The only implemented operation is `dryRun(document, { fetchedAt })`, using the explicitly internal format `humanaid.ndp211-v2.synthetic.v1`. This is **neither an NDP wire format nor an HSDS export**, and the mapping version states its synthetic status.

## Offline behavior

- Accept JSON text or a Buffer, up to 256 KiB and 100 records, with at most 10,000 characters per allowed text field. Reject the entire batch on malformed records, unknown fields, unresolved organization relationships or conflicting duplicate source versions.
- Propose organization, service and location facts with per-field and per-relationship lineage. Source IDs remain namespaced external IDs; no automatic crosswalk, merge, canonical ID allocation or publication occurs.
- Keep source modification time nullable and separate from the required UTC fetch timestamp. Every proposal remains `unreviewed`; human/provider verification timestamps stay null.
- Return immutable snapshot **metadata**, content hashes and stable source-version identities. Raw payload storage is deferred; `persisted: false` is explicit. Candidate reports contain source facts and are for restricted local review, not public API responses or logs.
- Deduplicate identical source versions in a batch. Stable identities support later idempotency design; this in-memory skeleton does not claim durable exactly-once processing.
- Represent source deletions as review evidence. Never delete current HumanAid records automatically. A failure returns no partial candidate report.

The fixture `backend/test/fixtures/ndp211-v2.synthetic.json` is wholly fictional. It includes an organization, service, location and tombstone; it contains no people, real contacts, confidential addresses or actual 211 records.

Run the offline contract tests from `backend`:

```sh
npm test -- --runInBand src/__tests__/ndp211-v2.test.js
```

## Remaining implementation gates

1. Recover or reconfirm the prior V2-specific requirements. Obtain owner-approved permitted use, attribution, retention and redistribution terms, plus authorized source/geographic scope. Do not register HumanAid as a contributing 211 organization.
2. Obtain and pin the authorized V2 request/response definitions, base endpoint allowlist, authentication header contract, pagination, deletion semantics and rate budget. Add sanitized authorized wire fixtures and schema-drift tests before implementing the actual parser.
3. Implement a private transport with verified TLS, endpoint/DNS restrictions, no credential-bearing redirects, bounded time and bytes, bounded pagination/retries, and tested timeout/429/partial-page behavior. No client/case information may be sent as incidental source queries. Credentials must remain server-side managed secret references.
4. Add restricted snapshot storage, retention/deletion enforcement, durable checkpoints/idempotency and reviewed source-ID crosswalks through explicit migrations. Complete service-at-location, address/confidentiality, schedule, taxonomy and other mappings from the design; the present subset is intentionally incomplete.
5. Build reviewer diff/conflict resolution and transactional approved publication. Validate HSDS exports against the separately pinned official HSDS schemas; do not label this synthetic output conformant. Live staging access and production deployment require separate authorization.
