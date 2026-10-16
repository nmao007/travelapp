import test from 'node:test';
import assert from 'node:assert/strict';
import { createExpenseRates } from '../dist/expense-rates.js';
const response = data => ({ ok: true, json: async () => data });
test('expense FX lookup coalesces, caches and sends only currency codes', async () => {
  let calls = 0, clock = 0;
  const lookup = createExpenseRates({ now: () => clock, fetcher: async (url, options) => { calls++; assert.equal(url, '/api/exchange-rate?base=EUR&quote=USD'); assert.equal(options.credentials, 'omit'); assert.equal(options.referrerPolicy, 'no-referrer'); assert.equal(options.body, undefined); return response({ base: 'EUR', quote: 'USD', rate: 1.1, date: '2026-10-16' }); } });
  const [first, second] = await Promise.all([lookup('EUR', 'USD'), lookup('EUR', 'USD')]); assert.deepEqual(first, second); assert.equal(calls, 1);
  await lookup('EUR', 'USD'); assert.equal(calls, 1); clock = 3600001; await lookup('EUR', 'USD'); assert.equal(calls, 2);
});
test('bad pairs, wrong currencies, invalid dates and failed rates cannot become expense conversions', async () => {
  for (const patch of [{ base: 'JPY' }, { quote: 'GBP' }, { rate: 0 }, { rate: Infinity }, { date: '2026-02-30' }]) {
    const lookup = createExpenseRates({ fetcher: async () => response({ base: 'EUR', quote: 'USD', rate: 1.1, date: '2026-10-16', ...patch }) }); await assert.rejects(lookup('EUR', 'USD'));
  }
  let calls = 0; const failed = createExpenseRates({ fetcher: async () => { calls++; return { ok: false }; } });
  await assert.rejects(failed('EUR', 'USD'), /manually/); await assert.rejects(failed('EUR', 'USD')); assert.equal(calls, 2);
  await assert.rejects(failed('EUR&name=private', 'USD'), /currency codes/); assert.equal(calls, 2);
});
