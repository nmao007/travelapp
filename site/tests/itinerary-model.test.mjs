import test from 'node:test';
import assert from 'node:assert/strict';
import { datesForTrip, monthsForTrip, calendarDisplayCells, eventsForDay, makePlan, makeTransport, upsertTransport, reorderPlan, stepPlan, insertPlan, removeItineraryEvent, restoreItineraryEvent, duplicatePlan } from '../dist/itinerary-model.js';
import { saveTrip, readTrips, movePlace } from '../dist/trip-store.js';

const trip = { id: 'trip', name: 'Lisbon', placeId: 'lisbon', latitude: 38.7, longitude: -9.1, timeZone: 'Europe/Lisbon', startDate: '2026-10-30', endDate: '2026-11-02', items: [] };
const service = { mode: 'Train', service_id: 'IC 720', departure_location: 'Lisbon', arrival_location: 'Porto', departure_date: '2026-10-30', departure_time: '09:00', departure_time_zone: 'Europe/Lisbon', arrival_date: '2026-10-30', arrival_time: '11:45', arrival_time_zone: 'Europe/Lisbon' };

test('day arrows reorder flexible plans in both directions and persist across reopening', () => {
  const day = '2026-10-30';
  const first = makePlan(trip, { name: 'Walk', day });
  const booking = makePlan(trip, { name: 'Reserved dinner', day, booked: true });
  const otherDay = makePlan(trip, { name: 'Museum', day: '2026-10-31' });
  const second = makePlan(trip, { name: 'Coffee', day });
  const train = makeTransport(trip, service, 'train');
  const original = { ...trip, items: [first, booking, otherDay, second], transport: [train] };
  const moved = stepPlan(original, first.id, 'down');
  assert.deepEqual(moved.items.map(item => item.id), [second.id, booking.id, otherDay.id, first.id]);
  assert.deepEqual(eventsForDay(moved, day).map(event => event.id), [train.id, second.id, booking.id, first.id]);
  assert.deepEqual(moved.transport, original.transport);
  let data;
  const storage = { getItem: () => data, setItem: (_, value) => { data = value; } };
  saveTrip(moved, storage);
  const reopened = readTrips(storage)[0];
  assert.deepEqual(stepPlan(reopened, first.id, 'up').items, JSON.parse(JSON.stringify(original.items)));
  assert.equal(original.items[0], first);
});

test('day arrows stop at boundaries and cannot move fixed events or cross days', () => {
  const first = makePlan(trip, { name: 'Walk', day: '2026-10-30' });
  const last = makePlan(trip, { name: 'Coffee', day: first.day });
  const other = makePlan(trip, { name: 'Museum', day: '2026-10-31' });
  const planned = { ...trip, items: [first, last, other] };
  for (const [id, direction] of [[first.id, 'up'], [last.id, 'down'], [other.id, 'up'], ['missing', 'down'], [first.id, 'invalid']]) assert.equal(stepPlan(planned, id, direction), planned);
  for (const patch of [{ booked: true }, { time: '09:00' }, { kind: 'Flight' }, { kind: 'Train' }]) {
    const fixed = { ...planned, items: [{ ...first, ...patch }, last] };
    assert.equal(stepPlan(fixed, first.id, 'down'), fixed);
  }
});

test('duplicating a flexible plan preserves its location and notes with a separate identity', () => {
  const source = { ...makePlan(trip, { name: 'Breakfast', kind: 'Food', day: '2026-10-30', notes: 'Vegetarian options', reference: 'OLD-REFERENCE' }), placeId: 'cafe', latitude: 38.72, longitude: -9.14, address: 'Lisbon', rating: 4.7 };
  const original = { ...trip, items: [source] };
  const { trip: copied, copy } = duplicatePlan(original, source.id, '2026-10-31');
  assert.notEqual(copy.id, source.id);
  assert.equal(copy.day, '2026-10-31');
  for (const key of ['name', 'kind', 'notes', 'placeId', 'latitude', 'longitude', 'address', 'rating', 'timeZone']) assert.equal(copy[key], source[key]);
  assert.equal(copy.booked, false);
  assert.equal(copy.reference, '');
  assert.equal(original.items.length, 1);
  const edited = makePlan(copied, { ...copy, name: 'Late breakfast' }, copy);
  assert.equal(edited.id, copy.id);
  assert.equal(source.name, 'Breakfast');
  let value;
  const storage = { getItem: () => value, setItem: (_, data) => { value = data; } };
  saveTrip(copied, storage);
  const reopened = readTrips(storage)[0];
  assert.equal(eventsForDay(reopened, source.day)[0].id, source.id);
  assert.equal(eventsForDay(reopened, copy.day)[0].id, copy.id);
  assert.ok(monthsForTrip(reopened)[0].cells.includes(copy.day));
});

test('fixed commitments cannot be copied and targets must be different real trip days', () => {
  const source = makePlan(trip, { name: 'Walk', day: '2026-10-30' });
  for (const patch of [{ booked: true }, { time: '09:00' }, { kind: 'Flight' }, { kind: 'Train' }]) assert.throws(() => duplicatePlan({ ...trip, items: [{ ...source, ...patch }] }, source.id, '2026-10-31'), /flexible/);
  for (const day of [source.day, 'ideas', '2026-11-03', '2026-02-30']) assert.throws(() => duplicatePlan({ ...trip, items: [source] }, source.id, day), /another day/);
  assert.throws(() => duplicatePlan(trip, 'missing', '2026-10-31'), /no longer/);
});

test('repeating the same duplicate does not create identical entries or alter existing events', () => {
  const source = { ...makePlan(trip, { name: 'Walk', day: '2026-10-30', notes: 'By the river' }), placeId: 'walk', latitude: 38.7, longitude: -9.1 };
  const result = duplicatePlan({ ...trip, items: [source] }, source.id, '2026-10-31');
  assert.throws(() => duplicatePlan(result.trip, source.id, '2026-10-31'), /already/);
  const differentVisit = { ...result.trip, items: result.trip.items.map(item => item.id === result.copy.id ? { ...item, notes: 'Sunset visit' } : item) };
  assert.equal(duplicatePlan(differentVisit, source.id, '2026-10-31').trip.items.length, 3);
});

test('undo restores a reservation and its position without losing edits made after removal', () => {
  const first = makePlan(trip, { name: 'Walk', day: '2026-10-30' });
  const dinner = { ...makePlan(trip, { name: 'Dinner', day: '2026-10-30', time: '19:00', booked: true, reference: 'BOOK-123', notes: 'Vegetarian menu' }), placeId: 'restaurant', latitude: 38.72, longitude: -9.13 };
  const last = makePlan(trip, { name: 'Concert', day: '2026-10-30' });
  const original = { ...trip, items: [first, dinner, last] };
  const removed = removeItineraryEvent(original, 'items', dinner.id);
  const newPlan = makePlan(trip, { name: 'Coffee', day: '2026-10-31' });
  const edited = { ...removed.trip, title: 'Autumn break', items: [{ ...first, notes: 'Bring a jacket' }, last, newPlan] };
  const restored = restoreItineraryEvent(edited, removed.removal);
  assert.deepEqual(restored.items.map(item => item.id), [first.id, dinner.id, last.id, newPlan.id]);
  assert.deepEqual(restored.items[1], dinner);
  assert.equal(restored.items[0].notes, 'Bring a jacket');
  assert.equal(restored.title, 'Autumn break');
  assert.equal(original.items.length, 3);
});

test('undo restores both transport legs and provider data, and survives saving and reopening', () => {
  const train = { ...makeTransport(trip, service, 'train'), notes: 'Carriage 4', flightData: { status: 'Confirmed', departure_gate: '8' } };
  const removed = removeItineraryEvent({ ...trip, transport: [train] }, 'transport', train.id);
  assert.equal(eventsForDay(removed.trip, service.departure_date).length, 0);
  const restored = restoreItineraryEvent(removed.trip, removed.removal);
  let data = null;
  const storage = { getItem: () => data, setItem: (_, value) => { data = value; } };
  saveTrip(restored, storage);
  assert.deepEqual(readTrips(storage)[0].transport[0], train);
  assert.equal(eventsForDay(readTrips(storage)[0], service.departure_date)[0].id, train.id);
});

test('undo cannot duplicate events, affect another trip, or restore outside changed trip dates', () => {
  const plan = makePlan(trip, { name: 'Walk', day: '2026-10-30' });
  const original = { ...trip, items: [plan] }, removed = removeItineraryEvent(original, 'items', plan.id);
  assert.equal(restoreItineraryEvent(original, removed.removal), original);
  const other = { ...removed.trip, id: 'other' };
  assert.equal(restoreItineraryEvent(other, removed.removal), other);
  assert.throws(() => restoreItineraryEvent({ ...removed.trip, startDate: '2026-10-31' }, removed.removal), /trip dates/);
  const train = makeTransport(trip, service, 'train');
  const removedTrain = removeItineraryEvent({ ...trip, transport: [train] }, 'transport', train.id);
  assert.throws(() => restoreItineraryEvent({ ...removedTrain.trip, startDate: '2026-10-31' }, removedTrain.removal), /trip dates/);
  assert.throws(() => removeItineraryEvent(original, 'items', 'missing'), /no longer/);
});

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
