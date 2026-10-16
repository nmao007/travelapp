import test from 'node:test';
import assert from 'node:assert/strict';
import { flightDayBlock, flightConflict } from '../dist/flight-window.js';
import { makePlan, makeTransport, upsertTransport, insertPlan, planDropPosition, duplicatePlan, reorderPlan, eventsForDay } from '../dist/itinerary-model.js';
import { addPlace, movePlace } from '../dist/trip-store.js';
import { scheduleUnassigned } from '../dist/place-model.js';
const trip = { id: 'trip', placeId: 'la', name: 'LA', latitude: 34, longitude: -118, timeZone: 'UTC', startDate: '2026-10-01', endDate: '2026-10-05', items: [], transport: [] };
const flight = { id: 'flight', mode: 'Flight', service_id: 'BA 172', leg: 'arrival', departure_location: 'Origin', arrival_location: 'LA', departure_date: '2026-10-01', departure_time: '20:00', departure_time_zone: 'UTC', arrival_date: '2026-10-03', arrival_time: '07:00', arrival_time_zone: 'UTC' };
const flying = { ...trip, transport: [flight] };
const plan = (day, time = '', extra = {}) => ({ name: 'Museum', day, time, ...extra });

test('every intermediate flight day is unavailable for new, edited, timed and flexible plans', () => {
  assert.equal(flightDayBlock(flying, '2026-10-02').flights[0].id, 'flight');
  for (const time of ['', '00:00', '12:00', '23:59']) assert.throws(() => makePlan(flying, plan('2026-10-02', time)), /overlaps flight BA 172/);
  const before = structuredClone(flying), item = makePlan(flying, plan('2026-10-04'));
  assert.throws(() => makePlan(flying, { ...item, day: '2026-10-02' }, item), /overlaps flight/);
  assert.deepEqual(flying, before);
});

test('departure is inclusive, arrival exclusive, and ground time on boundary days stays usable', () => {
  assert.doesNotThrow(() => makePlan(flying, plan('2026-10-01', '19:59')));
  assert.throws(() => makePlan(flying, plan('2026-10-01', '20:00')), /overlaps flight/);
  assert.throws(() => makePlan(flying, plan('2026-10-03', '06:59')), /overlaps flight/);
  assert.doesNotThrow(() => makePlan(flying, plan('2026-10-03', '07:00')));
  assert.equal(flightDayBlock(flying, '2026-10-01'), null);
  assert.equal(flightDayBlock(flying, '2026-10-03'), null);
  const walk = makePlan(trip, plan('2026-10-01'));
  assert.deepEqual(eventsForDay({ ...flying, items: [walk] }, walk.day).map(event => event.id), [walk.id, 'flight']);
});

test('drag, reorder, duplication and map additions cannot bypass an in-flight day', () => {
  const source = makePlan(trip, plan('2026-10-04')), legacy = { ...source, id: 'legacy', day: '2026-10-02' };
  const input = { ...flying, items: [source, legacy] }, before = structuredClone(input);
  assert.equal(planDropPosition(input, source.id, '2026-10-02').allowed, false);
  assert.equal(insertPlan(input, source.id, '2026-10-02'), input);
  assert.equal(reorderPlan(input, source.id, legacy.id), input);
  assert.throws(() => duplicatePlan(input, source.id, '2026-10-02'), /overlaps flight/);
  assert.throws(() => movePlace(input, source.id, '2026-10-02'), /overlaps flight/);
  assert.throws(() => addPlace(input, { ...plan('2026-10-02'), placeId: 'museum', latitude: 34, longitude: -118 }), /overlaps flight/);
  assert.deepEqual(input, before);
  assert.notEqual(insertPlan(input, source.id, '2026-10-03'), input);
});

test('tour duration cannot cross a departure and new flights cannot consume existing plans', () => {
  const tour = { operatorName: 'Walks', operatorPlaceId: 'walks', durationMinutes: 120, people: 2 };
  assert.throws(() => makePlan(flying, plan('2026-10-01', '19:00', { kind: 'Tour', tour })), /overlaps flight/);
  assert.doesNotThrow(() => makePlan(flying, plan('2026-10-01', '18:00', { kind: 'Tour', tour })));
  const existing = makePlan(trip, plan('2026-10-02'));
  assert.throws(() => upsertTransport({ ...trip, items: [existing] }, makeTransport(trip, flight, 'flight')), /overlaps flight/);
});

test('airport-local dates and DST use actual instants on boundary days', () => {
  const data = { ...trip, timeZone: 'Asia/Tokyo', transport: [{ ...flight, departure_time: '22:00', departure_time_zone: 'Europe/London', arrival_time: '05:00', arrival_time_zone: 'Asia/Tokyo' }] };
  assert.ok(flightDayBlock(data, '2026-10-02'));
  assert.ok(flightConflict(data, plan('2026-10-01', '23:00', { timeZone: 'Europe/London' })));
  assert.equal(flightConflict(data, plan('2026-10-03', '05:00', { timeZone: 'Asia/Tokyo' })), null);
  const dst = { ...trip, timeZone: 'America/New_York', transport: [{ ...flight, departure_date: '2026-10-31', departure_time: '22:00', departure_time_zone: 'America/New_York', arrival_date: '2026-11-02', arrival_time: '02:00', arrival_time_zone: 'America/New_York' }] };
  assert.ok(flightDayBlock(dst, '2026-11-01'));
  assert.ok(flightConflict(dst, plan('2026-11-02', '01:59', { timeZone: 'America/New_York' })));
  assert.equal(flightConflict(dst, plan('2026-11-02', '02:00', { timeZone: 'America/New_York' })), null);
});

test('drafts, trains and invalid data do not block days; cache follows schedule edits', () => {
  for (const patch of [{ draft: true }, { mode: 'Train' }, { arrival_time: '' }, { departure_time_zone: 'Bad/Zone' }]) assert.equal(flightDayBlock({ ...trip, transport: [{ ...flight, ...patch }] }, '2026-10-02'), null);
  const input = structuredClone(flying);
  assert.ok(flightDayBlock(input, '2026-10-02'));
  input.transport[0].arrival_date = '2026-10-02'; input.transport[0].arrival_time = '07:00';
  assert.equal(flightDayBlock(input, '2026-10-02'), null);
  assert.equal(flightDayBlock(flying, 'ideas'), null);
});

test('legacy unscheduled items choose ground days, or remain saved when the trip is entirely in flight', () => {
  const item = { id: 'saved', name: 'Museum', day: 'ideas' };
  const covered = { ...flying, startDate: '2026-10-02', endDate: '2026-10-04', items: [item] };
  assert.equal(scheduleUnassigned(covered).items[0].day, '2026-10-03');
  const noGround = { ...covered, endDate: '2026-10-02' };
  assert.equal(scheduleUnassigned(noGround).items[0].day, 'ideas');
});
