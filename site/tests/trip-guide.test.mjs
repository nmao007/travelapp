import test from 'node:test';
import assert from 'node:assert/strict';
import { exportTripGuide, downloadTripGuide } from '../dist/trip-guide.js';
const trip = { id: 'trip', title: 'LA weekend', name: 'Los Angeles', placeId: 'la', latitude: 34, longitude: -118, startDate: '2026-10-01', endDate: '2026-10-03', timeZone: 'America/Los_Angeles', items: [], transport: [] };
const now = new Date('2026-09-30T12:00:00Z');
const plan = { id: 'food', name: 'Dinner', kind: 'Food', day: '2026-10-02', time: '19:30', timeZone: 'America/Los_Angeles', booked: true, reference: 'BOOK-123', address: '100 Main St', notes: 'Ask for the patio', placeId: 'restaurant' };
const flight = { id: 'outbound', mode: 'Flight', service_id: 'BA 172', departure_date: '2026-10-01', departure_time: '16:00', departure_time_zone: 'Europe/London', departure_location: 'London Heathrow', arrival_date: '2026-10-02', arrival_time: '03:00', arrival_time_zone: 'America/Los_Angeles', arrival_location: 'LAX', notes: 'Carry-on only', flightData: { airline: 'British Airways', arrival_terminal: 'B', departure_gate: 'A4', fetchedAt: '2026-09-30T10:00:00Z', rawSecret: 'never-export-provider-payload' } };

test('offline guide includes saved travel details, local times, fixed ordering and unscheduled ideas', () => {
  const input = { ...trip, items: [plan, { ...plan, id: 'idea', name: 'Museum idea', day: 'ideas', time: '', booked: false, reference: '' }], transport: [flight] };
  const before = structuredClone(input), result = exportTripGuide(input, { now });
  assert.equal(result.filename, 'LA weekend - itinerary.html');
  assert.match(result.content, /7:30 PM/);
  assert.match(result.content, /3:00 AM/);
  assert.match(result.content, /Europe\/London/);
  assert.match(result.content, /America\/Los Angeles/);
  for (const text of ['BOOK-123', '100 Main St', 'Ask for the patio', 'Carry-on only', 'Terminal B', 'Gate A4', 'British Airways', 'Free day', 'Saved ideas', 'Museum idea']) assert.ok(result.content.includes(text), text);
  const arrivalDay = result.content.slice(result.content.indexOf('<section class="day" id="day-2026-10-02"'));
  assert.ok(arrivalDay.indexOf('BA 172') < arrivalDay.indexOf('Dinner'));
  assert.doesNotMatch(result.content, /never-export-provider-payload/);
  assert.deepEqual(input, before);
});

test('all content is escaped and guide cannot load remote assets or execute code', () => {
  const result = exportTripGuide({ ...trip, title: '<img src=x onerror=alert(1)>', apiKey: 'private-key-value', account: { email: 'private-account-value' }, items: [{ ...plan, name: '<script>evil()</script>', address: '"><img src="https://tracker.example/pixel">', notes: '</style><script>evil()</script>', reference: '<iframe src=x>', website: 'javascript:evil()' }] }, { now });
  assert.match(result.content, /&lt;script&gt;evil\(\)&lt;\/script&gt;/);
  assert.doesNotMatch(result.content, /<script|<iframe|<img|private-key-value|private-account-value|javascript:/);
  assert.match(result.content, /default-src 'none'/);
  assert.match(result.content, /base-uri 'none'; form-action 'none'/);
  assert.doesNotMatch(result.content, /<(?:script|link|img)\b/);
  for (const match of result.content.matchAll(/href="([^"]+)"/g)) assert.ok(match[1].startsWith('#day-') || match[1].startsWith('https://www.google.com/maps/'));
  assert.match(result.content, /@media print/);
});

test('multi-stop guide labels destination changes once and preserves every trip day', () => {
  const input = { ...trip, stops: [{ ...trip, date: trip.startDate, endDate: '2026-10-01' }, { placeId: 'sd', name: 'San Diego', latitude: 32, longitude: -117, date: '2026-10-02', endDate: trip.endDate }] };
  const { content } = exportTripGuide(input, { now });
  assert.equal((content.match(/class="destination">Los Angeles/g) || []).length, 1);
  assert.equal((content.match(/class="destination">San Diego/g) || []).length, 1);
  assert.equal((content.match(/<section class="day" id="day-/g) || []).length, 3);
  assert.equal((content.match(/<p class="free">Free day/g) || []).length, 3);
  assert.throws(() => exportTripGuide(null), /Open a trip/);
  assert.throws(() => exportTripGuide({ ...trip, startDate: null }), /Choose trip dates/);
});

test('download is generated locally and releases its object URL', () => {
  const previous = { document: globalThis.document, timeout: globalThis.setTimeout, create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  let clicked = false, removed = false, appended = false, revoked = false, cleanup, blob;
  const anchor = { click() { clicked = true; }, remove() { removed = true; } };
  globalThis.document = { createElement(tag) { assert.equal(tag, 'a'); return anchor; }, body: { append(value) { assert.equal(value, anchor); appended = true; } } };
  globalThis.setTimeout = callback => { cleanup = callback; };
  URL.createObjectURL = value => { blob = value; return 'blob:guide'; };
  URL.revokeObjectURL = value => { assert.equal(value, 'blob:guide'); revoked = true; };
  try {
    const result = downloadTripGuide(trip);
    assert.ok(clicked && removed && appended);
    assert.equal(anchor.download, result.filename);
    assert.equal(blob.type, 'text/html;charset=utf-8');
    cleanup(); assert.ok(revoked);
  } finally { globalThis.document = previous.document; globalThis.setTimeout = previous.timeout; URL.createObjectURL = previous.create; URL.revokeObjectURL = previous.revoke; }
});

test('export refuses to silently omit plans or transportation outside the trip', () => {
  assert.throws(() => exportTripGuide({ ...trip, items: [{ ...plan, day: '2026-10-10' }] }), /day within the trip/);
  assert.throws(() => exportTripGuide({ ...trip, transport: [{ ...flight, arrival_date: '2026-10-10' }] }), /flight or train details/);
  const { content } = exportTripGuide({ ...trip, items: [{ ...plan, time: '' }] });
  assert.match(content, /Time not set/);
  assert.doesNotMatch(content, /Any time/);
});
