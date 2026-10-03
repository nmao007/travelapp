import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, readTrips, saveTrip, deleteTrip, addPlace, movePlace, removePlace, addStop, moveStop, removeStop, tripStops, stopSchedule, stopForDay, datesForStop, setStopDates, tripTitle, renameTrip } from '../dist/trip-store.js';

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

test('a clicked map location can be named and saved when Google details are unavailable, without invented provider data', () => {
  const storage = memory(), trip = { ...lisbon, startDate: '2026-10-10', endDate: '2026-10-13', items: [] };
  const clicked = { placeId: 'google-clicked-place', latitude: 38.71, longitude: -9.13, day: '2026-10-10' };
  assert.throws(() => addPlace(trip, clicked), /Choose a place/);
  const next = addPlace(trip, { ...clicked, name: 'Place named by the traveler', kind: 'Activity' });
  saveTrip(next, storage);
  const reopened = readTrips(storage)[0].items[0];
  for (const [key, value] of Object.entries(clicked)) assert.equal(reopened[key], value);
  assert.equal(reopened.name, 'Place named by the traveler');
  assert.equal(reopened.rating, undefined); assert.equal(reopened.editorialSummary, undefined);
  assert.equal(addPlace(next, { ...clicked, name: reopened.name }), next);
});

const datedRoute = () => ({ ...lisbon, startDate: '2026-10-01', endDate: '2026-10-08',
  stops: [ { ...lisbon, date: '2026-10-01' }, { placeId: 'porto', name: 'Porto', latitude: 41.15, longitude: -8.63, date: '2026-10-04' } ],
  items: [{ id: 'dinner', name: 'Dinner', day: '2026-10-03', booked: true }],
  transport: [{ id: 'train', departure_date: '2026-10-04', arrival_date: '2026-10-04' }] });

test('legacy arrivals infer departure ranges and share the transfer day without duplicating trip days', () => {
  const trip = datedRoute(), schedule = stopSchedule(trip);
  assert.deepEqual(schedule.map(({start, end}) => [start, end]), [['2026-10-01', '2026-10-04'], ['2026-10-04', '2026-10-08']]);
  assert.equal(stopForDay(trip, '2026-10-03').name, 'Lisbon');
  assert.equal(stopForDay(trip, '2026-10-04').name, 'Porto');
  assert.ok(datesForStop(trip, lisbon.placeId).includes('2026-10-04'));
  assert.ok(datesForStop(trip, 'porto').includes('2026-10-04'));
});

test('stop dates survive saving and do not move bookings or transportation', () => {
  const trip = datedRoute(), next = setStopDates(trip, 'porto', '2026-10-05', '2026-10-08'), storage = memory();
  saveTrip(next, storage);
  assert.equal(readTrips(storage)[0].stops[1].endDate, '2026-10-08');
  assert.equal(next.items, trip.items); assert.equal(next.transport, trip.transport);
  assert.equal(stopForDay(next, '2026-10-04').name, 'Lisbon');
});

test('stop editing rejects reversed ranges, outside dates, and overlap across the route', () => {
  const trip = datedRoute();
  assert.throws(() => setStopDates(trip, 'porto', '2026-10-05', '2026-10-04'), /Departure/);
  assert.throws(() => setStopDates(trip, 'porto', '2026-10-04', '2026-10-09'), /within/);
  assert.throws(() => setStopDates(trip, lisbon.placeId, '2026-10-01', '2026-10-06'), /next stop/);
  const explicit = setStopDates(trip, lisbon.placeId, '2026-10-01', '2026-10-03');
  assert.throws(() => setStopDates(explicit, 'porto', '2026-10-02', '2026-10-08'), /previous stop/);
  assert.equal(stopForDay({...explicit, stops: [explicit.stops[0], {...explicit.stops[1], date: '2026-10-05'}]}, '2026-10-04'), null);
});

test('route reordering retains chronological date slots and all itinerary records', () => {
  const trip = datedRoute(), next = moveStop(trip, 1, -1);
  assert.deepEqual(stopSchedule(next).map(entry => [entry.stop.name, entry.start, entry.end]), [['Porto', '2026-10-01', '2026-10-04'], ['Lisbon', '2026-10-04', '2026-10-08']]);
  assert.equal(next.items, trip.items); assert.equal(next.transport, trip.transport);
});

test('unscheduled added destinations do not take ownership of existing days', () => {
  const trip = addStop(datedRoute(), {placeId:'coimbra',name:'Coimbra',latitude:40.2,longitude:-8.4});
  assert.equal(stopSchedule(trip)[2].start, null);
  assert.deepEqual(datesForStop(trip, 'coimbra'), []);
  assert.equal(stopForDay(trip, '2026-10-07').name, 'Porto');
});
