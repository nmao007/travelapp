import test from 'node:test';
import assert from 'node:assert/strict';
import { makePlan } from '../dist/itinerary-model.js';
import { mapEntries, scheduleUnassigned, googlePlaceRecord, destinationForDay } from '../dist/place-model.js';

const place = { placeId: 'google-place', name: 'A real museum', latitude: 38.7, longitude: -9.1 };
test('planned places have one priority marker even when recommended or visited on multiple days', () => {
  const items = [{ ...place, id: 'first', day: '2026-10-01' }, { ...place, id: 'second', day: '2026-10-02' }];
  const entries = mapEntries(items, [place, { ...place, placeId: 'another-place' }, { placeId: 'invalid' }]);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].planned, true);
  assert.equal(entries[0].id, 'first');
  assert.equal(entries[0].number, 1);
  assert.equal(entries[1].planned, false);
});
test('removing Saved Ideas preserves notes, reservations, coordinates and transport when scheduling legacy records', () => {
  const trip = { startDate: '2026-10-01', items: [{ ...place, id: 'old', day: 'ideas', notes: 'Keep this', reference: 'ABC', booked: true }, { ...place, id: 'dated', day: '2026-10-02' }], transport: [{ id: 'flight' }] };
  const next = scheduleUnassigned(trip);
  assert.equal(trip.items[0].day, 'ideas');
  assert.deepEqual(next.items[0], { ...trip.items[0], day: '2026-10-01' });
  assert.equal(next.items[1], trip.items[1]);
  assert.equal(next.transport, trip.transport);
  assert.equal(scheduleUnassigned(next), next);
  assert.equal(scheduleUnassigned({ ...trip, startDate: null }).items[0].day, 'ideas');
});
test('Google recommendation metadata is taken from the returned place and missing ratings stay missing', () => {
  const source = { id: 'google-id', displayName: 'Museum', location: { lat: () => 10, lng: () => 20 }, rating: 4.6, userRatingCount: 120, primaryTypeDisplayName: 'Museum' };
  const record = googlePlaceRecord(source);
  assert.equal(record.rating, 4.6);
  assert.equal(record.ratingCount, 120);
  assert.equal(record.category, 'Museum');
  assert.equal(googlePlaceRecord({ ...source, rating: undefined }).rating, undefined);
  assert.throws(() => googlePlaceRecord({ id: 'no-location' }));
});

test('open-day recommendations follow the destination arrival day in a multi-city trip', () => {
  const trip = { startDate: '2026-10-01' };
  const stops = [{ name: 'Lisbon' }, { name: 'Porto', date: '2026-10-03' }];
  assert.equal(destinationForDay(trip, stops, '2026-10-02').name, 'Lisbon');
  assert.equal(destinationForDay(trip, stops, '2026-10-03').name, 'Porto');
});

test('a Google place can be attached to a custom plan without losing its booking or identity', () => {
  const trip = { startDate: '2026-10-01', endDate: '2026-10-03', timeZone: 'UTC' };
  const existing = { id: 'dinner', name: 'Group dinner', day: '2026-10-01', booked: true, reference: 'ABC' };
  const item = makePlan(trip, { ...existing, ...place, name: existing.name, address: 'Restaurant address' }, existing);
  assert.equal(item.id, 'dinner'); assert.equal(item.name, 'Group dinner');
  assert.equal(item.placeId, place.placeId); assert.equal(item.latitude, place.latitude);
  assert.equal(item.booked, true); assert.equal(item.reference, 'ABC');
});

test('legacy identical Google entries collapse while separate visits and custom plans remain separate', () => {
  const same = { ...place, day: '2026-10-01' };
  const trip = { startDate: '2026-10-01', items: [{ ...same, id: 'planned' }, { ...same, id: 'legacy', day: 'ideas' }, { ...same, id: 'evening', time: '18:00' }, { id: 'custom-one', name: 'Lunch', day: '2026-10-01' }, { id: 'custom-two', name: 'Lunch', day: '2026-10-01' }] };
  assert.deepEqual(scheduleUnassigned(trip).items.map(item => item.id), ['planned', 'evening', 'custom-one', 'custom-two']);
});
