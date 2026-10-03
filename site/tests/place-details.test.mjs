import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlaceDetails, createQuotaMemory } from '../dist/place-search.js';
import { googlePlaceRecord } from '../dist/place-model.js';

const saved = { placeId: 'exact', name: 'Actual stadium', address: 'Real address', latitude: 34, longitude: -118 };
const place = (id = 'exact') => ({ id, displayName: 'Actual stadium', location: { lat: () => 34, lng: () => -118 }, editorialSummary: 'Actual Google description.', rating: 4.7, primaryTypeDisplayName: 'Stadium' });

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
  now = 61000; await assert.rejects(failed.load(saved), /Transient error/); assert.equal(calls, 3);
});

test('a mismatched Details record is rejected without replacing the saved location', async () => {
  const loader = createPlaceDetails({ fetch: async () => place('neighbor'), text: () => { throw new Error('Unexpected search'); }, record: googlePlaceRecord });
  await assert.rejects(loader.load(saved), /PLACE_DETAILS_MISMATCH/);
});


test('completed details expose ratings synchronously for newly rendered timeline rows until cache expiry', async () => {
  let now = 0, calls = 0;
  const loader = createPlaceDetails({ fetch: async () => { calls++; return place(); }, text: () => { throw new Error('Unexpected search'); }, record: googlePlaceRecord, now: () => now });
  assert.equal(loader.peek(saved.placeId), undefined);
  const first = loader.load(saved); assert.equal(loader.load(saved), first);
  await first;
  assert.equal(loader.peek(saved.placeId).rating, 4.7);
  await loader.load(saved); assert.equal(calls, 1);
  assert.equal(loader.peek('neighbor'), undefined);
  now = 300001; assert.equal(loader.peek(saved.placeId), undefined);
  await loader.load(saved); assert.equal(calls, 2);
});

test('twenty visible occurrences share one minimal rating request, then opened details load separately', async () => {
  const requested = [];
  const loader = createPlaceDetails({ fetch: async (id, fields) => { requested.push(fields); return place(id); }, text: () => { throw new Error('Unexpected search'); }, record: googlePlaceRecord });
  await Promise.all(Array.from({ length: 20 }, () => loader.load(saved, { compact: true })));
  assert.deepEqual(requested, [['id', 'rating', 'userRatingCount', 'primaryTypeDisplayName', 'primaryType', 'types']]);
  assert.equal(loader.peek('exact').rating, 4.7); assert.equal(loader.peek('exact').editorialSummary, undefined);
  assert.equal(loader.peek('exact').category, 'Stadium');
  await loader.load(saved); assert.equal(requested.length, 2); assert.ok(requested[1].includes('editorialSummary'));
  await loader.load(saved, { compact: true }); assert.equal(requested.length, 2);
});
test('an opened place request also satisfies simultaneous rating and contact views', async () => {
  let calls = 0;
  const loader = createPlaceDetails({ fetch: async () => { calls++; return place(); }, text: () => { throw new Error('Unexpected search'); }, record: googlePlaceRecord });
  const full = loader.load(saved);
  assert.equal(loader.load(saved, { compact: true }), full); assert.equal(loader.load(saved, { contactOnly: true }), full);
  await full; assert.equal(calls, 1);
});
test('guide contacts need one exact ID lookup without rich descriptions or photos', async () => {
  let fields, calls = 0;
  const loader = createPlaceDetails({ fetch: async (id, requested) => { calls++; fields = requested; return { ...place(id), websiteURI: 'https://example.com' }; }, text: () => { throw new Error('Unexpected search'); }, record: googlePlaceRecord });
  assert.equal((await loader.load(saved, { contactOnly: true })).websiteURI, 'https://example.com');
  await loader.load(saved, { compact: true }); assert.equal(calls, 1); assert.ok(fields.includes('websiteURI'));
  for (const name of ['photos', 'editorialSummary', 'generativeSummary', 'regularOpeningHours']) assert.ok(!fields.includes(name));
});
test('background ratings never launch fallback searches after a timeout or quota failure', async () => {
  for (const fetch of [() => new Promise(() => {}), () => { throw new Error('RESOURCE_EXHAUSTED'); }]) {
    let searches = 0;
    const loader = createPlaceDetails({ fetch, text: () => { searches++; return { places: [place()] }; }, timeoutMs: 5, record: googlePlaceRecord });
    await assert.rejects(loader.load(saved, { compact: true })); await assert.rejects(loader.load(saved, { compact: true })); assert.equal(searches, 0);
  }
});

test('a native map click can recover its real name with a minimal identity request when rich details are exhausted', async () => {
  const requested = [];
  const loader = createPlaceDetails({ fetch: async (id, fields) => {
    requested.push(fields);
    if (fields.includes('editorialSummary')) throw new Error('RESOURCE_EXHAUSTED');
    return { id, displayName: 'Actual stadium', formattedAddress: 'Real address', location: place().location };
  }, text: () => { throw new Error('Unexpected search'); }, record: googlePlaceRecord });
  await assert.rejects(loader.load({ placeId: 'exact' }), /UNAVAILABLE/);
  const identity = await loader.load({ placeId: 'exact' }, { identityOnly: true });
  assert.equal(identity.name, 'Actual stadium'); assert.equal(identity.placeId, 'exact');
  assert.equal(identity.latitude, 34); assert.equal(identity.rating, undefined);
  assert.deepEqual(requested[1], ['id', 'displayName', 'formattedAddress', 'location']);
  await loader.load({ placeId: 'exact' }, { identityOnly: true }); assert.equal(requested.length, 2);
});
test('exhausted map identity lookups stop retrying across places without starting broad searches', async () => {
  let calls = 0, searches = 0;
  const loader = createPlaceDetails({ fetch: () => { calls++; throw new Error('RESOURCE_EXHAUSTED'); }, text: () => { searches++; throw new Error('Unexpected search'); }, record: googlePlaceRecord });
  await assert.rejects(loader.load(saved, { identityOnly: true }));
  await assert.rejects(loader.load({ ...saved, placeId: 'next' }, { identityOnly: true }));
  assert.equal(calls, 1); assert.equal(searches, 0);
});
