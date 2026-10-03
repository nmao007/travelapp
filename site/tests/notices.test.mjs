import test from 'node:test';
import assert from 'node:assert/strict';
import { createTransientNotice } from '../dist/notices.js';

function fixture(options = {}) {
  const handlers = new Map(), timers = new Map(), motions = [];
  let id = 0, hides = 0;
  const element = { hidden: true, addEventListener: (type, callback) => handlers.set(type, callback), contains: target => target === 'child' };
  const notice = createTransientNotice(element, { duration: 7000, onHide: () => hides++, stop: () => {}, animate: (target, frames, settings) => { motions.push({ frames, settings }); return null; }, setTimer: (callback, delay) => { timers.set(++id, { callback, delay }); return id; }, clearTimer: id => timers.delete(id), ...options });
  const expire = () => { const [key, timer] = [...timers][0]; timers.delete(key); timer.callback(); };
  return { element, notice, handlers, timers, motions, expire, hides: () => hides };
}

test('messages enter, expire, and animate out without replacing their positioning transform', () => {
  const f = fixture(); f.notice.show();
  assert.equal(f.element.hidden, false);
  assert.equal([...f.timers.values()][0].delay, 7000);
  f.expire(); assert.equal(f.element.hidden, true); assert.equal(f.hides(), 1);
  assert.equal(f.motions.length, 2);
  assert.equal(f.motions[1].settings.duration, 240);
  assert.equal(f.motions[1].frames.at(-1).opacity, 0);
  assert.equal(f.motions[1].frames.at(-1).translate, '0 6px');
  assert.ok(f.motions.every(motion => motion.frames.every(frame => !frame.transform)));
});

test('hover and keyboard focus pause expiry, then give the user fresh reading time', () => {
  const f = fixture(); f.notice.show();
  f.handlers.get('pointerenter')(); assert.equal(f.timers.size, 0);
  f.handlers.get('pointerleave')(); assert.equal(f.timers.size, 1);
  f.handlers.get('focusin')(); assert.equal(f.timers.size, 0);
  f.handlers.get('focusout')({ relatedTarget: 'child' }); assert.equal(f.timers.size, 0);
  f.handlers.get('focusout')({ relatedTarget: null }); assert.equal(f.timers.size, 1);
  f.expire(); assert.equal(f.element.hidden, true);
});

test('old timers and in-flight exit animations cannot remove a replacement notification', async () => {
  let resolveExit;
  const f = fixture({ animate: (element, frames) => frames.at(-1).opacity === 0 ? { finished: new Promise(resolve => { resolveExit = resolve; }) } : null });
  f.notice.show(); const old = [...f.timers.values()][0].callback;
  f.notice.show(); old(); assert.equal(f.element.hidden, false); assert.equal(f.hides(), 0);
  f.expire(); assert.equal(f.element.hidden, false);
  f.notice.show(); resolveExit(); await Promise.resolve();
  assert.equal(f.element.hidden, false); assert.equal(f.hides(), 0); assert.equal(f.timers.size, 1);
  f.notice.clear(); assert.equal(f.element.hidden, true); assert.equal(f.timers.size, 0);
});

test('Undo uses a longer lifetime, extends on interaction and clears without waiting for animation', () => {
  const f = fixture({ duration: 12000, pauseOnFocus: false }); f.notice.show();
  assert.equal([...f.timers.values()][0].delay, 12000);
  assert.equal(f.handlers.has('focusin'), false);
  const old = [...f.timers.keys()][0]; f.handlers.get('keydown')();
  assert.equal(f.timers.has(old), false); assert.equal(f.timers.size, 1);
  f.notice.clear(); assert.equal(f.element.hidden, true); assert.equal(f.timers.size, 0);
});
