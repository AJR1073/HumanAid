'use strict';

// Offline foundation only. This schema is a HumanAid test envelope, NOT an NDP
// response or HSDS payload. No credentials, networking, persistence or routes.
const { createHash } = require('node:crypto');

const SOURCE_KEY = 'ndp211';
const FORMAT = 'humanaid.ndp211-v2.synthetic.v1';
const MAPPING_VERSION = 'ndp211-v2-synthetic-0';
const LIMITS = Object.freeze({ maxBytes: 256 * 1024, maxRecords: 100, maxFieldChars: 10000 });
const FIELDS = Object.freeze({
  organization: ['name', 'description'],
  service: ['name', 'description', 'eligibility_description', 'application_process'],
  location: ['name', 'description']
});

class Ndp211Error extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'Ndp211Error';
    this.code = code;
  }
}

function invalid() {
  return new Ndp211Error('INVALID_SYNTHETIC_CONTRACT', 'Invalid HumanAid synthetic 211 document.');
}

function exactKeys(value, allowed, required = allowed) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => !allowed.includes(key)) ||
      required.some(key => !Object.hasOwn(value, key))) throw invalid();
}

function validTimestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return false;
  const date = new Date(value);
  const normalized = value.includes('.') ? value : value.replace(/Z$/, '.000Z');
  return !Number.isNaN(date.getTime()) && date.toISOString() === normalized;
}

function validId(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,199}$/.test(value);
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function digest(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

function validateRecord(record) {
  exactKeys(record, ['id', 'entity_type', 'source_last_modified_at', 'deleted', 'fields', 'relationships']);
  if (!validId(record.id) || typeof record.entity_type !== 'string' || !Object.hasOwn(FIELDS, record.entity_type) ||
      typeof record.deleted !== 'boolean' ||
      (record.source_last_modified_at !== null && !validTimestamp(record.source_last_modified_at))) throw invalid();
  exactKeys(record.fields, FIELDS[record.entity_type], record.deleted ? [] : ['name']);
  for (const value of Object.values(record.fields)) {
    if (typeof value !== 'string' || !value.trim() || value.length > LIMITS.maxFieldChars) throw invalid();
  }
  const relationshipKeys = !record.deleted && record.entity_type !== 'organization' ? ['organization_id'] : [];
  exactKeys(record.relationships, relationshipKeys);
  if (relationshipKeys.length && !validId(record.relationships.organization_id)) throw invalid();
  if (record.deleted && Object.keys(record.fields).length) throw invalid();
}

/**
 * Validate a bounded synthetic batch and return immutable, unreviewed proposals.
 * fetchedAt is supplied by the caller; it NEVER fills a missing source timestamp.
 * No partial report is returned when any record or relationship is invalid.
 */
function dryRun(document, { fetchedAt } = {}) {
  if ((typeof document !== 'string' && !Buffer.isBuffer(document)) || !validTimestamp(fetchedAt)) throw invalid();
  if (Buffer.byteLength(document) > LIMITS.maxBytes) {
    throw new Ndp211Error('BATCH_TOO_LARGE', 'Synthetic 211 batch exceeds the offline byte limit.');
  }
  let batch;
  try { batch = JSON.parse(document.toString()); } catch { throw invalid(); }
  exactKeys(batch, ['format', 'records']);
  if (batch.format !== FORMAT || !Array.isArray(batch.records) || batch.records.length > LIMITS.maxRecords) throw invalid();

  const records = new Map();
  let duplicateCount = 0;
  for (const record of batch.records) {
    validateRecord(record);
    const key = `${record.entity_type}:${record.id}`;
    const hash = digest(record);
    if (records.has(key)) {
      if (records.get(key).hash !== hash) {
        throw new Ndp211Error('CONFLICTING_SOURCE_RECORD', 'Conflicting source versions require separate review.');
      }
      duplicateCount++;
    } else records.set(key, { record, hash });
  }
  for (const { record } of records.values()) {
    if (!record.deleted && record.entity_type !== 'organization') {
      const organization = records.get(`organization:${record.relationships.organization_id}`);
      if (!organization || organization.record.deleted) {
        throw new Ndp211Error('UNRESOLVED_RELATIONSHIP', 'Synthetic batch contains an unresolved organization relationship.');
      }
    }
  }

  const snapshots = [];
  const candidates = [];
  const tombstones = [];
  for (const { record, hash } of records.values()) {
    const lineage = {
      source_key: SOURCE_KEY,
      source_api_version: 'v2',
      source_schema_version: FORMAT,
      mapping_version: MAPPING_VERSION,
      entity_type: record.entity_type,
      external_record_id: record.id,
      source_record_version: digest([SOURCE_KEY, record.entity_type, record.id, hash]),
      content_sha256: hash,
      source_last_modified_at: record.source_last_modified_at,
      fetched_at: fetchedAt
    };
    // Metadata only: source payloads must eventually use restricted storage.
    snapshots.push({ ...lineage, deleted: record.deleted, persisted: false });
    if (record.deleted) {
      tombstones.push({ ...lineage, review_status: 'unreviewed', action: 'review_source_deletion' });
      continue;
    }
    candidates.push({
      entity_type: record.entity_type,
      external_record_id: record.id,
      canonical_id: null,
      review_status: 'unreviewed',
      fields: Object.entries(record.fields).map(([field, value]) => ({
        field, value, provenance: { ...lineage, verification_status: 'unreviewed', human_verified_at: null, provider_verified_at: null }
      })),
      relationships: Object.entries(record.relationships).map(([field, externalId]) => ({
        field,
        target: { source_key: SOURCE_KEY, entity_type: 'organization', external_record_id: externalId },
        provenance: { ...lineage, verification_status: 'unreviewed', human_verified_at: null, provider_verified_at: null }
      }))
    });
  }
  return freeze({
    source_key: SOURCE_KEY,
    mode: 'offline-synthetic',
    publishable: false,
    persisted: false,
    input_count: batch.records.length,
    duplicate_count: duplicateCount,
    snapshots,
    candidates,
    tombstones
  });
}

async function liveAccessDisabled() {
  throw new Ndp211Error('LIVE_ACCESS_DISABLED', 'NDP 211 V2 live access is not implemented or authorized by this skeleton.');
}

function createNdp211V2Adapter() {
  return Object.freeze({
    sourceKey: SOURCE_KEY,
    apiVersion: 'v2',
    enabled: false,
    mode: 'offline-synthetic',
    dryRun,
    search: liveAccessDisabled,
    query: liveAccessDisabled,
    export: liveAccessDisabled,
    suggest: liveAccessDisabled,
    filters: liveAccessDisabled
  });
}

module.exports = { Ndp211Error, FORMAT, MAPPING_VERSION, LIMITS, createNdp211V2Adapter, dryRun };
