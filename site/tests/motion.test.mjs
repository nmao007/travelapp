import test from 'node:test';
import assert from 'node:assert/strict';
import { playMotion, morphFrames, morphFrom, revealSequence } from '../dist/motion.js';

test('reduced motion skips both shared-element movement and staggered entrances', () => {
  const previous = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: true });
  try {
    let calls = 0;
    const element = { animate: () => { calls++; }, getBoundingClientRect: () => ({ left: 10, top: 10, width: 400, height: 300 }) };
    assert.equal(playMotion(element, [{ opacity: 0 }, { opacity: 1 }]), null);
    assert.equal(morphFrom(element, { left: 2, top: 4, width: 50, height: 80 }), null);
    revealSequence([element, element]);
    assert.equal(calls, 0);
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
