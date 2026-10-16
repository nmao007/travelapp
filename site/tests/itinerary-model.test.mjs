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

test('up/down and cross-day moves follow the displayed saved order', () => {
  const a = makePlan(trip, { name: 'First', day: trip.startDate });
  const b = makePlan(trip, { name: 'Second', day: trip.startDate });
  const c = makePlan(trip, { name: 'Third', day: trip.startDate });
  const ordered = { ...trip, items: [a,b,c], dayOrder: { [trip.startDate]: [`plan:${c.id}`,`plan:${a.id}`,`plan:${b.id}`] } };
  const up = stepPlan(ordered, a.id, 'up');
  assert.deepEqual(eventsForDay(up, trip.startDate).map(event => event.item.name), ['First','Third','Second']);
  assert.equal(stepPlan(ordered, c.id, 'up'), ordered);
  const other = makePlan(trip, { name: 'Other day', day: '2026-10-31' });
  const crossed = reorderPlan({ ...ordered, items: [...ordered.items,other], dayOrder: { ...ordered.dayOrder, [other.day]: [`plan:${other.id}`] } }, c.id, other.id);
  assert.deepEqual(eventsForDay(crossed, other.day).map(event => event.item.name), ['Third','Other day']);
  assert.deepEqual(eventsForDay(crossed, trip.startDate).map(event => event.item.name), ['First','Second']);
});

test('new overnight arrivals are inserted by time despite an older saved day order', () => {
  const day = '2026-10-31';
  const booking = makePlan(trip, { name: 'Stadium', day, time: '10:00', timeZone: 'America/Los_Angeles', booked: true });
  const lunch = makePlan(trip, { name: 'Lunch', day });
  const flight = makeTransport(trip, { ...service, mode: 'Flight', departure_date: '2026-10-30', departure_time: '22:00', departure_time_zone: 'America/Los_Angeles', arrival_date: day, arrival_time: '03:00', arrival_time_zone: 'America/Los_Angeles' }, 'overnight');
  const saved = { ...trip, items: [booking, lunch], transport: [flight], dayOrder: { [day]: [`plan:${booking.id}`, `plan:${lunch.id}`] } };
  const ordered = eventsForDay(saved, day);
  assert.deepEqual(ordered.map(event => event.id), [flight.id, booking.id, lunch.id]);
  assert.equal(ordered[0].leg, 'arrival');
  assert.ok(ordered[0].at < ordered[1].at);
  assert.deepEqual(saved.dayOrder[day], [`plan:${booking.id}`, `plan:${lunch.id}`]);
});

test('changed times repair stale fixed-event order while retaining flexible plan order', () => {
  const day = '2026-10-31';
  const morning = makePlan(trip, { name: 'Morning', day, time: '09:00' });
  const evening = makePlan(trip, { name: 'Evening', day, time: '18:00' });
  const walk = makePlan(trip, { name: 'Walk', day });
  const coffee = makePlan(trip, { name: 'Coffee', day });
  const saved = { ...trip, items: [morning, evening, walk, coffee], dayOrder: { [day]: [`plan:${evening.id}`, `plan:${coffee.id}`, `plan:${morning.id}`, `plan:${walk.id}`] } };
  assert.deepEqual(eventsForDay(saved, day).map(event => event.item.name), ['Morning', 'Coffee', 'Evening', 'Walk']);
});

test('new timed bookings join the schedule by instant across time zones', () => {
  const day = '2026-10-31';
  const breakfast = makePlan(trip, { name: 'Breakfast', day, time: '08:00', timeZone: 'America/Los_Angeles' });
  const remote = makePlan(trip, { name: 'Call', day, time: '18:00', timeZone: 'Europe/Lisbon' });
  const flexible = makePlan(trip, { name: 'Walk', day });
  const saved = { ...trip, items: [breakfast, remote, flexible], dayOrder: { [day]: [`plan:${breakfast.id}`, `plan:${flexible.id}`] } };
  assert.deepEqual(eventsForDay(saved, day).map(event => event.item.name), ['Breakfast', 'Call', 'Walk']);
});


test('phone calendar shows the complete month while distinguishing trip days', () => {
  const [month] = monthsForTrip({ ...trip, startDate: '2026-10-30', endDate: '2026-10-31' });
  const cells = calendarDisplayCells(month, { fullMonth: true });
  assert.equal(cells.length, 35);
  assert.equal(cells.filter(Boolean).length, 31);
  assert.equal(cells[4].date, '2026-10-01');
  assert.equal(cells[4].inTrip, false);
  assert.deepEqual(cells.filter(cell => cell?.inTrip).map(cell => cell.date), ['2026-10-30', '2026-10-31']);
  assert.equal(calendarDisplayCells(month).length, 7);
  const [leap] = monthsForTrip({ ...trip, startDate: '2028-02-28', endDate: '2028-02-29' });
  assert.equal(calendarDisplayCells(leap, { fullMonth: true }).filter(Boolean).length, 29);
});

test('flights anchor flexible plans between arrival and departure, including stale drag orders', () => {
  const day=trip.startDate;
  const inbound={...service,id:'in',mode:'Flight',departure_location:'SFO',arrival_location:'Lisbon',departure_time:'06:00',arrival_time:'09:00',leg:'arrival'};
  const outbound={...service,id:'out',mode:'Flight',departure_location:'Lisbon',arrival_location:'SFO',departure_time:'18:00',arrival_time:'23:00',leg:'home'};
  const a=makePlan(trip,{name:'Walk',day}), b=makePlan(trip,{name:'Coffee',day});
  const original={...trip,items:[a,b],transport:[inbound,outbound],dayOrder:{[day]:[`plan:${a.id}`,'transport:in:departure','transport:out:departure',`plan:${b.id}`]}};
  assert.deepEqual(eventsForDay(original,day).map(event=>event.id),['in',a.id,b.id,'out']);
  const beforeArrival=insertPlan(original,b.id,day,'transport:in:departure');
  assert.deepEqual(eventsForDay(beforeArrival,day).map(event=>event.id),['in',b.id,a.id,'out']);
  const afterDeparture=insertPlan(beforeArrival,b.id,day);
  assert.deepEqual(eventsForDay(afterDeparture,day).map(event=>event.id),['in',a.id,b.id,'out']);
  assert.deepEqual(afterDeparture.transport,original.transport);
  assert.equal(insertPlan(original,'in',day),original);
});

test('overnight arrivals stay above cross-day drops and their local times never change', () => {
  const day='2026-10-31';
  const flight=makeTransport(trip,{...service,mode:'Flight',departure_time:'22:00',arrival_date:day,arrival_time:'03:00'},'overnight');
  const a=makePlan(trip,{name:'Walk',day:trip.startDate});
  const original={...trip,items:[a],transport:[flight]};
  const moved=insertPlan(original,a.id,day,'transport:overnight:arrival');
  assert.deepEqual(eventsForDay(moved,day).map(event=>event.id),['overnight',a.id]);
  assert.deepEqual(moved.transport,original.transport);
});

test('day arrows do not swap activities across a transport anchor', () => {
  const day=trip.startDate, a=makePlan(trip,{name:'Before travel',day}), b=makePlan(trip,{name:'After travel',day});
  const train=makeTransport(trip,service,'train');
  const original={...trip,items:[a,b],transport:[train],dayOrder:{[day]:[`plan:${a.id}`,'transport:train:departure',`plan:${b.id}`]}};
  assert.equal(stepPlan(original,a.id,'down'),original);
  assert.equal(stepPlan(original,b.id,'up'),original);
  const dropped=insertPlan(original,a.id,day);
  assert.deepEqual(eventsForDay(dropped,day).map(event=>event.id),[a.id,'train',b.id]);
});
