import test from 'node:test';
import assert from 'node:assert/strict';
import { createTravelDataService, currencyForZone } from '../travel-data-service.mjs';
import { convertedAmount, weatherLabel } from '../dist/travel-essentials.js';
import { destinationCountry } from '../dist/country-currencies.js';

const fixture = () => ({ timezone: 'Europe/Lisbon', current: { temperature_2m: 21.4, weather_code: 2, is_day: 1, wind_speed_10m: 12, time: '2026-10-14T12:00' }, daily: { time: ['2026-10-14', '2026-10-15'], weather_code: [2, 61], temperature_2m_max: [24, 20], temperature_2m_min: [14, 12], precipitation_probability_max: [10, 80] } });
const response = data => ({ ok: true, json: async () => data });

test('weather forwards only a coarse region and public forecast fields, coalescing requests', async () => {
  const calls = [];
  const service = createTravelDataService({ timezoneForPoint: () => 'Europe/Lisbon', fetcher: async (url, options) => { calls.push({ url: new URL(url), options }); return response(fixture()); } });
  const [a, b] = await Promise.all([service.weather(38.7222524, -9.1393366), service.weather(38.724, -9.138)]);
  assert.equal(calls.length, 1); assert.deepEqual(a, b); assert.equal(a.currency, 'EUR');
  assert.equal(calls[0].url.searchParams.get('latitude'), '38.7'); assert.equal(calls[0].url.searchParams.get('longitude'), '-9.1');
  assert.deepEqual([...calls[0].url.searchParams.keys()].sort(), ['current', 'daily', 'forecast_days', 'latitude', 'longitude', 'timezone']);
  assert.deepEqual(calls[0].options.headers, { Accept: 'application/json' });
  assert.equal(a.days[1].rain, 80);
});

test('weather validates inputs and never turns missing temperatures into zero', async () => {
  let calls = 0; const data = fixture(); data.daily.temperature_2m_min[0] = null;
  const service = createTravelDataService({ fetcher: async () => { calls++; return response(data); } });
  await assert.rejects(service.weather(100, 0), { status: 400 }); await assert.rejects(service.weather(null, 0), { status: 400 }); assert.equal(calls, 0);
  const weather = await service.weather(38.7, -9.1); assert.equal(weather.days.length, 1); assert.equal(weather.days[0].date, '2026-10-15');
});

test('weather cache expires and failed requests can retry without exposing provider errors', async () => {
  let time = 0, calls = 0;
  const service = createTravelDataService({ now: () => time, fetcher: async () => { calls++; if (calls === 1) throw Error('private provider diagnostics'); return response(fixture()); } });
  await assert.rejects(service.weather(38.7, -9.1), error => error.message === 'Travel data is temporarily unavailable.');
  await service.weather(38.7, -9.1); await service.weather(38.7, -9.1); assert.equal(calls, 2);
  time += 30 * 60000 + 1; await service.weather(38.7, -9.1); assert.equal(calls, 3);
});

test('exchange lookup sends only currency codes and validates the returned pair and date', async () => {
  let calls = 0;
  const service = createTravelDataService({ fetcher: async (url, options) => { calls++; assert.equal(String(url), 'https://api.frankfurter.dev/v2/rate/usd/eur'); assert.deepEqual(options.headers, { Accept: 'application/json' }); return response({ base: 'USD', quote: 'EUR', rate: .9, date: '2026-10-14' }); } });
  assert.equal((await service.rate('USD', 'EUR')).rate, .9); await service.rate('USD', 'EUR'); assert.equal(calls, 1);
  assert.equal((await service.rate('USD', 'USD')).rate, 1); assert.equal(calls, 1);
  await assert.rejects(service.rate('USD&amount=100', 'EUR'), { status: 400 }); assert.equal(calls, 1);
  const broken = createTravelDataService({ fetcher: async () => response({ base: 'USD', quote: 'JPY', rate: 0, date: '2026-02-30' }) });
  await assert.rejects(broken.rate('USD', 'EUR'), /temporarily unavailable/);
});

test('currency inference refuses ambiguous timezone regions; conversion stays local', () => {
  assert.equal(currencyForZone('Europe/Lisbon'), 'EUR'); assert.equal(currencyForZone('Asia/Tokyo'), null); assert.equal(currencyForZone('Europe/Berlin'), null);
  assert.equal(destinationCountry({ address: 'Tokyo, Japan' }), 'JP'); assert.equal(destinationCountry({ address: 'Private booking note' }), null);
  assert.equal(convertedAmount('100.50', .9), 90.45); assert.equal(convertedAmount('personal booking note', .9), null); assert.equal(convertedAmount('', .9), null);
  assert.equal(weatherLabel(0).label, 'Clear'); assert.equal(weatherLabel(95).label, 'Thunderstorms');
});
