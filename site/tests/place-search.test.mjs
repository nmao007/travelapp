import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlaceSearch, createSearchSelection, topMapPlaces, placeIcon, clickedPlaceArea } from '../dist/place-search.js';
import { viewportSearchArea } from '../dist/explore-model.js';
import { mapEntries, googlePlaceRecord } from '../dist/place-model.js';
const area = viewportSearchArea({ north: 38.74, south: 38.70, east: -9.10, west: -9.18 });
const place = (id, rating = 4.7, ratingCount = 200, extra = {}) => ({ placeId: id, name: id, latitude: 38.72, longitude: -9.14, rating, ratingCount, businessStatus: 'OPERATIONAL', ...extra });
const record = value => value;

test('Nearby quota failure uses Text Search for every category without repeatedly hitting the exhausted endpoint', async () => {
  let nearbyCalls = 0; const textCalls = [];
  const service = createPlaceSearch({ record, concurrency: 1, nearby: async () => { nearbyCalls++; throw new Error('RESOURCE_EXHAUSTED: SearchNearbyRequest per day'); }, text: async request => { textCalls.push(request); return { places: [place(request.textQuery)] }; } });
  assert.equal((await service.search('see', area))[0].name, 'tourist attractions');
  assert.equal((await service.search('eat', area))[0].name, 'restaurants and cafes');
  assert.equal(nearbyCalls, 1); assert.equal(textCalls.length, 2);
  assert.deepEqual(textCalls[0].locationRestriction, { north: area.rectangle.north, south: area.rectangle.south, east: area.rectangle.east, west: area.rectangle.west });
  assert.equal(service.find('tourist attractions').placeId, 'tourist attractions');
});

test('Repeated searches coalesce and cache while a forced or expired search gets fresh data', async () => {
  let clock = 0, calls = 0, finish;
  const service = createPlaceSearch({ record, now: () => clock, nearby: () => { calls++; return new Promise(resolve => { finish = resolve; }); }, text: async () => ({ places: [] }) });
  const first = service.search('see', area), duplicate = service.search('see', area, { force: true });
  assert.equal(first, duplicate); await Promise.resolve(); await Promise.resolve(); finish({ places: [place('castle')] }); await first;
  await service.search('see', area); assert.equal(calls, 1);
  clock = 300001; const expired = service.search('see', area); await Promise.resolve(); await Promise.resolve(); finish({ places: [] }); await expired; assert.equal(calls, 2);
});

test('Failed Google searches reject explicitly and use a circuit breaker rather than leaving the old category frozen', async () => {
  let calls = 0;
  const fail = async () => { calls++; throw new Error('RESOURCE_EXHAUSTED: quota exceeded'); };
  const service = createPlaceSearch({ record, concurrency: 1, nearby: fail, text: fail });
  await assert.rejects(service.search('see', area), /PLACE_SEARCH_LIMIT/);
  await assert.rejects(service.search('tour', area), /PLACE_SEARCH_LIMIT/);
  assert.equal(calls, 2);
});

test('A hung provider cannot leave loading indefinitely or prevent another category from completing', async () => {
  let calls = 0;
  const service = createPlaceSearch({ record, timeoutMs: 5, concurrency: 1, nearby: () => new Promise(() => {}), text: async request => { calls++; return { places: [place(request.textQuery)] }; } });
  await service.search('see', area); await service.search('stay', area); assert.equal(calls, 2);
});

test('Requests are bounded, viewport-clipped, and a bad individual place cannot discard good results', async () => {
  let active = 0, maximum = 0;
  const service = createPlaceSearch({ record: value => { if (value.bad) throw new Error('Bad place'); return value; }, nearby: async () => { active++; maximum = Math.max(maximum, active); await new Promise(resolve => setTimeout(resolve, 2)); active--; return { places: [place('good'), place('outside', 4.9, 500, { latitude: 40 }), { bad: true }] }; }, text: async () => ({ places: [] }), concurrency: 2 });
  const results = await Promise.all(['see', 'eat', 'stay', 'nature', 'culture'].map(category => service.search(category, area)));
  assert.equal(maximum, 2); assert.ok(results.every(result => result.length === 1 && result[0].placeId === 'good'));
});

test('An older filter, failed request, or trip cannot overwrite the current selection', () => {
  const selection = createSearchSelection();
  const tours = selection.begin('trip-1', 'tour', 'area-1'), sights = selection.begin('trip-1', 'see', 'area-1');
  assert.equal(selection.current(tours), false); assert.equal(selection.current(sights), true);
  selection.invalidate(); assert.equal(selection.current(sights), false);
  const another = selection.begin('trip-2', 'eat', 'area-2'); assert.equal(selection.current(another), true);
});

test('Mixed map recommendations retain category variety, exclude unreviewed/closed places, and never erase itinerary pins', () => {
  const recommendations = topMapPlaces([
    [place('museum', 4.8), place('tiny', 5, 1), place('closed', 4.9, 500, { businessStatus: 'CLOSED_PERMANENTLY' }), place('low', 4.2)],
    [place('cafe', 4.9), place('museum', 4.8)], [place('hotel', 4.7)], [place('park', 4.6)],
  ], { perGroup: 1 });
  assert.deepEqual(recommendations.map(place => place.placeId), ['museum', 'cafe', 'hotel', 'park']);
  const entries = mapEntries([place('low', 3.2, 100, { id: 'plan' })], recommendations);
  assert.equal(entries[0].planned, true); assert.equal(entries[0].placeId, 'low');
  assert.equal(mapEntries([place('cafe', 3.9, 50, { id: 'booked' })], recommendations).filter(place => place.placeId === 'cafe').length, 1);
});

test('Map categories use actual SVG icons, including saved events without Google metadata', () => {
  for (const [primaryType, icon] of [['cafe','food'], ['coffee_shop','food'], ['hotel','stay'], ['museum','landmark'], ['shrine','landmark'], ['park','leaf'], ['amusement_park','landmark'], ['tour_agency','guide']]) assert.equal(placeIcon({ primaryType }), icon);
  assert.equal(placeIcon({ kind: 'Stay' }), 'stay'); assert.equal(placeIcon({ kind: 'Food' }), 'food'); assert.equal(placeIcon({ kind: 'Tour' }), 'guide');
});

test('Google records tolerate unavailable optional fields and preserve usable map coordinates', () => {
  const value = { id: 'real', displayName: 'Actual place', location: { lat: () => 38.72, lng: () => -9.14 }, get websiteURI() { throw new Error('Field not requested'); } };
  const result = googlePlaceRecord(value); assert.equal(result.placeId, 'real'); assert.equal(result.websiteURI, ''); assert.equal(result.latitude, 38.72);
});

test('Clicked native places recover through a tightly bounded search and require an exact Google place ID', async () => {
  let nearbyCalls = 0, textCalls = 0;
  const service = createPlaceSearch({ record, nearby: async () => { nearbyCalls++; return { places: [] }; }, text: async request => { textCalls++; assert.equal(request.textQuery, 'places'); assert.ok(request.locationRestriction.north - request.locationRestriction.south < .002); return { places: [place('neighbor'), place('clicked')] }; } });
  const point = { lat: 38.72, lng: -9.14 };
  assert.equal((await service.findAt('clicked', point)).placeId, 'clicked');
  assert.equal(await service.findAt('missing', point), null);
  assert.equal((await service.findAt('clicked', point)).placeId, 'clicked');
  assert.equal(textCalls, 1); assert.equal(nearbyCalls, 0);
  assert.equal(clickedPlaceArea({ lat: NaN, lng: 0 }), null);
  assert.ok(clickedPlaceArea({ lat: 0, lng: 180 }).rectangle.west > clickedPlaceArea({ lat: 0, lng: 180 }).rectangle.east);
});

test('mixed map recommendations use one provider request and keep rated category icons', async () => {
  const { mixedMapPlaces } = await import('../dist/place-search.js');
  let calls = 0;
  const service = createPlaceSearch({ record, nearby: async request => {
    calls++;
    for (const type of ['tourist_attraction', 'restaurant', 'hotel', 'park', 'tour_agency']) assert.ok(request.includedTypes.includes(type));
    return { places: [place('castle', 4.8, 200, { primaryType: 'tourist_attraction' }), place('cafe', 4.6, 200, { primaryType: 'cafe' }), place('hotel', 4.7, 200, { primaryType: 'hotel' }), place('park', 4.9, 200, { primaryType: 'park' }), place('guide', 4.8, 200, { primaryType: 'tour_agency' }), place('unreviewed', 5, 1)] };
  }, text: async () => { throw new Error('Unexpected fallback'); } });
  const result = await service.search('mixed', area);
  const mapped = mixedMapPlaces(result);
  assert.equal(calls, 1);
  assert.deepEqual(new Set(mapped.map(placeIcon)), new Set(['landmark', 'food', 'stay', 'leaf', 'guide']));
  assert.ok(!mapped.some(value => value.placeId === 'unreviewed'));
  await service.search('mixed', area); assert.equal(calls, 1);
});

test('minor viewport drift reuses the loaded search while deliberate navigation makes a new request', async () => {
  const { createSearchAreaTracker } = await import('../dist/explore-model.js');
  const tracker = createSearchAreaTracker(), bounds = { north: 38.74, south: 38.70, east: -9.10, west: -9.18 };
  let calls = 0;
  const service = createPlaceSearch({ record, nearby: async () => { calls++; return { places: [] }; }, text: async () => { throw new Error('Unexpected fallback'); } });
  await service.search('mixed', tracker.read(bounds));
  await service.search('mixed', tracker.read({ ...bounds, north: bounds.north + .0001, south: bounds.south + .0001 }));
  await service.search('mixed', tracker.read({ ...bounds, north: bounds.north + .001, south: bounds.south - .001 }));
  assert.equal(calls, 1);
  await service.search('mixed', tracker.read({ ...bounds, north: 38.80, south: 38.76 })); assert.equal(calls, 2);
  await service.search('mixed', tracker.read({ ...bounds, north: 38.725, south: 38.715, east: -9.13, west: -9.15 })); assert.equal(calls, 3);
  tracker.reset(); assert.equal(tracker.read(bounds).key, area.key);
});

test('reloading preserves quota retry deadlines without storing Google place content', async () => {
  const { createQuotaMemory } = await import('../dist/place-search.js');
  const values = new Map(), storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  let clock = 1000, calls = 0;
  const memory = createQuotaMemory(storage, () => clock);
  const fail = async () => { calls++; throw new Error('RESOURCE_EXHAUSTED'); };
  const make = () => createPlaceSearch({ record, nearby: fail, text: fail, now: () => clock, quotaMemory: memory });
  await assert.rejects(make().search('mixed', area), /PLACE_SEARCH_LIMIT/); assert.equal(calls, 2);
  await assert.rejects(make().search('eat', area), /PLACE_SEARCH_LIMIT/); assert.equal(calls, 2);
  assert.equal(values.size, 2); assert.ok([...values.values()].every(value => /^\d+$/.test(value)));
  clock += 30 * 60000 + 1;
  await assert.rejects(make().search('mixed', area), /PLACE_SEARCH_LIMIT/); assert.equal(calls, 4);
  const denied = createQuotaMemory({ getItem() { throw new Error(); }, setItem() { throw new Error(); } }, () => clock);
  assert.equal(denied.read('text'), 0); assert.equal(denied.block('text'), clock + 30 * 60000);
});

test('repeated Search this area clicks cannot recharge the same area within a minute', async () => {
  let clock = 0, calls = 0;
  const service = createPlaceSearch({ record, now: () => clock, nearby: async () => { calls++; return { places: [place('castle')] }; }, text: () => { throw new Error('Unexpected search'); } });
  await service.search('see', area);
  for (let i = 0; i < 20; i++) await service.search('see', area, { force: true });
  assert.equal(calls, 1); clock = 60001; await service.search('see', area, { force: true }); assert.equal(calls, 2);
});
test('obsolete queued filter changes are discarded before reaching Google', async () => {
  const calls = []; let finish, current = true;
  const service = createPlaceSearch({ record, concurrency: 1, nearby: request => { calls.push(request.includedTypes || request.includedPrimaryTypes); if (calls.length === 1) return new Promise(resolve => { finish = resolve; }); return Promise.resolve({ places: [] }); }, text: () => { throw new Error('Unexpected fallback'); } });
  const running = service.search('see', area);
  const obsolete = assert.rejects(service.search('stay', area, { isCurrent: () => current }), /SUPERSEDED/);
  const next = service.search('eat', area);
  current = false; await new Promise(resolve => setImmediate(resolve)); finish({ places: [] });
  await Promise.all([running, obsolete, next]); assert.equal(calls.length, 2); assert.ok(!calls.some(types => types.includes('hotel')));
});
test('a current coalesced caller keeps a shared queued request alive', async () => {
  let finish, calls = 0;
  const service = createPlaceSearch({ record, concurrency: 1, nearby: () => { calls++; return calls === 1 ? new Promise(resolve => { finish = resolve; }) : Promise.resolve({ places: [] }); }, text: () => { throw new Error('Unexpected fallback'); } });
  const running = service.search('see', area), stale = service.search('eat', area, { isCurrent: () => false });
  assert.equal(service.search('eat', area, { isCurrent: () => true }), stale);
  await new Promise(resolve => setImmediate(resolve)); finish({ places: [] });
  await Promise.all([running, stale]); assert.equal(calls, 2);
});

test('small neighborhood pans reuse results, but moving beyond the loaded area refreshes', async () => {
  const { createSearchAreaTracker } = await import('../dist/explore-model.js');
  const tracker = createSearchAreaTracker(), bounds = { north: 38.74, south: 38.70, east: -9.10, west: -9.18 };
  let calls = 0;
  const service = createPlaceSearch({ record, nearby: async () => { calls++; return { places: [] }; }, text: () => { throw new Error('Unexpected fallback'); } });
  await service.search('mixed', tracker.read(bounds));
  await service.search('mixed', tracker.read({ ...bounds, north: bounds.north + .007, south: bounds.south + .007 }));
  assert.equal(calls, 1);
  await service.search('mixed', tracker.read({ ...bounds, north: bounds.north + .02, south: bounds.south + .02 }));
  assert.equal(calls, 2);
});
