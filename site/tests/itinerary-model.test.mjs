import test from 'node:test';
import assert from 'node:assert/strict';
import { datesForTrip, monthsForTrip, calendarDisplayCells, eventsForDay, makePlan, makeTransport, upsertTransport, reorderPlan, insertPlan } from '../dist/itinerary-model.js';
import { saveTrip, readTrips, movePlace } from '../dist/trip-store.js';

const trip = { id: 'trip', name: 'Lisbon', placeId: 'lisbon', latitude: 38.7, longitude: -9.1, timeZone: 'Europe/Lisbon', startDate: '2026-10-30', endDate: '2026-11-02', items: [] };
const service = { mode: 'Train', service_id: 'IC 720', departure_location: 'Lisbon', arrival_location: 'Porto', departure_date: '2026-10-30', departure_time: '09:00', departure_time_zone: 'Europe/Lisbon', arrival_date: '2026-10-30', arrival_time: '11:45', arrival_time_zone: 'Europe/Lisbon' };

test('HTML calendar keeps backend alignment, month boundaries, and open days', () => {
  assert.deepEqual(datesForTrip(trip), ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
  const [october, november] = monthsForTrip(trip);
  assert.equal(october.cells[33], '2026-10-30');
  assert.equal(november.cells[0], '2026-11-01');
  assert.equal(october.cells.includes('2026-10-29'), false);
  assert.deepEqual(datesForTrip({ ...trip, startDate: '2026-02-30' }), []);
});

test('transport is shared by list, calendar and day views and edits keep one record', () => {
  const train = makeTransport(trip, service, 'train');
  const withTrain = upsertTransport(trip, train);
  const plan = makePlan(trip, { name: 'Lunch', day: '2026-10-30', time: '12:00', timeZone: 'Europe/Lisbon' });
  const events = eventsForDay({ ...withTrain, items: [plan] }, '2026-10-30');
  assert.deepEqual(events.map(event => event.id), ['train', plan.id]);
  const edited = upsertTransport(withTrain, makeTransport(trip, { ...service, service_id: 'IC 721' }, 'train'));
  assert.equal(edited.transport.length, 1);
  assert.equal(edited.transport[0].service_id, 'IC 721');
});

test('overnight flights appear on both local travel days and survive local persistence', () => {
  const flight = makeTransport(trip, { ...service, mode: 'Flight', departure_date: '2026-10-30', departure_time: '22:00', departure_time_zone: 'America/New_York', arrival_date: '2026-10-31', arrival_time: '10:00', arrival_time_zone: 'Europe/Lisbon' }, 'flight');
  const next = upsertTransport(trip, flight);
  assert.equal(eventsForDay(next, '2026-10-30')[0].leg, 'departure');
  assert.equal(eventsForDay(next, '2026-10-31')[0].leg, 'arrival');
  let value;
  const storage = { getItem: () => value, setItem: (_, data) => { value = data; } };
  saveTrip(next, storage);
  assert.deepEqual(readTrips(storage)[0].transport, [flight]);
});

test('flight times validate real chronology across the date line and reject impossible times', () => {
  const flight = { ...service, mode: 'Flight', departure_date: '2026-10-31', departure_time: '17:00', departure_time_zone: 'Asia/Tokyo', arrival_date: '2026-10-31', arrival_time: '11:00', arrival_time_zone: 'America/Los_Angeles' };
  assert.doesNotThrow(() => makeTransport(trip, flight));
  assert.throws(() => makeTransport(trip, { ...service, arrival_time: '08:00' }), /Arrival must/);
  assert.throws(() => makeTransport(trip, { ...service, arrival_date: '2026-11-03' }), /trip dates/);
  assert.throws(() => makeTransport(trip, { ...service, arrival_time_zone: 'Moon/Sea' }), /time zones/);
  const springTrip = { ...trip, startDate: '2026-03-08', endDate: '2026-03-09' };
  assert.throws(() => makeTransport(springTrip, { ...service, departure_date: '2026-03-08', departure_time: '02:30', departure_time_zone: 'America/New_York', arrival_date: '2026-03-09' }), /clocks change/);
});

test('custom plans edit in place, flexible items can reorder, and fixed plans cannot drag', () => {
  const first = makePlan(trip, { name: 'Group hike', day: '2026-10-30' });
  const second = makePlan(trip, { name: 'Group dinner', day: '2026-10-30' });
  const booked = makePlan(trip, { name: 'Reserved dinner', day: '2026-10-30', booked: true, reference: 'ABC' });
  const planned = { ...trip, items: [first, second, booked] };
  assert.deepEqual(reorderPlan(planned, second.id, first.id).items.map(item => item.id), [second.id, first.id, booked.id]);
  assert.equal(movePlace(planned, booked.id, '2026-10-31'), planned);
  assert.equal(reorderPlan(planned, booked.id, first.id), planned);
  const edited = makePlan(trip, { ...first, name: 'Longer hike' }, first);
  assert.equal(edited.id, first.id);
  assert.throws(() => makePlan(trip, { name: 'Outside', day: '2026-11-10' }), /trip/);
  assert.throws(() => makePlan(trip, { name: 'Timed idea', day: 'ideas', time: '12:00' }), /trip day/);
});

test('calendar shows only relevant weeks while preserving alignment and leap dates', () => {
  const [october, november] = monthsForTrip(trip);
  const cells = calendarDisplayCells(october);
  assert.equal(cells.length, 7);
  assert.equal(cells[0].date, '2026-10-25');
  assert.equal(cells[0].inTrip, false);
  assert.equal(cells[5].date, '2026-10-30');
  assert.equal(cells[5].inTrip, true);
  assert.deepEqual(cells.filter(cell => cell?.inTrip).map(cell => cell.date), ['2026-10-30', '2026-10-31']);
  assert.equal(calendarDisplayCells(november)[0].date, '2026-11-01');
  const [february] = monthsForTrip({ ...trip, startDate: '2028-02-28', endDate: '2028-02-29' });
  assert.equal(calendarDisplayCells(february)[2].date, '2028-02-29');
  const [fullMonth] = monthsForTrip({ ...trip, startDate: '2026-10-01', endDate: '2026-10-31' });
  assert.equal(calendarDisplayCells(fullMonth).filter(Boolean).length, 31);
});

test('insertion gaps commit the visible order across days and preserve fixed reservations', () => {
  const a = makePlan(trip, { name: 'Walk', day: '2026-10-30' });
  const b = makePlan(trip, { name: 'Lunch', day: '2026-10-31' });
  const c = makePlan(trip, { name: 'Dinner', day: '2026-10-31' });
  const fixed = makePlan(trip, { name: 'Booking', day: '2026-10-31', booked: true });
  const before = { ...trip, items: [a, b, c, fixed] };
  const moved = insertPlan(before, a.id, c.day, c.id);
  assert.deepEqual(eventsForDay(moved, c.day).map(event => event.item.id), [b.id, a.id, c.id, fixed.id]);
  assert.equal(eventsForDay(moved, a.day).length, 0);
  assert.equal(insertPlan(before, fixed.id, a.day, a.id), before);
  assert.equal(insertPlan(before, a.id, '2026-11-09'), before);
  assert.equal(insertPlan(before, a.id, c.day, 'missing'), before);
  const appended = insertPlan(moved, a.id, c.day);
  assert.deepEqual(eventsForDay(appended, c.day).map(event => event.item.id), [b.id, c.id, fixed.id, a.id]);
});
