import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightService } from '../flight-service.mjs';
import { normalizeFlight, normalizeFlightNumber, sameFlightDetails } from '../dist/flight-model.js';

// Provider-shaped fixture; never shipped to the UI or used as a live fallback.
const flight = {
  number: 'BA 179', status: 'Expected', airline: { name: 'British Airways' }, lastUpdatedUtc: '2026-10-30T14:00:00Z',
  departure: { airport: { name: 'Heathrow', iata: 'LHR', timeZone: 'Europe/London' }, scheduledTime: { local: '2026-10-30 17:00+00:00', utc: '2026-10-30T17:00:00Z' }, terminal: '5', gate: 'B20' },
  arrival: { airport: { name: 'John F. Kennedy', iata: 'JFK', timeZone: 'America/New_York' }, scheduledTime: { local: '2026-10-30 20:00-04:00', utc: '2026-10-31T00:00:00Z' } },
};
test('flight input normalizes IATA/ICAO numbers and rejects arbitrary queries', () => {
  assert.equal(normalizeFlightNumber('ba-179'), 'BA179');
  assert.equal(normalizeFlightNumber('KLM 1395'), 'KLM1395');
  assert.equal(normalizeFlightNumber('6E 123'), '6E123');
  assert.equal(normalizeFlightNumber('../secret'), null);
});
test('provider mapping preserves airport-local dates across midnight UTC', () => {
  const result = normalizeFlight(flight, '2026-10-30');
  assert.equal(result.arrival_date, '2026-10-30');
  assert.equal(result.arrival_time, '20:00');
  assert.equal(result.departure_gate, 'B20');
  assert.equal(normalizeFlight({ ...flight, aircraft: { model: 'Boeing 777', reg: 'G-TEST' }, arrival: { ...flight.arrival, baggageBelt: '7' } }, '2026-10-30').arrival_baggage, '7');
  assert.equal(result.arrival_time_zone, 'America/New_York');
  assert.equal(sameFlightDetails(result, { ...result, service_id: 'BA 179' }), true);
  assert.equal(sameFlightDetails(result, { ...result, arrival_time: '21:00' }), false);
  assert.equal(normalizeFlight(flight, '2026-10-31'), null);
  assert.equal(normalizeFlight({ ...flight, arrival: { ...flight.arrival, scheduledTime: null } }, '2026-10-30'), null);
  assert.equal(normalizeFlight({ ...flight, arrival: { ...flight.arrival, scheduledTime: { local: '2026-10-30 25:00' } } }, '2026-10-30'), null);
});
test('lookup requires a key, validates dates before network calls, and never invents flights', async () => {
  let called = false;
  const lookup = createFlightService({ fetcher: () => { called = true; } });
  await assert.rejects(lookup('BA179', '2026-10-30'), error => error.code === 'NOT_CONFIGURED');
  await assert.rejects(lookup('BA179', '2026-02-30', { key: 'test-only' }), error => error.code === 'INVALID_FLIGHT');
  await assert.rejects(lookup('BA179', 'garbage', { key: 'test-only' }), error => error.code === 'INVALID_FLIGHT');
  assert.equal(called, false);
});
test('flight lookup coalesces repeated typing and authenticates on the server', async () => {
  let requests = 0;
  const lookup = createFlightService({ fetcher: async (url, options) => {
    requests++;
    assert.equal(url.hostname, 'aerodatabox.p.rapidapi.com');
    assert.equal(url.searchParams.get('dateLocalRole'), 'Departure');
    assert.equal(options.headers['X-RapidAPI-Key'], 'test-only');
    assert.equal(url.toString().includes('test-only'), false);
    return { status: 200, ok: true, json: async () => [flight] };
  } });
  const [a, b] = await Promise.all([lookup('BA179', '2026-10-30', { key: 'test-only' }), lookup('ba 179', '2026-10-30', { key: 'test-only' })]);
  assert.equal(requests, 1); assert.deepEqual(a, b); assert.equal(a[0].service_id, 'BA179');
});
test('quota errors and empty results remain explicit rather than showing sample data', async () => {
  const quota = createFlightService({ fetcher: async () => ({ status: 429, ok: false }) });
  await assert.rejects(quota('BA179', '2026-10-30', { key: 'test-only' }), error => error.code === 'QUOTA');
  const missing = createFlightService({ fetcher: async () => ({ status: 204, ok: true }) });
  assert.deepEqual(await missing('BA179', '2026-10-30', { key: 'test-only' }), []);
});

test('future schedules are reused for six hours and live data refreshes after five minutes', async () => {
  let time = Date.parse('2026-10-15T12:00:00Z'), calls = 0;
  const lookup = createFlightService({ now: () => time, fetcher: async () => { calls++; return { status: 200, ok: true, json: async () => [flight] }; } });
  await lookup('BA179', '2026-10-30', { key: 'test-only' });
  time += 3_600_000;
  await lookup('BA179', '2026-10-30', { key: 'test-only' });
  assert.equal(calls, 1);
  time += 6 * 3_600_000;
  await lookup('BA179', '2026-10-30', { key: 'test-only' });
  assert.equal(calls, 2);
  time = Date.parse('2026-10-30T12:00:00Z');
  await lookup('BA179', '2026-10-30', { key: 'test-only' });
  time += 4 * 60_000;
  await lookup('BA179', '2026-10-30', { key: 'test-only' });
  assert.equal(calls, 3);
  time += 61_000;
  await lookup('BA179', '2026-10-30', { key: 'test-only' });
  assert.equal(calls, 4);
});
test('empty results are cached, and credentials and gateways have separate caches', async () => {
  let time = 0, calls = 0;
  const lookup = createFlightService({ now: () => time, fetcher: async (url, options) => {
    calls++;
    if (url.hostname === 'api.aerodatabox.com') assert.equal(options.headers['X-Api-Key'], 'second-test-key');
    assert.equal(url.searchParams.get('withFlightPlan'), 'false');
    return { status: 204, ok: true };
  } });
  await lookup('BA179', '2026-10-30', { key: 'test-only' });
  await lookup('BA179', '2026-10-30', { key: 'test-only' });
  assert.equal(calls, 1);
  await lookup('BA179', '2026-10-30', { key: 'second-test-key' });
  await lookup('BA179', '2026-10-30', { key: 'second-test-key', gateway: 'direct' });
  assert.equal(calls, 3);
  time += 15 * 60_000 + 1;
  await lookup('BA179', '2026-10-30', { key: 'test-only' });
  assert.equal(calls, 4);
});
test('quota cooldown covers different flight numbers and never exposes provider errors', async () => {
  let calls = 0, time = 0;
  const lookup = createFlightService({ now: () => time, fetcher: async () => { calls++; return { status: 429, ok: false }; } });
  await assert.rejects(lookup('BA179', '2026-10-30', { key: 'test-only' }), { code: 'QUOTA' });
  await assert.rejects(lookup('BA180', '2026-10-30', { key: 'test-only' }), { code: 'QUOTA' });
  assert.equal(calls, 1);
  time += 60_001;
  await assert.rejects(lookup('BA180', '2026-10-30', { key: 'test-only' }), { code: 'QUOTA' });
  assert.equal(calls, 2);
  const broken = createFlightService({ fetcher: async () => ({ status: 200, ok: true, json: async () => { throw new Error('secret-provider-body'); } }) });
  await assert.rejects(broken('BA179', '2026-10-30', { key: 'test-only' }), error => error.code === 'UNAVAILABLE' && !error.message.includes('secret'));
});
