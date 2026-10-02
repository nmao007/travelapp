import test from 'node:test';
import assert from 'node:assert/strict';
import { isTourOperator, tourDetails, tourDraft, tourSummary, tourEndLabel } from '../dist/tour-model.js';
import { makePlan, eventsForDay, fixedItem, duplicatePlan, insertPlan, mappedPlace } from '../dist/itinerary-model.js';
import { travelConflict } from '../dist/day-route-model.js';
import { readTrips, saveTrip } from '../dist/trip-store.js';
const trip = { id: 'trip', name: 'Lisbon', placeId: 'lisbon', latitude: 38.7, longitude: -9.1, timeZone: 'Europe/Lisbon', startDate: '2026-10-30', endDate: '2026-11-02', items: [] };
const operator = { placeId: 'guide', name: 'Real tour operator', primaryType: 'tour_agency', latitude: 38.7, longitude: -9.1, address: 'Operator office' };
test('Guided outing starts as a plan, never a booking or an office meeting point', () => {
  const plan = makePlan(trip, { ...tourDraft(operator), day: trip.startDate });
  assert.equal(plan.kind, 'Tour'); assert.equal(plan.booked, false); assert.equal(plan.reference, '');
  assert.equal(mappedPlace(plan), false); assert.equal(plan.placeId, undefined); assert.equal(plan.address, '');
  assert.equal(plan.tour.operatorPlaceId, operator.placeId); assert.equal(fixedItem(plan), false);
  assert.equal(isTourOperator({ primaryType: 'government_office', tourOperator: true }), false);
  assert.throws(() => tourDraft({ ...operator, primaryType: 'museum' }), /operator/);
});
test('Group sizes and durations reject impossible or corrupt values', () => {
  const details = tourDraft(operator).tour;
  for (const people of [0, 51, 1.5, '2']) assert.throws(() => tourDetails({ ...details, people }), /group/);
  for (const durationMinutes of [0, 1441, '120']) assert.throws(() => tourDetails({ ...details, durationMinutes }), /duration/);
  assert.throws(() => tourDetails({ ...details, operatorPlaceId: '' }), /operator/);
  assert.equal(tourSummary({ ...details, durationMinutes: 90, people: 3 }), '1 hr 30 min · 3 people');
});
test('Meeting point, operator identity, group size, and timing survive editing and persistence', () => {
  const plan = makePlan(trip, { ...tourDraft(operator), day: trip.startDate });
  const edited = makePlan(trip, { ...plan, tour: { ...plan.tour, durationMinutes: 240, people: 3, meetingName: 'Praça do Comércio' }, time: '09:30', placeId: 'meeting', latitude: 38.71, longitude: -9.12, address: 'Confirmed meeting point', booked: true, reference: 'GUIDE-123' }, plan);
  assert.equal(edited.tour.meetingName, 'Praça do Comércio');
  assert.equal(edited.id, plan.id); assert.equal(edited.tour.operatorPlaceId, operator.placeId); assert.equal(edited.placeId, 'meeting');
  let stored; const storage = { getItem: () => stored, setItem: (_, value) => { stored = value; } };
  saveTrip({ ...trip, items: [edited] }, storage);
  const reopened = readTrips(storage)[0]; assert.deepEqual(eventsForDay(reopened, trip.startDate)[0].item, edited);
  assert.equal(fixedItem(edited), true); assert.equal(insertPlan(reopened, edited.id, trip.endDate), reopened);
});
test('Flexible tours can move or duplicate without changing the operator or inventing reservations', () => {
  const plan = makePlan(trip, { ...tourDraft(operator), day: trip.startDate });
  const original = { ...trip, items: [plan] };
  const moved = insertPlan(original, plan.id, trip.endDate); assert.equal(moved.items[0].day, trip.endDate);
  const { copy } = duplicatePlan(original, plan.id, trip.endDate); assert.notEqual(copy.id, plan.id); assert.deepEqual(copy.tour, plan.tour); assert.equal(copy.booked, false);
  const converted = makePlan(trip, { ...plan, kind: 'Activity' }, plan); assert.equal(converted.tour, undefined);
});

test('Tour end times and onward travel account for duration, midnight, and daylight saving', () => {
  const tour = { kind: 'Tour', day: '2026-10-31', time: '09:30', timeZone: 'Europe/Lisbon', tour: { durationMinutes: 240 } };
  assert.equal(tourEndLabel(tour), 'Ends 13:30');
  assert.equal(tourEndLabel({ ...tour, time: '23:30', tour: { durationMinutes: 120 } }), 'Ends 01:30 · Nov 1');
  assert.equal(tourEndLabel({ ...tour, day: '2026-10-25', time: '00:30', tour: { durationMinutes: 120 } }), 'Ends 01:30');
  assert.equal(travelConflict({ from: tour, to: { ...tour, time: '13:40' } }, 900, trip), true);
  assert.equal(travelConflict({ from: tour, to: { ...tour, time: '14:00' } }, 900, trip), false);
});
