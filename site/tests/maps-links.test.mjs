import test from 'node:test';
import assert from 'node:assert/strict';
import { placeMapsURL, mapViewURL, directionsMapsURL } from '../dist/maps-links.js';
const place = { name: 'Café & Tours #1', address: 'Lisbon, Portugal', placeId: 'ChIJ-1', latitude: 38.72, longitude: -9.14 };
test('Maps links preserve exact Google place identity and encode names safely', () => {
  const url = new URL(placeMapsURL(place));
  assert.equal(url.origin, 'https://www.google.com');
  assert.equal(url.searchParams.get('api'), '1');
  assert.equal(url.searchParams.get('query'), 'Café & Tours #1, Lisbon, Portugal');
  assert.equal(url.searchParams.get('query_place_id'), place.placeId);
  assert.equal(url.hash, ''); assert.equal(url.searchParams.has('key'), false);
  assert.equal(placeMapsURL({}), null);
  assert.equal(new URL(placeMapsURL({ name: 'Group dinner', latitude: 38.72, longitude: -9.14 })).searchParams.get('query'), '38.72,-9.14');
  assert.equal(new URL(placeMapsURL({ latitude: 90, longitude: 180 })).searchParams.get('query'), '90,180');
});
test('Map handoff follows current viewport coordinates and bounded zoom', () => {
  const url = new URL(mapViewURL(place, 16.4));
  assert.equal(url.searchParams.get('map_action'), 'map');
  assert.equal(url.searchParams.get('center'), '38.72,-9.14');
  assert.equal(url.searchParams.get('zoom'), '16');
  assert.equal(new URL(mapViewURL(place, 0)).searchParams.get('zoom'), '0');
  assert.equal(new URL(mapViewURL(place, 40)).searchParams.get('zoom'), '21');
  assert.equal(new URL(mapViewURL({ name: 'Paris', latitude: 100, longitude: 200 })).pathname, '/maps/search/');
});
test('Directions handoff preserves both places and the selected mode without requesting user GPS', () => {
  const url = new URL(directionsMapsURL(place, { name: 'Hotel', placeId: 'hotel' }, 'TRANSIT'));
  assert.equal(url.pathname, '/maps/dir/'); assert.equal(url.searchParams.get('origin_place_id'), 'hotel');
  assert.equal(url.searchParams.get('destination_place_id'), place.placeId);
  assert.equal(url.searchParams.get('travelmode'), 'transit');
  assert.equal(new URL(directionsMapsURL(place)).searchParams.has('origin'), false);
  assert.equal(directionsMapsURL({}), null);
});
