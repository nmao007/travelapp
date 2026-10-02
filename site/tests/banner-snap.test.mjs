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

import { createSnapGestureGate, createHeaderReturnIntent } from '../dist/trip-banner.js';
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

test('reversing direction after a snap releases the gesture without requiring a pause or moving the cursor', () => {
  let time = 0;
  const gate = createSnapGestureGate({ now: () => time });
  gate.begin(1);
  time = 100; assert.equal(gate.consume(true, -20), true);
  time = 300; assert.equal(gate.consume(true, 20), true);
  time = 350; assert.equal(gate.consume(false, 20), true);
  time = 360; assert.equal(gate.consume(false, -20), false);
  gate.begin(-1);
  time = 650; assert.equal(gate.consume(true, -20), true);
  time = 710; assert.equal(gate.consume(false, -20), true);
  time = 720; assert.equal(gate.consume(false, 20), false);
});

test('continued upward scrolling at a panel boundary expands only after deliberate movement', () => {
  let time = 0;
  const intent = createHeaderReturnIntent({ now: () => time });
  assert.equal(intent.consume(-60, 'itinerary'), false);
  time = 20; assert.equal(intent.consume(-60, 'itinerary'), false);
  time = 40; assert.equal(intent.consume(-60, 'itinerary'), true);
  assert.equal(intent.consume(-1, 'itinerary'), false);
  intent.reset(); assert.equal(intent.consume(-120, 'itinerary'), false);
  time = 60; assert.equal(intent.consume(-60, 'itinerary'), true);
});

test('boundary intent does not accumulate across panels, normal list scrolling, pauses or direction changes', () => {
  let time = 0;
  const intent = createHeaderReturnIntent({ now: () => time });
  assert.equal(intent.consume(-60, 'itinerary'), false);
  time = 20; assert.equal(intent.consume(-30, 'explore'), false);
  time = 500; assert.equal(intent.consume(-60, 'explore'), false);
  assert.equal(intent.consume(10, 'explore'), false);
  assert.equal(intent.consume(-30, 'explore'), false);
  intent.reset(); assert.equal(intent.consume(-60, 'explore'), false);
});

test('continuous scrolling hands off to the itinerary after docking without moving the pointer', () => {
  let time = 0;
  const gate = createSnapGestureGate({ now: () => time });
  gate.begin(1);
  time = 450; assert.equal(gate.consume(true, 30, true), true);
  time = 470; assert.equal(gate.consume(false, 30, true), false);
  time = 480; assert.equal(gate.consume(false, 30, true), false);
  // The same residual gesture over the map is still consumed.
  gate.begin(1);
  time = 900; assert.equal(gate.consume(true, 30), true);
  time = 950; assert.equal(gate.consume(false, 30), true);
});
