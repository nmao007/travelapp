import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isPlaced, unplacedItems, placedItems, persistableBoardTrip, withBoardChange, preferLocalBoard,
  createBoardObject, placeExistingIdea, assignToFrame, movePlacedItems, viewportPlacement,
  suggestedFrame, readBoardViewport, writeBoardViewport, stripDeviceViewport, libraryRecord,
  overlaps, VIEWPORT_STORAGE_KEY,
} from '../dist/board-model.js';

const storage = () => {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), values };
};

test('legacy cards with coordinates stay placed; inbox ideas have an explicit unplaced state', () => {
  const trip = persistableBoardTrip({
    boardItems: [
      { id: 'a', type: 'card', title: 'Ramen', x: 120, y: 80, width: 280, height: 310 },
      { id: 'b', type: 'card', title: 'TikTok save', placed: false, url: 'https://www.tiktok.com/@shop/video/1' },
      { id: 'c', type: 'note', title: 'Origin trap', placed: false, x: 0, y: 0 },
    ],
    boardViewport: { x: 40, y: 80, scale: 1.4 },
  });
  assert.equal(trip.boardViewport, undefined);
  assert.equal(isPlaced(trip.boardItems[0]), true);
  assert.equal(trip.boardItems[1].placed, false);
  assert.equal(trip.boardItems[1].x, undefined);
  assert.equal(trip.boardItems[2].placed, false);
  assert.equal(trip.boardItems[2].x, undefined);
  assert.deepEqual(unplacedItems(trip.boardItems).map(item => item.id), ['b', 'c']);
  assert.deepEqual(placedItems(trip.boardItems).map(item => item.id), ['a']);
});

test('creating from outside the canvas goes to inbox; creating on the canvas uses the visible region', () => {
  const inbox = createBoardObject('card', { destination: 'inbox', extras: { url: 'https://example.com/tokyo', title: '' } });
  assert.equal(inbox.placed, false);
  assert.equal(inbox.x, undefined);
  const viewport = { x: -200, y: -80, scale: 1 };
  const canvas = { width: 800, height: 600 };
  const onCanvas = createBoardObject('note', { destination: 'canvas', viewport, canvas, items: [] });
  assert.equal(onCanvas.placed, true);
  assert.ok(Math.abs(onCanvas.x - (400 + 200 - 110)) < 2);
  assert.ok(Math.abs(onCanvas.y - (300 + 80 - 110)) < 2);
});

test('a selected frame becomes the default destination and membership is preserved when the frame moves', () => {
  const frame = { id: 'frame', type: 'group', title: 'Food', placed: true, x: 100, y: 80, width: 500, height: 400, memberIds: [] };
  const created = createBoardObject('card', {
    destination: 'canvas',
    viewport: { x: 0, y: 0, scale: 1 },
    canvas: { width: 400, height: 300 },
    items: [frame],
    selectedIds: ['frame'],
    extras: { title: 'Onigiri' },
  });
  assert.equal(created.groupId, 'frame');
  assert.equal(suggestedFrame([frame], { selectedIds: ['frame'] }).id, 'frame');
  let items = [{ ...frame, memberIds: [created.id] }, created];
  items = movePlacedItems(items, ['frame'], 40, 20);
  assert.equal(items[0].x, 140);
  assert.equal(items[1].x, created.x + 40);
  assert.equal(items[1].y, created.y + 20);
  assert.equal(items[1].groupId, 'frame');
});

test('placing an inbox idea keeps the same record and stores shared coordinates', () => {
  const idea = createBoardObject('card', { destination: 'inbox', extras: { id: 'same', title: 'Saved reel', url: 'https://www.tiktok.com/t/abc' } });
  const placed = placeExistingIdea([idea], 'same', { x: 640, y: 220, width: 280, height: 310 });
  assert.equal(placed.length, 1);
  assert.equal(placed[0].id, 'same');
  assert.equal(placed[0].placed, true);
  assert.equal(placed[0].x, 640);
  assert.equal(placed[0].url, idea.url);
  const inFrame = assignToFrame(placed, 'same', null);
  assert.equal(inFrame[0].groupId, undefined);
});

test('new cards avoid stacking on an occupied viewport center', () => {
  const existing = [{ id: 'one', type: 'card', placed: true, x: 260, y: 190, width: 280, height: 310 }];
  const next = viewportPlacement({ viewport: { x: 0, y: 0, scale: 1 }, canvas: { width: 800, height: 600 }, items: existing, size: { width: 280, height: 310 } });
  assert.equal(overlaps(existing[0], { ...next, width: 280, height: 310 }), false);
});

test('device viewport stays local and newer local board revisions are not overwritten', () => {
  const memory = storage();
  writeBoardViewport('trip-1', { x: 12, y: 40, scale: 1.2 }, memory);
  assert.deepEqual(readBoardViewport('trip-1', memory), { x: 12, y: 40, scale: 1.2 });
  assert.ok(memory.getItem(VIEWPORT_STORAGE_KEY).includes('trip-1'));
  const local = withBoardChange({ id: 't', boardItems: [{ id: 'a', type: 'note', placed: false, title: 'Phone' }], boardRevision: 1 }, { boardItems: [{ id: 'a', type: 'note', placed: true, x: 9, y: 9, width: 220, height: 220, title: 'Phone' }] });
  const remote = { id: 't', boardItems: [{ id: 'a', type: 'note', placed: false, title: 'Phone' }], boardRevision: 1, boardViewport: { x: 99, y: 99, scale: 2 } };
  const merged = preferLocalBoard(local, remote);
  assert.equal(merged.boardItems[0].placed, true);
  assert.equal(merged.boardItems[0].x, 9);
  assert.equal(stripDeviceViewport(remote).boardViewport, undefined);
});

test('personal library records keep identity without canvas coordinates', () => {
  const record = libraryRecord({ id: 'board-copy', libraryIdeaId: 'lib-1', type: 'card', title: 'Cafe', x: 40, y: 40, placed: true, url: 'https://example.com' });
  assert.equal(record.id, 'lib-1');
  assert.equal(record.x, undefined);
  assert.equal(record.title, 'Cafe');
});


test('frame placement starts inside the frame instead of colliding with the frame itself', () => {
  const frame = { id: 'f', type: 'group', placed: true, x: 100, y: 100, width: 650, height: 500, memberIds: [] };
  const idea = createBoardObject('card', { items: [frame], selectedIds: ['f'], canvas: { width: 800, height: 600 } });
  assert.equal(idea.groupId, 'f');
  assert.equal(idea.x, 128); assert.equal(idea.y, 156);
});
