'use strict';

const fixture = require('../../test/fixtures/ndp211-v2.synthetic.json');
const { createNdp211V2Adapter, dryRun, LIMITS } = require('../integrations/ndp211-v2');
const fetchedAt = '2026-09-27T12:00:00Z';
const copy = () => JSON.parse(JSON.stringify(fixture));
const run = batch => dryRun(JSON.stringify(batch), { fetchedAt });

describe('NDP 211 V2 offline integration contract', () => {
  test.each(['search', 'query', 'export', 'suggest', 'filters'])('%s fails closed without calling the network', async method => {
    const originalFetch = global.fetch;
    const fetch = jest.fn();
    global.fetch = fetch;
    try {
      const adapter = createNdp211V2Adapter({ enabled: true });
      expect(adapter.enabled).toBe(false);
      await expect(adapter[method]({})).rejects.toMatchObject({ code: 'LIVE_ACCESS_DISABLED' });
      expect(fetch).not.toHaveBeenCalled();
    } finally { global.fetch = originalFetch; }
  });

  test('creates bounded, immutable proposals with lineage for every field and relationship', () => {
    const report = run(fixture);
    expect(report).toMatchObject({ mode: 'offline-synthetic', publishable: false, persisted: false, input_count: 4, duplicate_count: 0 });
    expect(report.snapshots).toHaveLength(4);
    expect(report.candidates).toHaveLength(3);
    for (const candidate of report.candidates) {
      expect(candidate.canonical_id).toBeNull();
      expect(candidate.review_status).toBe('unreviewed');
      for (const fact of [...candidate.fields, ...candidate.relationships]) {
        expect(fact.provenance).toMatchObject({
          source_key: 'ndp211', source_api_version: 'v2', external_record_id: candidate.external_record_id,
          fetched_at: fetchedAt, verification_status: 'unreviewed', human_verified_at: null, provider_verified_at: null
        });
        expect(fact.provenance.source_record_version).toMatch(/^[a-f0-9]{64}$/);
        expect(Object.isFrozen(fact.provenance)).toBe(true);
      }
    }
    expect(() => { report.candidates[0].fields[0].value = 'changed'; }).toThrow(TypeError);
    expect(report.snapshots.every(snapshot => !Object.hasOwn(snapshot, 'raw'))).toBe(true);
  });

  test('keeps unknown source modification time separate from fetch time', () => {
    const service = run(fixture).candidates.find(candidate => candidate.entity_type === 'service');
    expect(service.fields.every(fact => fact.provenance.source_last_modified_at === null)).toBe(true);
    expect(service.relationships[0].provenance.source_last_modified_at).toBeNull();
  });

  test('retains deletion evidence for review without emitting deletion writes or field candidates', () => {
    const report = run(fixture);
    expect(report.tombstones).toHaveLength(1);
    expect(report.tombstones[0]).toMatchObject({ action: 'review_source_deletion', review_status: 'unreviewed' });
    expect(report.candidates.some(candidate => candidate.external_record_id === 'synthetic-retired-service')).toBe(false);
  });

  test('deduplicates identical source records and keeps replay identity stable across key order and fetch dates', () => {
    const batch = copy();
    batch.records.push({ ...batch.records[0], fields: { description: batch.records[0].fields.description, name: batch.records[0].fields.name } });
    const first = run(batch);
    const replay = dryRun(Buffer.from(JSON.stringify(batch)), { fetchedAt: '2026-09-28T12:00:00.000Z' });
    expect(first.duplicate_count).toBe(1);
    expect(first.snapshots).toHaveLength(4);
    expect(replay.snapshots.map(snapshot => snapshot.source_record_version)).toEqual(first.snapshots.map(snapshot => snapshot.source_record_version));
    expect(replay.snapshots[0].fetched_at).not.toBe(first.snapshots[0].fetched_at);
  });

  test('rejects conflicting duplicate versions atomically', () => {
    const batch = copy();
    batch.records.push({ ...batch.records[0], fields: { name: 'Different synthetic value' } });
    expect(() => run(batch)).toThrow(expect.objectContaining({ code: 'CONFLICTING_SOURCE_RECORD' }));
  });

  test('a value change produces a new version and remains unreviewed', () => {
    const batch = copy();
    const original = run(batch).snapshots[0].source_record_version;
    batch.records[0].fields.name = 'Changed synthetic name';
    const report = run(batch);
    expect(report.snapshots[0].source_record_version).not.toBe(original);
    expect(report.candidates[0].fields[0].provenance.verification_status).toBe('unreviewed');
  });

  test.each(['missing', 'deleted'])('rejects %s organization relationships', kind => {
    const batch = copy();
    if (kind === 'missing') batch.records.shift();
    else batch.records[0] = { ...batch.records[0], deleted: true, fields: {} };
    expect(() => run(batch)).toThrow(expect.objectContaining({ code: 'UNRESOLVED_RELATIONSHIP' }));
  });

  test.each([
    batch => { batch.unexpected = true; },
    batch => { batch.records[0].verified = true; },
    batch => { batch.records[0].fields.confidential_address = 'Synthetic private value'; },
    batch => { batch.records[1].relationships.arbitrary = 'Synthetic relationship'; },
    batch => { batch.records[0].fields.name = 'x'.repeat(LIMITS.maxFieldChars + 1); },
    batch => { batch.records[0].source_last_modified_at = '2026-02-30T00:00:00Z'; },
    batch => { batch.records[0].source_last_modified_at = fetchedAt.slice(0, -1); },
    batch => { delete batch.records[0].source_last_modified_at; },
    batch => { batch.records[0].id = '../invalid'; },
    batch => { batch.records[0].fields.name = ''; },
    batch => { batch.records[0].entity_type = '__proto__'; },
    batch => { batch.records[0].entity_type = { toString: null }; },
    batch => { batch.records = Array(LIMITS.maxRecords + 1).fill(batch.records[0]); }
  ])('rejects malformed or drifting contracts without publishing partial results (%#)', change => {
    const batch = copy();
    change(batch);
    expect(() => run(batch)).toThrow(expect.objectContaining({ code: 'INVALID_SYNTHETIC_CONTRACT' }));
  });

  test('rejects oversized bytes before JSON parsing and never reflects source payloads in errors', () => {
    expect(() => dryRun('x'.repeat(LIMITS.maxBytes + 1), { fetchedAt })).toThrow(expect.objectContaining({ code: 'BATCH_TOO_LARGE' }));
    const privateMarker = 'synthetic-private-marker';
    try { dryRun(`{${privateMarker}`, { fetchedAt }); } catch (error) {
      expect(error.code).toBe('INVALID_SYNTHETIC_CONTRACT');
      expect(error.message).not.toContain(privateMarker);
      return;
    }
    throw new Error('Malformed input should have failed.');
  });

  test('requires an explicit valid UTC fetch timestamp', () => {
    expect(() => dryRun(JSON.stringify(fixture))).toThrow(expect.objectContaining({ code: 'INVALID_SYNTHETIC_CONTRACT' }));
    expect(() => dryRun(JSON.stringify(fixture), { fetchedAt: 'not-a-date' })).toThrow();
  });
});
