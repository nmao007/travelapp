import test from 'node:test';
import assert from 'node:assert/strict';
import { matchingOptions, nextEnabledOption } from '../dist/dropdowns.js';

test('keyboard navigation skips disabled choices, wraps, and handles empty menus', () => {
  const options = [{ label: 'A' }, { label: 'B', disabled: true }, { label: 'C' }];
  assert.equal(nextEnabledOption(options, 0, 1), 2);
  assert.equal(nextEnabledOption(options, 2, 1), 0);
  assert.equal(nextEnabledOption(options, 0, -1), 2);
  assert.equal(nextEnabledOption(options, -1, 1), 0);
  assert.equal(nextEnabledOption(options, 0, -1), 2);
  assert.equal(nextEnabledOption([], 0, 1), -1);
  assert.equal(nextEnabledOption([{ disabled: true }], 0, 1), -1);
});

test('time zones can be searched naturally by region or city without knowing underscores', () => {
  const options = [
    { value: 'America/Los_Angeles', label: 'America/Los_Angeles' },
    { value: 'America/New_York', label: 'America/New_York' },
    { value: 'Europe/London', label: 'Europe/London' },
  ];
  assert.deepEqual(matchingOptions(options, 'los angeles'), [options[0]]);
  assert.deepEqual(matchingOptions(options, 'AMERICA york'), [options[1]]);
  assert.deepEqual(matchingOptions(options, '  '), options);
  assert.deepEqual(matchingOptions(options, 'missing city'), []);
});
