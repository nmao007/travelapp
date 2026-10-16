import test from 'node:test';
import assert from 'node:assert/strict';
import { playMotion, stopMotion, morphFrames, morphFrom, revealSequence, celebratePlacement, installButtonMotion } from '../dist/motion.js';

test('reduced motion skips both shared-element movement and staggered entrances', () => {
  const previous = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: true });
  try {
    let calls = 0;
    const element = { animate: () => { calls++; }, getBoundingClientRect: () => ({ left: 10, top: 10, width: 400, height: 300 }) };
    assert.equal(playMotion(element, [{ opacity: 0 }, { opacity: 1 }]), null);
    assert.equal(morphFrom(element, { left: 2, top: 4, width: 50, height: 80 }), null);
    revealSequence([element, element]);
    celebratePlacement(element);
    assert.equal(calls, 0);
  } finally { if (previous) globalThis.matchMedia = previous; else delete globalThis.matchMedia; }
});

test('tap feedback never runs for a swipe, a drag grip, or a cancelled pointer', () => {
  const previous = globalThis.matchMedia; globalThis.matchMedia = () => ({ matches: false });
  try {
    const listeners = new Map(); let animations = 0, grip = false;
    const glyph = { animate: () => { animations++; return { finished: Promise.resolve(), cancel() {} }; } };
    const button = { disabled: false, closest: () => grip, querySelector: () => glyph };
    const event = (x, y) => ({ target: { closest: () => button }, pointerId: 1, clientX: x, clientY: y });
    installButtonMotion({ addEventListener: (name, handler) => listeners.set(name, handler) });
    listeners.get('pointerdown')(event(10, 10)); listeners.get('pointerup')(event(10, 40));
    assert.equal(animations, 0);
    grip = true; listeners.get('pointerdown')(event(10, 10)); listeners.get('pointerup')(event(10, 10));
    assert.equal(animations, 0);
    grip = false; listeners.get('pointerdown')(event(10, 10)); listeners.get('pointercancel')(); listeners.get('pointerup')(event(10, 10));
    assert.equal(animations, 0);
    listeners.get('pointerdown')(event(10, 10)); listeners.get('pointerup')(event(12, 12));
    assert.equal(animations, 1);
  } finally { if (previous) globalThis.matchMedia = previous; else delete globalThis.matchMedia; }
});

test('day-preview movement is bounded and invalid geometry cannot create infinite transforms', () => {
  assert.equal(morphFrames({ left: 0, top: 0, width: 40, height: 30 }, { left: 0, top: 0, width: 0, height: 400 }), null);
  const frames = morphFrames({ left: 600, top: 300, width: 80, height: 100 }, { left: 420, top: 250, width: 430, height: 400 });
  assert.equal(frames.length, 3);
  assert.equal(frames.some(frame => /NaN|Infinity/.test(frame.transform)), false);
  assert.equal(frames.at(-1).opacity, 1);
  const reverse = [...frames].reverse().map(frame => ({ ...frame, offset: 1 - frame.offset }));
  assert.deepEqual(reverse.map(frame => frame.offset), [...reverse.map(frame => frame.offset)].sort((a, b) => a - b));
});

test('finished forwards-filled motion can be cancelled to release frozen layout styles', async () => {
  const previous = globalThis.matchMedia; globalThis.matchMedia = () => ({ matches: false });
  try {
    let cancels = 0;
    const element = { animate: () => ({ finished: Promise.resolve(), cancel: () => cancels++ }) };
    playMotion(element, [{ height: '0px' }, { height: '100px' }], { fill: 'forwards' });
    await Promise.resolve(); stopMotion(element); assert.equal(cancels, 1);
    playMotion(element, [{ opacity: 0 }, { opacity: 1 }], { fill: 'both' });
    await Promise.resolve(); playMotion(element, [{ opacity: 1 }, { opacity: 0 }]); assert.equal(cancels, 2);
  } finally { globalThis.matchMedia = previous; }
});
