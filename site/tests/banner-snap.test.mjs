import test from 'node:test';
import assert from 'node:assert/strict';
import { bannerSnapDestination } from '../dist/trip-banner.js';

test('a small scroll selects the complete banner position in either direction', () => {
  assert.equal(bannerSnapDestination(3, 0, 184), 184);
  assert.equal(bannerSnapDestination(180, 184, 184), 0);
  assert.equal(bannerSnapDestination(0, 20, 184), null);
  assert.equal(bannerSnapDestination(184, 20, 184), null);
  assert.equal(bannerSnapDestination(20, 20, 184), null);
  assert.equal(bannerSnapDestination(3, 0, 0), null);
});

import { createSnapGestureGate } from '../dist/trip-banner.js';
test('the snap consumes the whole trackpad gesture across panels but allows the next deliberate scroll', () => {
  let time = 0;
  const gate = createSnapGestureGate({ now: () => time });
  assert.equal(gate.consume(), false);
  gate.begin();
  time = 20; assert.equal(gate.consume(true), true);
  time = 700; assert.equal(gate.consume(true), true);
  // Momentum reaches the map after the animation ends; it stays consumed.
  time = 840; assert.equal(gate.consume(false), true);
  time = 920; assert.equal(gate.consume(false), true);
  time = 1200; assert.equal(gate.consume(false), false);
  gate.begin(); gate.reset(); assert.equal(gate.consume(), false);
});
