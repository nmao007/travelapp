import test from 'node:test';
import assert from 'node:assert/strict';
import { capturePlanningLayout, animatePlanningLayout } from '../dist/planning-drag.js';

function element(key, top, { item = false, hidden = false } = {}) {
  const node = { dataset: item ? { itemId: key } : { motionKey: key }, top, offset: 0, hidden, frames: [], classList: { add() {} }, getClientRects() { return this.hidden ? [] : [{}]; }, getBoundingClientRect() { return { left: 20, top: this.top + this.offset, width: 300, height: 48 }; }, animate(frames) { this.frames.push(frames); this.offset = 0; return { finished: new Promise(() => {}), cancel: () => { this.offset = 0; } }; } };
  return node;
}
const root = nodes => ({ querySelectorAll: () => nodes });

test('gap movement animates fixed rows and day headings as well as flexible plans', () => {
  const previousMedia = globalThis.matchMedia; globalThis.matchMedia = () => ({ matches: false });
  try {
    const nodes = [element('first', 100, { item: true }), element('transport:1', 160), element('heading:next-day', 220)];
    const container = root(nodes), before = capturePlanningLayout(container);
    for (const node of nodes) node.top += 48;
    animatePlanningLayout(container, before);
    for (const node of nodes) assert.equal(node.frames[0][0].transform, 'translate(0px,-48px)');
  } finally { globalThis.matchMedia = previousMedia; }
});

test('drop animation matches new DOM rows by identity and gives newly populated days an entrance', () => {
  const previousMedia = globalThis.matchMedia; globalThis.matchMedia = () => ({ matches: false });
  try {
    const before = capturePlanningLayout(root([element('plan', 100, { item: true }), element('heading:day', 70)]));
    const plan = element('plan', 160, { item: true }), heading = element('heading:day', 120), added = element('heading:new-day', 240);
    animatePlanningLayout(root([plan, heading, added]), before);
    assert.equal(plan.frames[0][0].transform, 'translate(0px,-60px)');
    assert.equal(heading.frames[0][0].transform, 'translate(0px,-50px)');
    assert.equal(added.frames[0][0].opacity, 0);
    assert.equal(added.frames[0].at(-1).opacity, 1);
  } finally { globalThis.matchMedia = previousMedia; }
});

test('interrupted motion uses its current visual position and hidden drag sources are excluded', () => {
  const previousMedia = globalThis.matchMedia; globalThis.matchMedia = () => ({ matches: false });
  try {
    const moving = element('moving', 100, { item: true }), hidden = element('source', 80, { item: true, hidden: true }), container = root([moving, hidden]);
    let before = capturePlanningLayout(container); moving.top = 150; animatePlanningLayout(container, before);
    moving.offset = -20; before = capturePlanningLayout(container);
    assert.equal(before.has('plan:source'), false);
    moving.top = 170; animatePlanningLayout(container, before);
    assert.equal(moving.frames.at(-1)[0].transform, 'translate(0px,-40px)');
    assert.equal(hidden.frames.length, 0);
  } finally { globalThis.matchMedia = previousMedia; }
});

test('reduced motion preserves the final layout without animating rearrangement', () => {
  const previousMedia = globalThis.matchMedia; globalThis.matchMedia = () => ({ matches: true });
  try {
    const node = element('plan', 100, { item: true }), container = root([node]), before = capturePlanningLayout(container);
    node.top = 200; animatePlanningLayout(container, before);
    assert.equal(node.frames.length, 0); assert.equal(node.top, 200);
  } finally { globalThis.matchMedia = previousMedia; }
});
