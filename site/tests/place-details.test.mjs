import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlaceDetails, createQuotaMemory } from '../dist/place-search.js';
import { googlePlaceRecord } from '../dist/place-model.js';

const saved = { placeId: 'exact', name: 'Actual stadium', address: 'Real address', latitude: 34, longitude: -118 };
const place = (id = 'exact') => ({ id, displayName: 'Actual stadium', location: { lat: () => 34, lng: () => -118 }, editorialSummary: 'Actual Google description.', rating: 4.7 });

test('opened place details request Google summaries once and coalesce repeated views', async () => {
  let calls = 0, fields;
  const loader = createPlaceDetails({ fetch: async (id, requested) => { calls++; fields = requested; return place(id); }, text: () => { throw new Error('Unexpected search'); }, record: googlePlaceRecord });
  const first = loader.load(saved);
  assert.equal(loader.load(saved), first);
  assert.equal((await first).editorialSummary, 'Actual Google description.');
  assert.equal((await loader.load(saved)).rating, 4.7);
  assert.equal(calls, 1); assert.ok(fields.includes('editorialSummary')); assert.ok(fields.includes('generativeSummary'));
});

test('limited Details uses one Google search and requires the exact ID instead of a nearby match', async () => {
  let details = 0, searches = 0, request;
  const loader = createPlaceDetails({ fetch: () => { details++; throw new Error('RESOURCE_EXHAUSTED quota exceeded'); }, text: async input => { searches++; request = input; return { places: [place('neighbor'), place()] }; }, record: googlePlaceRecord });
  assert.equal((await loader.load(saved)).placeId, 'exact');
  assert.equal((await loader.load(saved)).editorialSummary, 'Actual Google description.');
  assert.equal(details, 1); assert.equal(searches, 1);
  assert.deepEqual(request.locationBias.center, { lat: 34, lng: -118 });
  assert.ok(request.fields.includes('editorialSummary')); assert.equal(request.language, 'en');
  const wrong = createPlaceDetails({ fetch: () => { throw new Error('OVER_QUERY_LIMIT'); }, text: async () => ({ places: [place('neighbor')] }), record: googlePlaceRecord });
  await assert.rejects(wrong.load(saved), /PLACE_DETAILS_UNAVAILABLE/);
});

test('both exhausted endpoints cool down across places and reloads rather than consuming more quota', async () => {
  const values = new Map(), storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  const quotaMemory = createQuotaMemory(storage);
  let details = 0, searches = 0;
  const setup = () => createPlaceDetails({ fetch: () => { details++; throw new Error('RESOURCE_EXHAUSTED'); }, text: () => { searches++; throw new Error('RESOURCE_EXHAUSTED'); }, record: googlePlaceRecord, quotaMemory });
  const loader = setup();
  await assert.rejects(loader.load(saved), /PLACE_DETAILS_QUOTA/);
  await assert.rejects(loader.load({ ...saved, placeId: 'another' }), /PLACE_DETAILS_QUOTA/);
  await assert.rejects(setup().load(saved), /PLACE_DETAILS_QUOTA/);
  assert.equal(details, 1); assert.equal(searches, 1);
});

test('a stalled request can recover through search and a failed place can retry after a short cooldown', async () => {
  let now = 0, calls = 0;
  const loader = createPlaceDetails({ fetch: () => { calls++; return new Promise(() => {}); }, text: async () => ({ places: [place()] }), record: googlePlaceRecord, timeoutMs: 5, now: () => now });
  assert.equal((await loader.load(saved)).editorialSummary, 'Actual Google description.');
  assert.equal(calls, 1);
  const failed = createPlaceDetails({ fetch: async () => { calls++; throw new Error('Transient error'); }, text: () => { throw new Error('Unexpected search'); }, record: googlePlaceRecord, now: () => now });
  await assert.rejects(failed.load(saved), /Transient error/);
  await assert.rejects(failed.load(saved), /Transient error/);
  assert.equal(calls, 2);
  now = 31000; await assert.rejects(failed.load(saved), /Transient error/); assert.equal(calls, 3);
});

test('a mismatched Details record is rejected without replacing the saved location', async () => {
  const loader = createPlaceDetails({ fetch: async () => place('neighbor'), text: () => { throw new Error('Unexpected search'); }, record: googlePlaceRecord });
  await assert.rejects(loader.load(saved), /PLACE_DETAILS_MISMATCH/);
});
