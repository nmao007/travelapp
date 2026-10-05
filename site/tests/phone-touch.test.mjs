import test from 'node:test';
import assert from 'node:assert/strict';
import { enablePhoneTouch } from '../dist/phone-touch.js';

function preview({ horizontal = false, native = false, reduced = false } = {}) {
  let time = 0, nextFrame = 0, top = 200, left = 0, capture = null;
  const frames = new Map(), listeners = new Map(), classes = new Set();
  const pane = {
    parentElement: null, clientWidth: 300, scrollWidth: horizontal ? 900 : 300,
    clientHeight: 300, scrollHeight: 1300,
    get scrollTop() { return top; }, set scrollTop(value) { top = Math.max(0, Math.min(1000, value)); },
    get scrollLeft() { return left; }, set scrollLeft(value) { left = Math.max(0, Math.min(600, value)); },
    matches: () => horizontal, closest: () => null, getClientRects: () => [1],
    setPointerCapture: id => { capture = id; }, hasPointerCapture: id => capture === id,
    releasePointerCapture: () => { capture = null; },
  };
  const document = {
    documentElement: { dataset: native ? {} : { devicePreview: 'iphone16' }, classList: { add: name => classes.add(name), remove: name => classes.delete(name) } },
    scrollingElement: null,
    addEventListener: (type, callback) => listeners.set(type, callback),
    defaultView: {
      performance: { now: () => time },
      getComputedStyle: () => ({ overflowX: 'auto', overflowY: 'auto' }),
      matchMedia: () => ({ matches: reduced }),
      requestAnimationFrame: callback => { frames.set(++nextFrame, callback); return nextFrame; },
      cancelAnimationFrame: id => frames.delete(id), addEventListener: (type, callback) => listeners.set(type, callback),
    },
  };
  enablePhoneTouch(document);
  function emit(type, x = 100, y = 200, after = 0, extra = {}) {
    time += after;
    const event = { target: pane, pointerType: 'mouse', button: 0, pointerId: 1, clientX: x, clientY: y, detail: 1, prevented: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() {}, ...extra };
    listeners.get(type)?.(event); return event;
  }
  function frame(after = 16) {
    time += after;
    const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback(time));
  }
  return { pane, classes, emit, frame, pending: () => frames.size };
}

test('drag input is painted once per frame without losing movement before release', () => {
  const p = preview(); p.emit('pointerdown');
  p.emit('pointermove', 100, 180, 8); p.emit('pointermove', 100, 160, 8);
  assert.equal(p.pane.scrollTop, 200); assert.equal(p.pending(), 1);
  p.frame(); assert.equal(p.pane.scrollTop, 240);
  p.emit('pointermove', 100, 150, 8); p.emit('pointerup', 100, 150);
  assert.equal(p.pane.scrollTop, 250); assert.equal(p.classes.size, 0);
  assert.equal(p.emit('click').prevented, true);
});

test('an image/layout scroll adjustment is retained by the next finger movement', () => {
  const p = preview(); p.emit('pointerdown'); p.emit('pointermove', 100, 180, 16); p.frame();
  assert.equal(p.pane.scrollTop, 220);
  p.pane.scrollTop += 80; // Native scroll anchoring after content above the viewport grows.
  p.emit('pointermove', 100, 170, 16); p.frame();
  assert.equal(p.pane.scrollTop, 310);
});

test('reversing at either edge responds immediately without unwinding overscroll', () => {
  const p = preview(); p.pane.scrollTop = 0; p.emit('pointerdown');
  p.emit('pointermove', 100, 280, 16); p.frame(); assert.equal(p.pane.scrollTop, 0);
  p.emit('pointermove', 100, 270, 16); p.frame(); assert.equal(p.pane.scrollTop, 10);
  p.emit('pointercancel'); p.pane.scrollTop = 1000; p.emit('pointerdown');
  p.emit('pointermove', 100, 100, 16); p.frame(); assert.equal(p.pane.scrollTop, 1000);
  p.emit('pointermove', 100, 110, 16); p.frame(); assert.equal(p.pane.scrollTop, 990);
});

test('release eases out monotonically and a new wheel gesture cancels momentum', () => {
  const p = preview(); p.emit('pointerdown');
  for (const y of [185, 170, 155, 140]) { p.emit('pointermove', 100, y, 8); p.frame(8); }
  p.emit('pointerup', 100, 140);
  let previous = p.pane.scrollTop, lastStep = Infinity;
  for (let i = 0; i < 6; i++) {
    p.frame(); const step = p.pane.scrollTop - previous;
    assert.ok(step > 0 && step <= lastStep + .01); lastStep = step; previous = p.pane.scrollTop;
  }
  p.emit('wheel'); p.frame(); assert.equal(p.pane.scrollTop, previous); assert.equal(p.pending(), 0);
});

test('a pause, cancellation, reduced motion or native touch cannot launch preview inertia', () => {
  for (const mode of ['pause', 'cancel', 'reduced', 'native']) {
    const p = preview({ reduced: mode === 'reduced', native: mode === 'native' });
    p.emit('pointerdown', 100, 200, 0, mode === 'native' ? { pointerType: 'touch' } : {});
    p.emit('pointermove', 100, 160, 16); p.frame();
    p.emit(mode === 'cancel' ? 'pointercancel' : 'pointerup', 100, 160, mode === 'pause' ? 100 : 0);
    const top = p.pane.scrollTop; p.frame(); assert.equal(p.pane.scrollTop, top); assert.equal(p.pending(), 0);
  }
});

test('sideways gestures work only on intentional rails and never shift a reading pane', () => {
  const vertical = preview(); vertical.emit('pointerdown'); vertical.emit('pointermove', 70, 200, 16); vertical.frame();
  assert.equal(vertical.pane.scrollLeft, 0); assert.equal(vertical.pane.scrollTop, 200);
  const rail = preview({ horizontal: true }); rail.emit('pointerdown'); rail.emit('pointermove', 70, 200, 16); rail.frame();
  assert.equal(rail.pane.scrollLeft, 30); assert.equal(rail.pane.scrollTop, 200);
});


test('a stationary frame after opposite coalesced moves cannot revive an old fling', () => {
  const p = preview(); p.emit('pointerdown');
  p.emit('pointermove', 100, 180, 16); p.frame();
  p.emit('pointermove', 100, 160, 16); p.frame();
  p.emit('pointermove', 100, 150, 120); p.emit('pointermove', 100, 160); p.frame();
  p.emit('pointerup', 100, 160);
  const top = p.pane.scrollTop; p.frame(); assert.equal(p.pane.scrollTop, top);
});

test('a delayed animation frame cannot skip a large distance during momentum', () => {
  const p = preview(); p.emit('pointerdown');
  for (const y of [180, 160, 140]) { p.emit('pointermove', 100, y, 8); p.frame(8); }
  p.emit('pointerup', 100, 140);
  const top = p.pane.scrollTop; p.frame(250);
  assert.ok(p.pane.scrollTop > top && p.pane.scrollTop - top < 47);
});
