import test from 'node:test';
import assert from 'node:assert/strict';
import { calendarMonth, isDate, presetRange, rangeLength, selectDateRange } from '../dist/date-range.js';

test('calendar starts on Monday and contains real dates only', () => {
  const cells = calendarMonth(2026, 9);
  assert.equal(cells[0], null);
  assert.equal(cells[3], '2026-10-01');
  assert.equal(cells.at(-1), '2026-10-31');
  assert.equal(isDate('2026-02-30'), false);
});

test('a range can be picked, restarted, or set to one day', () => {
  assert.deepEqual(selectDateRange({}, '2026-10-10'), { start: '2026-10-10', end: null });
  assert.deepEqual(selectDateRange({ start: '2026-10-10', end: null }, '2026-10-12'), { start: '2026-10-10', end: '2026-10-12' });
  assert.deepEqual(selectDateRange({ start: '2026-10-10', end: null }, '2026-10-08'), { start: '2026-10-08', end: null });
  assert.deepEqual(selectDateRange({ start: '2026-10-10', end: null }, '2026-10-10'), { start: '2026-10-10', end: '2026-10-10' });
  assert.equal(rangeLength('2026-10-10', '2026-10-12'), 3);
});

test('quick dates are calculated from today, never hardcoded', () => {
  const tuesday = new Date(2026, 8, 29, 12);
  assert.deepEqual(presetRange('weekend', tuesday), { start: '2026-10-03', end: '2026-10-04' });
  assert.deepEqual(presetRange('next-week', tuesday), { start: '2026-10-05', end: '2026-10-11' });
});
