import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlanNavigation } from '../dist/plan-navigation.js';

test('day Back restores the calendar, then calendar Back restores the timeline', () => {
  const nav = createPlanNavigation();
  const timeline = { mode: 'list', day: '2026-10-30', stop: 'la', scroll: 420 };
  const calendar = { mode: 'calendar', day: '2026-11-01', stop: 'la', month: '2026-11', scroll: 92 };
  nav.enter('trip', timeline, 'calendar');
  nav.enter('trip', calendar, 'day');
  nav.enter('trip', { mode: 'day', day: '2026-11-02', scroll: 80 }, 'day');
  assert.deepEqual(nav.peek('trip'), calendar);
  assert.deepEqual(nav.back('trip'), calendar);
  assert.deepEqual(nav.back('trip'), timeline);
  assert.equal(nav.back('trip'), null);
});

test('an explicit timeline selection and opening another trip clear stale origins', () => {
  const nav = createPlanNavigation();
  nav.enter('a', { mode: 'calendar', scroll: 80 }, 'day');
  nav.enter('a', { mode: 'day' }, 'list');
  assert.equal(nav.back('a'), null);
  nav.enter('a', { mode: 'list', scroll: 100 }, 'day');
  assert.equal(nav.back('b'), null);
  nav.enter('b', { mode: 'calendar' }, 'day');
  nav.reset('b');
  assert.equal(nav.peek('b'), null);
});
