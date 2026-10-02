import test from 'node:test';
import assert from 'node:assert/strict';
import { mapLabelPosition } from '../dist/place-model.js';
const overlaps = (a, b) => a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;

test('a crowded hover label chooses a free side without covering its own or a nearby pin', () => {
  const anchor = { left: 150, top: 150, width: 40, height: 40 }, neighbor = { left: 210, top: 130, width: 50, height: 50 }, size = { width: 180, height: 38 };
  const position = mapLabelPosition(anchor, { width: 400, height: 300 }, size, [neighbor]);
  const label = { ...position, ...size };
  assert.equal(overlaps(label, anchor), false); assert.equal(overlaps(label, neighbor), false);
});

test('near a map corner the label stays inside the map and flips to the available side', () => {
  const anchor = { left: 350, top: 14, width: 40, height: 40 }, bounds = { width: 400, height: 300 }, size = { width: 210, height: 50 };
  const position = mapLabelPosition(anchor, bounds, size);
  assert.equal(position.side, 'left');
  assert.ok(position.left >= 10 && position.top >= 10);
  assert.ok(position.left + size.width <= bounds.width - 10 && position.top + size.height <= bounds.height - 10);
  assert.equal(overlaps({ ...position, ...size }, anchor), false);
});
