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

test('map numbering follows trip days rather than the order places were originally added', () => {
  const items = [
    { ...place, placeId: 'majordomo', id: 'dinner', name: 'Majordomo', day: '2026-10-02' },
    { ...place, placeId: 'dodger', id: 'stadium', name: 'Dodger Stadium', day: '2026-10-01' },
  ];
  const entries = mapEntries(items);
  assert.deepEqual(entries.map(entry => [entry.name, entry.number]), [['Dodger Stadium', 1], ['Majordomo', 2]]);
  assert.deepEqual(items.map(item => item.id), ['dinner', 'stadium']);
  const moved = mapEntries([{ ...items[0], day: '2026-10-01' }, { ...items[1], day: '2026-10-02' }]);
  assert.deepEqual(moved.map(entry => [entry.name, entry.number]), [['Majordomo', 1], ['Dodger Stadium', 2]]);
});

test('map ordering agrees with the timeline for timed and flexible stops and preserves their drag order', async () => {
  const { eventsForDay } = await import('../dist/itinerary-model.js');
  const trip = { startDate: '2026-10-01', endDate: '2026-10-02', timeZone: 'America/Los_Angeles', items: [
    { ...place, placeId: 'flex-first', id: 'flex-first', day: '2026-10-01' },
    { ...place, placeId: 'late', id: 'late', day: '2026-10-01', time: '18:00' },
    { ...place, placeId: 'early', id: 'early', day: '2026-10-01', time: '09:00' },
    { ...place, placeId: 'flex-second', id: 'flex-second', day: '2026-10-01' },
    { ...place, placeId: 'next-day', id: 'next-day', day: '2026-10-02', time: '07:00' },
  ] };
  const visible = ['2026-10-01', '2026-10-02'].flatMap(day => eventsForDay(trip, day).filter(event => event.kind === 'activity').map(event => event.id));
  const pins = mapEntries(trip.items, [], { timeZone: trip.timeZone });
  assert.deepEqual(pins.map(pin => pin.id), visible);
  assert.deepEqual(pins.map(pin => pin.number), [1, 2, 3, 4, 5]);
});

test('revisited places use their earliest visit and unmapped events do not consume marker numbers', () => {
  const entries = mapEntries([
    { ...place, id: 'return', day: '2026-10-03' },
    { id: 'flight', day: '2026-10-01', time: '09:00' },
    { ...place, id: 'arrival', day: '2026-10-01' },
    { ...place, placeId: 'restaurant', id: 'dinner', day: '2026-10-02' },
  ], [{ ...place, placeId: 'suggestion' }]);
  assert.deepEqual(entries.map(entry => [entry.id || entry.placeId, entry.number]), [['arrival', 1], ['dinner', 2], ['suggestion', undefined]]);
});
