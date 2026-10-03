import test from 'node:test';
import assert from 'node:assert/strict';
import { exportTripCalendar, downloadTripCalendar } from '../dist/calendar-export.js';

const now = new Date('2026-10-02T16:00:00Z');
const trip = { id: 'trip-1', title: 'Los Angeles → Tokyo', startDate: '2026-10-10', endDate: '2026-10-12', timeZone: 'America/Los_Angeles', items: [], transport: [] };
const plan = { id: 'plan-1', name: 'Group dinner', day: '2026-10-10', kind: 'Food', time: '', notes: '' };
const flight = { id: 'flight-1', mode: 'Flight', service_id: 'NH 5', departure_date: '2026-10-10', departure_time: '12:00', departure_time_zone: 'America/Los_Angeles', departure_location: 'LAX', arrival_date: '2026-10-11', arrival_time: '16:00', arrival_time_zone: 'Asia/Tokyo', arrival_location: 'NRT', notes: 'Keep boarding pass handy' };
const unfold = content => content.replace(/\r\n /g, '');

test('a journey exports once, spanning airport-local dates, alongside untimed and booked plans', () => {
  const input = { ...trip, items: [plan, { ...plan, id: 'booked', name: 'Dinner reservation', time: '18:30', booked: true, reference: 'ABC123', address: '123 Main St', placeId: 'real-place' }, { ...plan, id: 'idea', day: 'ideas', name: 'Unscheduled idea' }], transport: [flight] };
  const original = structuredClone(input), result = exportTripCalendar(input, { now }), content = unfold(result.content);
  assert.equal(result.count, 3);
  assert.equal((content.match(/BEGIN:VEVENT/g) || []).length, 3);
  assert.match(content, /DTSTART:20261010T190000Z\r\nDTEND:20261011T070000Z/);
  assert.match(content, /Departure: 2026-10-10 12:00 · America\/Los_Angeles/);
  assert.match(content, /Arrival: 2026-10-11 16:00 · Asia\/Tokyo/);
  assert.match(content, /DTSTART;VALUE=DATE:20261010\r\nDTEND;VALUE=DATE:20261011/);
  assert.match(content, /DTSTART:20261011T013000Z/);
  assert.match(content, /STATUS:CONFIRMED/);
  assert.match(content, /Booking reference: ABC123/);
  assert.match(content, /URL:https:\/\/www.google.com\/maps\/search\//);
  assert.doesNotMatch(content, /Unscheduled idea/);
  assert.equal((content.match(/DTEND:/g) || []).length, 1); // No invented restaurant duration.
  assert.deepEqual(input, original);
});

test('trains and tours preserve actual durations across midnight and daylight saving', () => {
  const input = { ...trip, startDate: '2026-11-01', endDate: '2026-11-02', timeZone: 'America/New_York', items: [{ ...plan, day: '2026-11-01', kind: 'Tour', time: '00:30', timeZone: 'America/New_York', tour: { operatorPlaceId: 'operator', operatorName: 'City Tours', durationMinutes: 240, people: 3, meetingName: 'Station entrance' } }], transport: [{ ...flight, mode: 'Train', service_id: 'Train 12', departure_date: '2026-11-01', departure_time: '23:30', departure_time_zone: 'America/New_York', departure_location: 'Central station', arrival_date: '2026-11-02', arrival_time: '01:30', arrival_time_zone: 'America/New_York', arrival_location: 'North station' }] };
  const content = unfold(exportTripCalendar(input, { now }).content);
  assert.match(content, /DTSTART:20261101T043000Z\r\nDTEND:20261101T083000Z/);
  assert.match(content, /DTSTART:20261102T043000Z\r\nDTEND:20261102T063000Z/);
  assert.match(content, /Meeting point: Station entrance/);
  assert.match(content, /4 hr · 3 people/);
  assert.match(content, /SUMMARY:Train Train 12/);
});

test('flexible all-day plans do not block availability and cover the correct year boundary', () => {
  const result = exportTripCalendar({ ...trip, startDate: '2026-12-31', endDate: '2027-01-01', items: [{ ...plan, day: '2026-12-31' }] }, { now });
  const content = unfold(result.content);
  assert.match(content, /DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101/);
  assert.match(content, /TRANSP:TRANSPARENT\r\nSTATUS:TENTATIVE/);
  assert.doesNotMatch(content, /DTSTART:/);
});

test('Unicode, punctuation and multiline notes remain intact without injecting calendar properties', () => {
  const name = '東京, tea; walk \\ café '.repeat(12), notes = 'Line one\r\nBEGIN:VEVENT\nLine two';
  const result = exportTripCalendar({ ...trip, items: [{ ...plan, name, notes }] }, { now });
  for (const line of result.content.split('\r\n')) assert.ok(Buffer.byteLength(line, 'utf8') <= 75);
  assert.ok(!result.content.includes('\ufffd'));
  assert.match(unfold(result.content), /東京\\, tea\\; walk \\\\ café/);
  assert.match(unfold(result.content), /Line one\\nBEGIN:VEVENT\\nLine two/);
  assert.equal((result.content.match(/\r\nBEGIN:VEVENT\r\n/g) || []).length, 1);
  assert.ok(result.content.endsWith('END:VCALENDAR\r\n'));
});

test('re-exporting keeps stable identities through renames and plan moves without exporting two flight legs', () => {
  const input = { ...trip, items: [plan], transport: [flight] };
  const first = unfold(exportTripCalendar(input, { now }).content);
  const second = unfold(exportTripCalendar({ ...input, title: 'New trip title', items: [{ ...plan, day: '2026-10-12' }] }, { now: new Date('2026-10-03T16:00:00Z') }).content);
  assert.deepEqual(first.match(/^UID:.+$/gm), second.match(/^UID:.+$/gm));
  assert.match(second, /DTSTAMP:20261003T160000Z/);
  assert.match(second, /DTSTART;VALUE=DATE:20261012/);
  assert.equal((second.match(/BEGIN:VEVENT/g) || []).length, 2);
});

test('empty trips and corrupt dates, times, identities and transport chronology fail clearly', () => {
  assert.throws(() => exportTripCalendar(null), /Open a trip/);
  assert.throws(() => exportTripCalendar({ ...trip, startDate: null }), /Choose trip dates/);
  assert.throws(() => exportTripCalendar(trip), /Add a plan/);
  assert.throws(() => exportTripCalendar({ ...trip, items: [{ ...plan, day: '2026-02-30' }] }), /day within the trip/);
  for (const patch of [{ time: '25:00' }, { time: '10:00', timeZone: 'Bad/Zone' }]) assert.throws(() => exportTripCalendar({ ...trip, items: [{ ...plan, ...patch }] }), /date, time and time zone/);
  assert.throws(() => exportTripCalendar({ ...trip, timeZone: null, items: [{ ...plan, time: '10:00' }] }), /time zone/);
  assert.throws(() => exportTripCalendar({ ...trip, startDate: '2026-03-08', endDate: '2026-03-08', items: [{ ...plan, day: '2026-03-08', time: '02:30' }] }), /clock change/);
  assert.throws(() => exportTripCalendar({ ...trip, items: [plan, plan] }), /same ID/);
  assert.throws(() => exportTripCalendar({ ...trip, transport: [{ ...flight, arrival_date: '2026-10-10', arrival_time: '06:00' }] }), /arrival time/);
  assert.throws(() => exportTripCalendar({ ...trip, items: [{ ...plan, kind: 'Tour', time: '10:00', tour: { durationMinutes: -30 } }] }), /tour operator/);
});

test('download creates the calendar file locally and cleans up the temporary link', async () => {
  const previousDocument = globalThis.document, previousTimeout = globalThis.setTimeout;
  const create = URL.createObjectURL, revoke = URL.revokeObjectURL;
  let blob, clicked = false, removed = false, revoked = false, cleanup;
  const link = { remove() { removed = true; }, click() { clicked = true; } };
  globalThis.document = { createElement: () => link, body: { append(element) { assert.equal(element, link); } } };
  URL.createObjectURL = value => { blob = value; return 'blob:calendar'; };
  URL.revokeObjectURL = url => { assert.equal(url, 'blob:calendar'); revoked = true; };
  globalThis.setTimeout = callback => { cleanup = callback; };
  try {
    const result = downloadTripCalendar({ ...trip, title: '../Trip: 東京', items: [plan] });
    assert.ok(clicked && removed);
    assert.equal(link.href, 'blob:calendar');
    assert.equal(link.download, result.filename);
    assert.equal(blob.type, 'text/calendar;charset=utf-8');
    assert.match(await blob.text(), /BEGIN:VCALENDAR/);
    assert.doesNotMatch(result.filename, /[/:]/);
    cleanup(); assert.ok(revoked);
  } finally { globalThis.document = previousDocument; globalThis.setTimeout = previousTimeout; URL.createObjectURL = create; URL.revokeObjectURL = revoke; }
});
