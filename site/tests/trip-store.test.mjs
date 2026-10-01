import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, readTrips, saveTrip, deleteTrip, addPlace, movePlace, removePlace, addStop, moveStop, removeStop, tripStops, tripTitle, renameTrip } from '../dist/trip-store.js';

function memory() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values };
}

const lisbon = { id: 'a', placeId: 'google-place-a', name: 'Lisbon', latitude: 38.7223, longitude: -9.1393, startDate: null, endDate: null };

test('a selected real place is saved and reopened without duplication', () => {
  const storage = memory();
  saveTrip(lisbon, storage);
  assert.deepEqual(readTrips(storage), [{ ...lisbon, stops: tripStops(lisbon), items: [] }]);
  saveTrip({ ...lisbon, startDate: '2026-10-10', endDate: '2026-10-13' }, storage);
  assert.equal(readTrips(storage).length, 1);
  assert.equal(readTrips(storage)[0].startDate, '2026-10-10');
});

test('invalid or corrupt local records cannot become trips', () => {
  const storage = memory();
  assert.throws(() => saveTrip({ ...lisbon, latitude: Number.NaN }, storage));
  storage.setItem(STORAGE_KEY, '{broken');
  assert.deepEqual(readTrips(storage), []);
  storage.setItem(STORAGE_KEY, JSON.stringify([{ name: 'Imaginary' }, lisbon]));
  assert.deepEqual(readTrips(storage), [{ ...lisbon, stops: tripStops(lisbon), items: [] }]);
});

test('a multi-stop route can be edited without losing its places', () => {
  const storage = memory();
  const porto = { placeId: 'google-place-porto', name: 'Porto', latitude: 41.1579, longitude: -8.6291, address: 'Porto, Portugal' };
  const withStop = addStop(lisbon, porto);
  assert.equal(tripStops(withStop).length, 2);
  assert.equal(addStop(withStop, porto), withStop);
  const reordered = moveStop(withStop, 1, -1);
  assert.equal(reordered.name, 'Porto');
  saveTrip(reordered, storage);
  assert.deepEqual(readTrips(storage)[0].stops.map(stop => stop.name), ['Porto', 'Lisbon']);
  assert.equal(removeStop(reordered, porto.placeId).name, 'Lisbon');
  assert.throws(() => removeStop(lisbon, lisbon.placeId));
});

test('a real place can move from saved ideas to a day and be removed', () => {
  const storage = memory();
  const place = { placeId: 'google-place-b', name: 'Belém Tower', latitude: 38.6916, longitude: -9.2160, day: 'ideas' };
  const withPlace = addPlace(lisbon, place);
  assert.equal(addPlace(withPlace, place).items.length, 1);
  const moved = movePlace(withPlace, withPlace.items[0].id, '2026-10-10');
  saveTrip(moved, storage);
  assert.equal(readTrips(storage)[0].items[0].day, '2026-10-10');
  saveTrip(removePlace(moved, moved.items[0].id), storage);
  assert.deepEqual(readTrips(storage)[0].items, []);
  deleteTrip(lisbon.id, storage);
  assert.deepEqual(readTrips(storage), []);
});

test('renaming a trip preserves destinations, plans and the title across route edits and reloads', () => {
  const storage = memory();
  const trip = { ...lisbon, items: [{ id: 'dinner', name: 'Dinner', day: '2026-10-10' }], transport: [{ id: 'flight' }] };
  const named = renameTrip(trip, '  Autumn escape  ');
  assert.equal(tripTitle(named), 'Autumn escape');
  assert.equal(named.name, 'Lisbon');
  assert.deepEqual(named.items, trip.items);
  assert.deepEqual(named.transport, trip.transport);
  const porto = { placeId: 'porto', name: 'Porto', latitude: 41.1, longitude: -8.6 };
  const reordered = moveStop(addStop(named, porto), 1, -1);
  saveTrip(reordered, storage);
  assert.equal(tripTitle(readTrips(storage)[0]), 'Autumn escape');
  assert.equal(readTrips(storage)[0].name, 'Porto');
  assert.equal(tripTitle(lisbon), 'Lisbon');
  assert.throws(() => renameTrip(trip, '   '));
  assert.throws(() => renameTrip(trip, 'x'.repeat(121)));
});

test('automatic trip names follow all stops and update after route changes', () => {
  const porto = { placeId: 'porto', name: 'Porto', latitude: 41.1, longitude: -8.6 };
  const routed = addStop(lisbon, porto);
  assert.equal(tripTitle(routed), 'Lisbon → Porto');
  assert.equal(tripTitle(moveStop(routed, 1, -1)), 'Porto → Lisbon');
  assert.equal(tripTitle(removeStop(routed, 'porto')), 'Lisbon');
});
