import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrip, makeEntry } from '../lib/planner.ts';
import { addPlaceToTrip, entriesForDay, moveEntryToDay, reorderFlexibleEntry } from '../lib/itinerary.ts';

function fixture() {
  const trip = createTrip({ stops: 'Lisbon, Portugal', start: '2026-10-01', end: '2026-10-03', zone: 'Europe/Lisbon' }, 'trip');
  trip.entries = [
    makeEntry(trip, { title: 'Museum', date: trip.start }, 'museum'),
    makeEntry(trip, { title: 'Flight', date: trip.start, time: '12:00', kind: 'Flight', booked: 'on' }, 'flight'),
    makeEntry(trip, { title: 'Garden', date: trip.start }, 'garden'),
    makeEntry(trip, { title: 'Gallery' }, 'gallery'),
  ];
  return trip;
}

test('one saved place can move to a day and back without losing identity or making duplicates', () => {
  const original = fixture();
  original.entries[3].place = { id: 'osm:node:123', name: 'Gallery', address: 'Lisbon', latitude: 38.7, longitude: -9.1, category: 'Culture', sourceUrl: 'https://www.openstreetmap.org/node/123', fetchedAt: '2026-09-27T00:00:00Z' };
  const placed = moveEntryToDay(original, 'gallery', '2026-10-02');
  assert.equal(placed.entries.length, 4);
  assert.equal(placed.entries[3].date, '2026-10-02');
  assert.strictEqual(placed.entries[3].place, original.entries[3].place);
  const saved = moveEntryToDay(placed, 'gallery', '');
  assert.equal(saved.entries[3].date, '');
  assert.equal(saved.entries[3].id, 'gallery');
  assert.equal(original.entries[3].date, '');
  assert.throws(() => moveEntryToDay(original, 'gallery', '2026-10-09'), /Choose a day/);
  assert.throws(() => moveEntryToDay(original, 'flight', '2026-10-02'), /reservation or timed/);
});

test('flexible stop order persists while fixed commitments stay in clock order', () => {
  const original = fixture();
  assert.deepEqual(entriesForDay(original, original.start).map(item => item.id), ['flight', 'museum', 'garden']);
  const reordered = reorderFlexibleEntry(original, 'garden', -1);
  assert.deepEqual(entriesForDay(reordered, original.start).map(item => item.id), ['flight', 'garden', 'museum']);
  assert.deepEqual(entriesForDay(structuredClone(reordered), original.start).map(item => item.id), ['flight', 'garden', 'museum']);
  assert.strictEqual(reorderFlexibleEntry(reordered, 'flight', -1), reordered);
  assert.strictEqual(reorderFlexibleEntry(reordered, 'garden', -1), reordered);
  assert.deepEqual(entriesForDay(original, original.start).map(item => item.id), ['flight', 'museum', 'garden']);
});

test('saving the same sourced place twice keeps one item and can schedule the saved idea', () => {
  const trip = fixture();
  const place = { id: 'osm:node:123', name: 'Gallery', address: 'Lisbon', latitude: 38.7, longitude: -9.1, category: 'Culture', sourceUrl: 'https://www.openstreetmap.org/node/123', fetchedAt: '2026-09-27T00:00:00Z' };
  const added = addPlaceToTrip(trip, place);
  assert.equal(added.action, 'added');
  assert.equal(added.trip.entries.length, trip.entries.length + 1);
  const again = addPlaceToTrip(added.trip, place);
  assert.equal(again.action, 'already');
  assert.strictEqual(again.trip, added.trip);
  const scheduled = addPlaceToTrip(again.trip, place, '2026-10-02');
  assert.equal(scheduled.action, 'scheduled');
  assert.equal(scheduled.trip.entries.length, added.trip.entries.length);
  assert.equal(scheduled.entry.id, added.entry.id);
  assert.equal(scheduled.entry.date, '2026-10-02');
  assert.equal(addPlaceToTrip(scheduled.trip, place, '2026-10-03').action, 'already');
});
