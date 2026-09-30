import test from 'node:test';
import assert from 'node:assert/strict';
import { eventsForTripDay, tripCalendarMonths, tripDates } from '../lib/trip-itinerary.ts';

const activity = (id, date, time = null, time_zone = 'Europe/Paris') => ({
  id, trip_id: 'trip', title: id, category: 'Activity', date, time, time_zone, location: '', notes: '',
});
const train = {
  id: 'train', trip_id: 'trip', mode: 'Train', service_id: 'IC 720',
  departure_location: 'Lisbon', arrival_location: 'Porto',
  departure_date: '2026-10-01', departure_time: '09:00:00', departure_time_zone: 'Europe/Lisbon',
  arrival_date: '2026-10-01', arrival_time: '11:45:00', arrival_time_zone: 'Europe/Lisbon', notes: '',
};

test('itinerary includes each calendar day, including open days', () => {
  assert.deepEqual(tripDates('2026-10-01', '2026-10-03'), ['2026-10-01', '2026-10-02', '2026-10-03']);
  assert.deepEqual(tripDates('2026-10-03', '2026-10-01'), []);
});

test('calendar view groups days by month and pads weekdays', () => {
  const [october, november] = tripCalendarMonths('2026-10-30', '2026-11-02');
  assert.equal(october.key, '2026-10');
  assert.equal(october.cells[33], '2026-10-30'); // October 1, 2026 is Thursday.
  assert.equal(october.cells.includes('2026-10-29'), false);
  assert.equal(november.key, '2026-11');
  assert.equal(november.cells.includes('2026-11-02'), true);
});

test('days sort activities and transport by local time converted to absolute time', () => {
  const events = eventsForTripDay('2026-10-01', [activity('late', '2026-10-01', '12:00'), activity('open', '2026-10-01')], [train]);
  assert.deepEqual(events.map((event) => event.id), ['train', 'late', 'open']);
});

test('multi-day transport appears on departure and arrival days at each local time', () => {
  const overnight = { ...train, arrival_date: '2026-10-02', arrival_time: '07:00:00', arrival_time_zone: 'Europe/London' };
  assert.equal(eventsForTripDay('2026-10-01', [], [overnight])[0].leg, 'departure');
  assert.equal(eventsForTripDay('2026-10-02', [], [overnight])[0].leg, 'arrival');
});
