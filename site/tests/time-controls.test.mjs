import test from 'node:test';
import assert from 'node:assert/strict';
import { timeParts, selectedTime, clockParts, clockTime, formatClock } from '../dist/time-picker.js';
import { panelIsOpen, setPanelOpen } from '../dist/expansion.js';

test('coded times preserve midnight and exact minutes without accepting invalid wall times', () => {
  assert.deepEqual(timeParts('00:00'), ['00', '00']);
  assert.deepEqual(timeParts('23:59'), ['23', '59']);
  for (const value of ['', '24:00', '12:60', '9:30', '12:30 PM']) assert.deepEqual(timeParts(value), ['', '']);
  assert.equal(selectedTime('09', ''), '09:00');
  assert.equal(selectedTime('00', '05'), '00:05');
  assert.equal(selectedTime('', '30'), '');
});

test('expanders release animation height, preserve overflow and tolerate rapid reversal', async () => {
  const previous = globalThis.matchMedia; globalThis.matchMedia = () => ({ matches: false });
  try {
    const motions = [];
    const element = { hidden: true, style: { overflow: '', height: '' }, getBoundingClientRect: () => ({ height: 100 }), animate: (frames, options) => { let resolve; const finished = new Promise(done => { resolve = done; }); const motion = { frames, options, finished, resolve, cancelled: false, cancel() { this.cancelled = true; } }; motions.push(motion); return motion; } };
    setPanelOpen(element, true); assert.equal(panelIsOpen(element), true); assert.equal(element.hidden, false);
    motions[0].resolve(); await Promise.resolve(); assert.equal(motions[0].cancelled, true); assert.equal(element.style.height, '');
    assert.equal(element.style.overflow, '');
    setPanelOpen(element, false); assert.equal(panelIsOpen(element), false);
    setPanelOpen(element, true); assert.equal(motions[1].cancelled, true);
    motions[1].resolve(); await Promise.resolve(); assert.equal(element.hidden, false);
    motions[2].resolve(); await Promise.resolve(); assert.equal(element.style.height, ''); assert.equal(element.style.overflow, '');
    setPanelOpen(element, false, { animate: false }); assert.equal(element.hidden, true);
  } finally { globalThis.matchMedia = previous; }
});

test('reduced motion opens and closes expanders immediately with accessible final state', () => {
  const previous = globalThis.matchMedia; globalThis.matchMedia = () => ({ matches: true });
  try {
    const element = { hidden: true, style: { overflow: '', height: '' }, getBoundingClientRect: () => ({ height: 50 }), animate() { throw new Error('Should not animate'); } };
    setPanelOpen(element, true); assert.equal(element.hidden, false); assert.equal(element.style.height, '');
    setPanelOpen(element, false); assert.equal(element.hidden, true);
  } finally { globalThis.matchMedia = previous; }
});


test('typed 12-hour times round-trip without changing local wall time at noon or midnight', () => {
  for (const [canonical, parts, label] of [
    ['00:00', ['12', '00', 'AM'], '12:00 AM'],
    ['12:05', ['12', '05', 'PM'], '12:05 PM'],
    ['09:07', ['9', '07', 'AM'], '9:07 AM'],
    ['23:59', ['11', '59', 'PM'], '11:59 PM'],
  ]) {
    assert.deepEqual(clockParts(canonical), parts);
    assert.equal(clockTime(...parts), canonical);
    assert.equal(formatClock(canonical), label);
  }
  assert.equal(clockTime('1', '5', 'PM'), '13:05');
  assert.equal(clockTime('09', '', 'AM'), '09:00');
  assert.equal(formatClock('13:30:00'), '1:30 PM');
  assert.equal(formatClock(''), '');
  for (const parts of [['0','00','AM'], ['13','00','PM'], ['1','60','AM'], ['1','-1','AM'], ['1.5','00','AM'], ['','30','PM'], ['1','00','bad']]) assert.equal(clockTime(...parts), '');
});
