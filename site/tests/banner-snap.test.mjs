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

import { createSnapGestureGate, createHeaderScrollIntent, scrollPanelWithinGesture, bannerWheelTarget } from '../dist/trip-banner.js';

test('wheel routing follows the unmoved pointer after layout changes even when the browser latches a stale target', () => {
  const page = {}, header = {}, itinerary = {}, outside = {};
  const workspace = { contains: element => element === header || element === itinerary };
  const event = { target: page, clientX: 220, clientY: 580 };
  let surface = header;
  const hitTest = (x, y) => { assert.equal(x, 220); assert.equal(y, 580); return surface; };
  assert.equal(bannerWheelTarget(event, workspace, hitTest), header);
  surface = itinerary;
  assert.equal(bannerWheelTarget(event, workspace, hitTest), itinerary);
  surface = header;
  assert.equal(bannerWheelTarget({ ...event, target: itinerary }, workspace, hitTest), header);
  surface = outside;
  assert.equal(bannerWheelTarget({ ...event, target: itinerary }, workspace, hitTest), null);
  assert.equal(bannerWheelTarget({ ...event, target: itinerary }, workspace, () => null), itinerary);
});
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
  const intent = createHeaderScrollIntent({ now: () => time });
  assert.equal(intent.consume(-120, 'itinerary'), false);
  time = 20; assert.equal(intent.consume(-120, 'itinerary'), false);
  time = 40; assert.equal(intent.consume(-209, 'itinerary'), false);
  time = 50; assert.equal(intent.consume(-1, 'itinerary'), true);
  assert.equal(intent.consume(-1, 'itinerary'), false);
  intent.reset(); assert.equal(intent.consume(-120, 'itinerary'), false);
  time = 60; assert.equal(intent.consume(-330, 'itinerary'), true);
});

test('boundary intent does not accumulate across panels, normal list scrolling, pauses or direction changes', () => {
  let time = 0;
  const intent = createHeaderScrollIntent({ now: () => time });
  assert.equal(intent.consume(-350, 'itinerary'), false);
  time = 20; assert.equal(intent.consume(-200, 'explore'), false);
  time = 700; assert.equal(intent.consume(-350, 'explore'), false);
  assert.equal(intent.consume(10, 'explore'), false);
  assert.equal(intent.consume(-200, 'explore'), false);
  intent.reset(); assert.equal(intent.consume(-350, 'explore'), false);
});

test('minimizing requires accumulated downward scrolling instead of triggering on a small gesture', () => {
  let time = 0;
  const intent = createHeaderScrollIntent({ now: () => time, direction: 1, threshold: 240 });
  assert.equal(intent.consume(10, 'workspace'), false);
  time = 10; assert.equal(intent.consume(120, 'workspace'), false);
  time = 20; assert.equal(intent.consume(109, 'workspace'), false);
  time = 30; assert.equal(intent.consume(1, 'workspace'), true);
  assert.equal(intent.consume(120, 'workspace'), false);
  assert.equal(intent.consume(-20, 'workspace'), false);
  assert.equal(intent.consume(120, 'workspace'), false);
});

test('downward snap momentum cannot scroll the itinerary until a new gesture, even with an unmoved pointer', () => {
  let time = 0;
  const gate = createSnapGestureGate({ now: () => time });
  const panel = { scrollTop: 0, scrollHeight: 3000, clientHeight: 500 };
  gate.begin(1);
  for (const [at, animating, delta] of [[100, true, 900], [450, true, 300], [470, false, 250], [500, false, 120], [620, false, 40]]) {
    time = at;
    if (!gate.consume(animating, delta)) scrollPanelWithinGesture(panel, delta, gate);
  }
  assert.equal(panel.scrollTop, 0);
  time = 850;
  assert.equal(gate.consume(false, 400), false);
  scrollPanelWithinGesture(panel, 400, gate);
  assert.equal(panel.scrollTop, 400);
});

test('a fast upward fling stops at the itinerary top and cannot expand the banner with its remaining momentum', () => {
  let time = 0, expanded = false;
  const gate = createSnapGestureGate({ now: () => time });
  const intent = createHeaderScrollIntent({ now: () => time });
  const panel = { scrollTop: 2500, scrollHeight: 3000, clientHeight: 500 };
  function wheel(delta) {
    if (gate.consume(false, delta)) return;
    if (panel.scrollTop > 0) { intent.reset(); scrollPanelWithinGesture(panel, delta, gate); }
    else if (intent.consume(delta, panel)) expanded = true;
  }
  wheel(-3000);
  assert.equal(panel.scrollTop, 0); assert.equal(expanded, false);
  for (const [at, delta] of [[16, -1000], [32, -700], [48, -400], [120, -200]]) { time = at; wheel(delta); }
  assert.equal(expanded, false);
  time = 400; wheel(-200); assert.equal(expanded, false);
  time = 420; wheel(-250); assert.equal(expanded, true);
});

test('the boundary barrier handles gradual arrival, direction changes and lists shorter than the viewport', () => {
  let time = 0;
  const gate = createSnapGestureGate({ now: () => time });
  const panel = { scrollTop: 80, scrollHeight: 800, clientHeight: 500 };
  scrollPanelWithinGesture(panel, -30, gate); assert.equal(panel.scrollTop, 50);
  assert.equal(gate.consume(false, -30), false);
  scrollPanelWithinGesture(panel, -80, gate); assert.equal(panel.scrollTop, 0);
  time = 20; assert.equal(gate.consume(false, -200), true);
  // A downward reversal stays responsive; it cannot expand the header.
  assert.equal(gate.consume(false, 100), false);
  scrollPanelWithinGesture(panel, 100, gate); assert.equal(panel.scrollTop, 100);
  const short = { scrollTop: 0, scrollHeight: 200, clientHeight: 500 };
  scrollPanelWithinGesture(short, 100, gate); assert.equal(short.scrollTop, 0);
});
