import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlanNavigation, createWorkspacePositions } from '../dist/plan-navigation.js';

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


test('workspace tabs restore independent scroll positions, including nested and horizontal lists', () => {
  const plan = {id:'plans',scrollTop:420,scrollLeft:0}, days = {id:'days',scrollTop:0,scrollLeft:180}, travel = {id:'flights',scrollTop:85,scrollLeft:0};
  const positions = createWorkspacePositions(view => view === 'plan' ? [plan, days] : [travel]);
  positions.save('trip:stop', 'plan'); positions.save('trip:stop', 'travel');
  plan.scrollTop = 0; days.scrollLeft = 0; travel.scrollTop = 0;
  positions.restore('trip:stop', 'plan'); assert.equal(plan.scrollTop,420); assert.equal(days.scrollLeft,180); assert.equal(travel.scrollTop,0);
  positions.restore('trip:stop', 'travel'); assert.equal(travel.scrollTop,85);
});

test('workspace scroll memory survives replaced lists but never leaks into another trip or stop', () => {
  let list = {id:'plans',scrollTop:230,scrollLeft:0};
  const positions = createWorkspacePositions(() => [list, null]);
  positions.save('trip:Lisbon', 'plan'); list = {id:'plans',scrollTop:0,scrollLeft:0};
  positions.restore('trip:Lisbon', 'plan'); assert.equal(list.scrollTop,230);
  list.scrollTop=0; positions.restore('trip:Porto','plan'); assert.equal(list.scrollTop,0);
  positions.save('trip:Porto','plan'); positions.reset(); list.scrollTop=40;
  positions.restore('trip:Porto','plan'); assert.equal(list.scrollTop,40);
});
