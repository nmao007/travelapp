import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlacesService } from '../places-service.mjs';

function google(responses) {
  const calls = [];
  const request = async (url, init) => { calls.push({ url, init }); const next = responses.shift(); return { ok: next.status === 200, status: next.status, json: async () => next.body }; };
  return { calls, request };
}

test('destination autocomplete asks Google for regions and returns names with their region', async () => {
  const api = google([{ status: 200, body: { suggestions: [{ placePrediction: { placeId: 'ChIJkyoto0000', structuredFormat: { mainText: { text: 'Kyoto' }, secondaryText: { text: 'Japan' } } } }] } }]);
  const places = createPlacesService({ request: api.request });
  assert.deepEqual(await places.autocomplete({ input: ' Kyoto ', session: 's1' }, 'key', 'a'), [{ placeId: 'ChIJkyoto0000', name: 'Kyoto', detail: 'Japan' }]);
  const body = JSON.parse(api.calls[0].init.body);
  assert.deepEqual(body.includedPrimaryTypes, ['(regions)']);
  assert.equal(body.sessionToken, 's1');
  assert.equal(api.calls[0].init.headers['X-Goog-Api-Key'], 'key');
  // Repeated searches are served from the cache.
  await places.autocomplete({ input: 'kyoto' }, 'key', 'a');
  assert.equal(api.calls.length, 1);
});

test('place details return a mapped place, and bad input never reaches Google', async () => {
  const api = google([{ status: 200, body: { id: 'ChIJkyoto0000', displayName: { text: 'Kyoto' }, formattedAddress: 'Kyoto, Japan', location: { latitude: 35.01, longitude: 135.77 }, types: ['locality'] } }]);
  const places = createPlacesService({ request: api.request });
  const place = await places.details({ id: 'ChIJkyoto0000' }, 'key', 'a');
  assert.equal(place.name, 'Kyoto'); assert.equal(place.latitude, 35.01);
  assert.match(api.calls[0].init.headers['X-Goog-FieldMask'], /location/);
  await assert.rejects(places.details({ id: '../secrets' }, 'key', 'a'), { status: 400 });
  await assert.rejects(places.autocomplete({ input: '' }, 'key', 'a'), { status: 400 });
  await assert.rejects(places.autocomplete({ input: 'x' }, null, 'a'), { status: 503 });
  assert.equal(api.calls.length, 1);
});

test('each address is limited per minute', async () => {
  let clock = 0;
  const api = google(Array.from({ length: 5 }, (_, i) => ({ status: 200, body: { suggestions: [] } })));
  const places = createPlacesService({ request: api.request, now: () => clock, perMinute: 2 });
  await places.autocomplete({ input: 'a' }, 'key', 'ip1');
  await places.autocomplete({ input: 'b' }, 'key', 'ip1');
  await assert.rejects(places.autocomplete({ input: 'c' }, 'key', 'ip1'), { status: 429 });
  await places.autocomplete({ input: 'c' }, 'key', 'ip2');
  clock = 61_000;
  await places.autocomplete({ input: 'd' }, 'key', 'ip1');
});
