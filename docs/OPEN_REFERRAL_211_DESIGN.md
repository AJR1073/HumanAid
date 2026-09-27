# 211 and Open Referral: proposed data architecture

**This document is a design proposal. No live 211 account, subscription, connection, import, schema migration, or provider-claim workflow was created in Sprint 0.** A later local continuation adds a [disabled NDP 211 V2 skeleton](NDP_211_V2_SKELETON.md) with synthetic fixtures and tests. Current HumanAid resource records and API contracts remain in place. Referral Desk is next; live integration remains planned.

## Decision

Keep three separate layers: immutable source snapshots, proposed normalized facts, and reviewed HumanAid directory records. Fetching a record is not verification of its accuracy. An automated check, a human review, and an authorized provider's confirmation must remain distinguishable.

Use Open Referral HSDS as the interchange model, with an explicit version selected for each adapter/export. The candidate baseline for this proposal is **HSDS 3.3.1**. Validate against that version's canonical JSON Schemas when implementation begins; the internal relational names below are not a claim of HSDS compliance. HSDS distinguishes organizations, services, locations, and the relationships between them. [HSDS overview](https://docs.openreferral.org/en/v3.3.1/hsds/overview.html), [schema reference](https://docs.openreferral.org/en/v3.3.1/hsds/schema_reference.html).

211 access is a separate permission decision. Its National Data Platform documents authenticated API access and authorized sharing by participating 211 organizations. A prospective data consumer must confirm access scope, permitted use, attribution, retention, and redistribution with the relevant data owner; a public directory page or API registration does not establish those rights. Do not register HumanAid as a 211 organization. [211 access overview](https://apiportal.211.org/get-started-overview), [API access process](https://register.211.org/Home/LogIntoApiPortal), [NDP FAQ](https://register.211.org/Home/FAQs).

HumanAid currently has no production 211 authorization. Trial data is not approved for production use. Before any live access or use, confirm source-specific permissions, attribution, retention, and redistribution terms with the data owner.

## Canonical directory entities

Use stable UUIDs for the proposed model. Maintain a reviewed crosswalk to current integer resource IDs so an eventual migration can preserve favorites, reports, URLs, and API clients. Do not replace those IDs during this sprint.

| Proposed table | Purpose and relationships | Mapping considerations |
| --- | --- | --- |
| `organizations` | The organization responsible for one or more services | Keep legal/display names, identifiers and organization contacts separate from a service description. |
| `services` | A particular type of help provided by an organization | Category, application process, status and eligibility can vary between services of the same organization. |
| `locations` | Physical or virtual places where help can be accessed | A shared address does not prove two organizations are identical. Preserve confidential-address restrictions. |
| `service_at_locations` | Many-to-many relationship between services and locations | Map to the HSDS `service_at_location` entity. Location-specific intake and accessibility information belongs to the relationship or a reviewed associated entity. |
| `service_areas` | Geographic coverage of a service or service-at-location | Distinguish where a service is offered from its street address. Preserve supported geometry/text and source precision. |
| `schedules` | Regular opening times, appointment windows and exceptions | Model holidays, recurrence and timezone explicitly. An unknown timezone remains unknown; do not silently assume local browser time. |
| `eligibility` | Internal structured criteria and original eligibility wording for a service | This is a HumanAid extension, not a claim of an HSDS table named `eligibility`. Export supported fields such as `eligibility_description`, minimum age and maximum age through the pinned mapping. |
| `required_documents` | Documents needed for a service/application | Preserve “required,” “recommended,” and “if applicable” distinctions; map to the supported HSDS required-document representation. |
| `phones` | Contact numbers with purpose, extension and language/access information | Link to the applicable organization, service or location through reviewed relationships; avoid merging a hotline with office administration. |
| `languages` | Languages available for the associated service, location or phone | Store standard language codes where provided. Distinguish direct service in a language from interpretation availability. |

Add the other structures required by a chosen export profile, such as addresses, contacts, taxonomy terms, accessibility, attributes and metadata, through explicit migrations later. Validate relationship constraints and allowed fields against the pinned schema. A field not supported by that version stays an internal extension or uses a permitted extension mechanism; it must not be silently presented as a standard HSDS field.

## Source, provenance and verification entities

| Proposed table | Required information and controls |
| --- | --- |
| `external_sources` | Stable source key/name; approved base endpoints; adapter and source-schema versions; data owner; permission/terms reference; attribution and redistribution rules; retention policy; rate budget; enabled state; secret reference **without its value**. |
| `external_source_records` | Source FK; external record ID and entity kind; immutable snapshot/version ID; nullable source last-modified timestamp; required HumanAid `fetched_at` in UTC; content hash; restricted raw-object reference; import batch; optional ETag/cursor; source deletion/tombstone status. Unique source/entity/external-ID/content-hash identity supports safe retries. |
| `field_provenance` | Canonical entity/field identifier; proposed or published value hash; source-record version FK; mapping/transform version; source last-modified and fetched timestamps; verification status; related verification-event IDs; human/provider verification timestamps; conflict/publication status and validity interval. Every imported field value must have lineage. |
| `verification_events` | Append-only event ID; entity/field scope and exact value/version checked; actor type (`human`, `provider`, `automated`); actor identity reference; method; observation and verification times; outcome; restricted evidence reference/hash; superseded event; provider-claim authority when applicable. |
| `provider_claims` | Organization FK; verified Firebase UID; claimed authority/scope; restricted evidence; pending/verified/rejected/disputed/revoked/expired status; reviewer; timestamps and expiry. Claim scope never confers global administrator rights. |

Use concrete foreign keys or a constrained entity registry for provenance references, rather than unchecked entity-type strings and arbitrary IDs. Store both original source values and normalized values with the transform version, so a mapping correction is reproducible. If a source supplies no modification timestamp, store `NULL`; the fetched timestamp must not fill that gap.

Raw snapshots belong in an isolated schema or access-controlled object store, accessible only to the importer and authorized reviewers. The public API, search index and AI navigator must not read raw payloads directly. They can contain personal contacts, restricted addresses or terms-limited data. Apply source-specific retention and deletion rules; immutable audit design does not override those obligations. Record deletion metadata without retaining prohibited content.

Directory data, provider identity evidence and future Referral Desk client/case information require separate access rules. A person's request for assistance must never become public directory provenance or be sent to a source API as an incidental matching query.

## Example lineage contract

The following is a synthetic internal representation, not an HSDS payload:

```json
{
  "entity_type": "service",
  "entity_id": "synthetic-service-id",
  "field": "eligibility_description",
  "source_system": "example_source",
  "source_record_id": "example-123",
  "source_record_version": "snapshot-2",
  "source_last_modified_at": null,
  "fetched_at": "2026-09-01T12:00:00Z",
  "verification_status": "unreviewed",
  "human_verified_at": null,
  "provider_verified_at": null,
  "mapping_version": "example-adapter-1"
}
```

The persisted IDs would use the agreed UUID/foreign-key types. A fact confirmed by a human/provider records the relevant verification event and timestamp. Changing its value later creates a new assertion requiring review; an old verification timestamp must not certify a different value. An automated successful HTTP response only demonstrates reachability at that time. HSDS service `assured_date` must follow the chosen validation policy, not simply the latest fetch date.

## Proposed ingestion and publication flow

1. **Authorize the source.** Record approved scope, source owner, endpoints, terms and credentials managed through Secret Manager. No live access begins before this review.
2. **Fetch privately.** A scheduled coordinator enqueues bounded work for a private worker. Use endpoint allowlists and the same SSRF controls as URL scanning, with bounded time, size, redirects and retries. Honor source rate limits and record cursors/checkpoints without logging keys or payloads.
3. **Preserve the snapshot.** Save a versioned raw record in the isolated layer, then acknowledge the task. Idempotency must cover retries between storing, mapping and acknowledgement. Retain the source's identifiers and distinguish deleted, unavailable and temporarily failing records.
4. **Validate and map.** Parse against the adapter's source schema; map into normalized candidate entities and field assertions. Reject/quarantine malformed relationships and unsupported fields. Record mapping version and source lineage for each imported value, including generated descriptions or other transformations.
5. **Match carefully.** Use stable source identifiers and reviewed crosswalks first. Names, shared phones or shared addresses are hints, not automatic proof. Queue uncertain merges/splits and keep their audit history reversible. One organization can legitimately have many services and locations.
6. **Resolve and verify.** Show original source values, existing HumanAid values, timestamps and conflicts to an authorized reviewer. Apply field-specific source authority rules. A newer fetch does not automatically overwrite a provider-confirmed value, a manual correction or a confidential field.
7. **Publish a version.** Write only approved canonical changes and their provenance in one transaction. Update derived search/export indexes after that transaction. Keep previous published versions for controlled rollback subject to retention rules.
8. **Recheck and retire.** Queue stale/conflicting facts for review. Treat source disappearance as evidence to investigate, not immediate deletion of a service still verified through another source. Alert on import failure and stale queues without making unverified records appear confirmed.

Possible statuses include `unreviewed`, `automated_check_only`, `human_verified`, `provider_verified`, `conflicting`, `stale` and `rejected`. These describe a specific fact/version and evidence policy; they are not a blanket accuracy guarantee for an organization. Define expiry by field: opening hours may need more frequent review than a legal name. Public “last checked” labels must explain what was checked.

## Provider claims and future automation

Provider claiming requires both a verified account identity and proof of authority over the organization. Matching an email domain or supplying a UID in the browser is insufficient. Use a reviewed verification process with scoped grants, expiry, revocation, dispute handling and an audit trail. Authorized providers may propose or confirm only facts within their scope; sensitive changes and conflicting claims need independent review. Never expose claim documents or reviewer notes in public exports.

A future verification agent may identify broken links, propose corrections and create evidence events. It must not label its work human-verified or grant provider authority. An AI navigator should use only approved directory versions, show supporting source/verification context, communicate stale or uncertain information, and avoid promising availability or eligibility. HumanAid Intelligence and Referral Desk require their own data-access and product designs; this proposal does not implement them.

## Staged delivery and acceptance gates

1. Agree on the HSDS version, ownership, field mapping and data-use permissions. Inventory current schema/data quality without changing production.
2. Add schema proposals and synthetic fixtures in isolated development. Establish source/provenance foreign keys and legacy-ID crosswalks before any data import.
3. Build adapter contract tests and a dry-run candidate report; no canonical writes. Test duplicates, source timestamp absence, schema drift, long payloads, rate limits, redirects, timeouts and partial batches.
4. Build reviewer diffs, conflict handling, publication and rollback with synthetic data. Test idempotent replay, concurrency, merge/split history, retained provenance, provider cross-organization isolation and revocation.
5. Validate example exports against the pinned HSDS JSON Schemas and relationships. Check that private evidence, raw payloads and unsupported extension fields cannot leak into export/search/AI contexts.
6. Only after explicit source authorization, test a limited real source in separately authorized staging with restricted retention. Compare records and provenance with the source and obtain reviewer acceptance.
7. Request a separate production integration/release decision with monitoring, rollback and ongoing data stewardship defined.

The initial Sprint 0 delivered this design; its local continuation adds only the offline skeleton linked above. No assertion of a live 211 integration, verified imported data, implemented provider claiming, or completed HSDS conformance is made.
