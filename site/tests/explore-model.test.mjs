import test from 'node:test';
import assert from 'node:assert/strict';
import { viewportSearchArea, inSearchArea, distanceMeters } from '../dist/explore-model.js';

test('area searches follow viewport size and position rather than a fixed city radius', () => {
  const city = viewportSearchArea({ north: 34.75, south: 34.65, east: 135.56, west: 135.44 });
  const street = viewportSearchArea({ north: 34.672, south: 34.666, east: 135.507, west: 135.499 });
  assert.ok(street.radius < city.radius / 10);
  assert.ok(street.radius < 600);
  assert.notEqual(city.key, street.key);
  assert.ok(inSearchArea(street, { lat: 34.67, lng: 135.502 }));
  assert.equal(inSearchArea(street, { lat: 34.7, lng: 135.5 }), false);
  for (const lat of [street.rectangle.north, street.rectangle.south]) for (const lng of [street.rectangle.east, street.rectangle.west]) assert.ok(distanceMeters(street.center, { lat, lng }) <= street.radius);
});
test('zoom changes and small pans cannot reuse a search for different map bounds', () => {
  const bounds = { north: 40.71, south: 40.7, west: -74.01, east: -74 };
  assert.notEqual(viewportSearchArea(bounds).key, viewportSearchArea({ ...bounds, east: -73.999 }).key);
  assert.notEqual(viewportSearchArea(bounds).key, viewportSearchArea({ ...bounds, south: 40.699 }).key);
  assert.equal(viewportSearchArea(null), null);
  assert.equal(viewportSearchArea({ ...bounds, north: NaN }), null);
  assert.equal(viewportSearchArea({ ...bounds, south: 41 }), null);
});
test('viewport search handles the date line and respects the Google 50 km limit', () => {
  const area = viewportSearchArea({ north: -16, south: -17, west: 179.8, east: -179.8 });
  assert.ok(inSearchArea(area, { lat: -16.5, lng: 179.9 }));
  assert.ok(inSearchArea(area, { lat: -16.5, lng: -179.9 }));
  assert.equal(inSearchArea(area, { lat: -16.5, lng: 0 }), false);
  assert.equal(area.radius, 50000);
});
