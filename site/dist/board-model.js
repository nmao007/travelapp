export const CONTENT_TYPES = ['card', 'photo', 'note'];
export const FRAME_TYPE = 'group';
export const VIEWPORT_STORAGE_KEY = 'trippilot-site-board-view-v1';
export const BOARD_SCALE_MIN = 0.3;
export const BOARD_SCALE_MAX = 2.4;
const palette = ['sun', 'rose', 'mint', 'sky', 'lilac'];

export function isContentIdea(item) {
  return CONTENT_TYPES.includes(item?.type);
}

export function isPlaced(item) {
  if (!item || typeof item !== 'object') return false;
  if (item.placed === false) return false;
  if (item.placed === true) return Number.isFinite(item.x) && Number.isFinite(item.y);
  if (!isContentIdea(item)) return Number.isFinite(item.x) && Number.isFinite(item.y);
  return Number.isFinite(item.x) && Number.isFinite(item.y);
}

export function unplacedItems(items = []) {
  return items.filter(item => isContentIdea(item) && !isPlaced(item));
}

export function placedItems(items = []) {
  return items.filter(isPlaced);
}

export function defaultSize(type) {
  if (type === FRAME_TYPE) return { width: 430, height: 320 };
  if (type === 'note') return { width: 220, height: 220 };
  if (type === 'photo') return { width: 260, height: 250 };
  if (type === 'sticker') return { width: 82, height: 82 };
  return { width: 280, height: 310 };
}

export function ideaContent(item) {
  if (!item || typeof item !== 'object') return {};
  return Object.fromEntries(['id', 'type', 'title', 'sticker', 'image', 'url', 'sourceUrl', 'preview', 'location', 'category', 'notes', 'color', 'libraryIdeaId'].filter(key => item[key] !== undefined).map(key => [key, item[key]]));
}

export function normalizeBoardItem(item, index = 0) {
  if (!item || typeof item !== 'object' || typeof item.id !== 'string' || !item.type) return null;
  const base = { ...item, id: item.id, type: item.type };
  if (isContentIdea(base) && !isPlaced(base)) {
    const { x, y, groupId, groupOffset, memberIds, ...rest } = base;
    const size = defaultSize(base.type);
    return { ...rest, placed: false, width: Number.isFinite(base.width) ? base.width : size.width, height: Number.isFinite(base.height) ? base.height : size.height, color: base.color || palette[index % palette.length] };
  }
  const size = defaultSize(base.type);
  const placed = {
    ...base,
    placed: true,
    x: Number.isFinite(base.x) ? base.x : 80 + (index % 5) * 28,
    y: Number.isFinite(base.y) ? base.y : 80 + (index % 4) * 26,
    width: Number.isFinite(base.width) ? base.width : size.width,
    height: Number.isFinite(base.height) ? base.height : size.height,
  };
  if (placed.type === 'draw' && !Array.isArray(placed.points)) placed.points = [];
  return placed;
}

export function normalizeBoardItems(items) {
  if (!Array.isArray(items)) return [];
  return items.map((item, index) => normalizeBoardItem(item, index)).filter(Boolean);
}

export function normalizeBoardLinks(links, items = []) {
  const ids = new Set(items.map(item => item.id));
  return (Array.isArray(links) ? links : []).filter(link => link && typeof link.id === 'string' && ids.has(link.from) && ids.has(link.to));
}

export function stripDeviceViewport(trip) {
  if (!trip || typeof trip !== 'object') return trip;
  const { boardViewport, ...rest } = trip;
  return rest;
}

export function persistableBoardTrip(trip) {
  if (!trip || typeof trip !== 'object') return trip;
  const items = normalizeBoardItems(trip.boardItems);
  return stripDeviceViewport({ ...trip, boardItems: items, boardLinks: normalizeBoardLinks(trip.boardLinks, items) });
}

export function withBoardChange(trip, patch, now = () => new Date().toISOString()) {
  return persistableBoardTrip({
    ...trip,
    ...patch,
    boardRevision: (Number(trip.boardRevision) || 0) + 1,
    boardUpdatedAt: now(),
  });
}

export function preferLocalBoard(local, remote) {
  if (!local || !remote) return remote || local;
  if ((Number(local.boardRevision) || 0) > (Number(remote.boardRevision) || 0)) {
    return persistableBoardTrip({
      ...remote,
      boardItems: local.boardItems,
      boardLinks: local.boardLinks,
      boardRevision: local.boardRevision,
      boardUpdatedAt: local.boardUpdatedAt,
    });
  }
  return persistableBoardTrip(remote);
}

export function readBoardViewport(tripId, storage) {
  const fallback = { x: 0, y: 0, scale: 1 };
  if (!tripId || !storage?.getItem) return fallback;
  try {
    const all = JSON.parse(storage.getItem(VIEWPORT_STORAGE_KEY) || '{}');
    const value = all?.[tripId];
    const scale = Number(value?.scale);
    return {
      x: Number(value?.x) || 0,
      y: Number(value?.y) || 0,
      scale: Number.isFinite(scale) && scale >= BOARD_SCALE_MIN && scale <= BOARD_SCALE_MAX ? scale : 1,
    };
  } catch { return fallback; }
}

export function writeBoardViewport(tripId, viewport, storage) {
  if (!tripId || !storage?.setItem) return viewport;
  let all = {};
  try { all = JSON.parse(storage.getItem(VIEWPORT_STORAGE_KEY) || '{}') || {}; } catch { all = {}; }
  const next = { x: Number(viewport?.x) || 0, y: Number(viewport?.y) || 0, scale: Number(viewport?.scale) || 1 };
  storage.setItem(VIEWPORT_STORAGE_KEY, JSON.stringify({ ...all, [tripId]: next }));
  return next;
}

export function canvasCenter(viewport, canvas) {
  const scale = viewport?.scale || 1;
  return {
    x: ((canvas?.width || 0) / 2 - (viewport?.x || 0)) / scale,
    y: ((canvas?.height || 0) / 2 - (viewport?.y || 0)) / scale,
  };
}

export function overlaps(a, b, gap = 16) {
  return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap && a.y + a.height + gap > b.y;
}

export function avoidOverlap(position, existing, size) {
  const placed = existing.filter(isPlaced).filter(item => item.type !== 'draw');
  let x = position.x, y = position.y;
  for (let step = 0; step < 24; step++) {
    const candidate = { x, y, width: size.width, height: size.height };
    if (!placed.some(item => overlaps(candidate, item))) return { x, y };
    x += 28; y += 26;
  }
  return { x, y };
}

export function suggestedFrame(items, { selectedIds = [], point = null } = {}) {
  const frames = (items || []).filter(item => item.type === FRAME_TYPE && isPlaced(item));
  const selected = frames.filter(item => selectedIds.includes(item.id));
  if (selected.length === 1) return selected[0];
  if (point) return frames.find(frame => point.x >= frame.x && point.x <= frame.x + frame.width && point.y >= frame.y && point.y <= frame.y + frame.height) || null;
  return null;
}

export function placementInFrame(frame, size, existing) {
  const origin = { x: frame.x + 28, y: frame.y + 56 };
  return avoidOverlap(origin, existing.filter(item => item.groupId === frame.id || item.id === frame.id), size);
}

export function viewportPlacement({ viewport, canvas, items = [], selectedIds = [], size, type }) {
  const center = canvasCenter(viewport, canvas);
  const frame = suggestedFrame(items, { selectedIds, point: center });
  const raw = { x: center.x - size.width / 2, y: center.y - size.height / 2 };
  const position = frame ? placementInFrame(frame, size, items) : avoidOverlap(raw, items, size);
  return { ...position, width: size.width, height: size.height, groupId: frame?.id, type };
}

export function unplacedIdea(type, extras = {}, index = 0) {
  const size = defaultSize(type);
  return normalizeBoardItem({
    id: extras.id || crypto.randomUUID(),
    type,
    title: extras.title ?? (type === 'card' ? '' : type === 'photo' ? 'Travel photo' : 'New thought'),
    placed: false,
    width: size.width,
    height: size.height,
    category: extras.category || 'Activity',
    color: extras.color || palette[index % palette.length],
    image: extras.image || '',
    url: extras.url || '',
    location: extras.location || '',
    notes: extras.notes || '',
    ...extras,
  }, index);
}

export function placedIdea(type, placement, extras = {}, index = 0) {
  return normalizeBoardItem({
    ...unplacedIdea(type, extras, index),
    placed: true,
    x: placement.x,
    y: placement.y,
    width: placement.width,
    height: placement.height,
    ...(placement.groupId ? { groupId: placement.groupId } : {}),
  }, index);
}

export function createBoardObject(type, options = {}) {
  const items = options.items || [];
  const size = defaultSize(type);
  if (options.destination === 'inbox' && isContentIdea({ type })) return unplacedIdea(type, options.extras || {}, items.length);
  const placement = viewportPlacement({
    viewport: options.viewport || { x: 0, y: 0, scale: 1 },
    canvas: options.canvas || { width: 800, height: 600 },
    items,
    selectedIds: options.selectedIds || [],
    size,
    type,
  });
  if (type === 'sticker') {
    const sticker = options.extras?.sticker || '✨';
    return placedIdea('sticker', placement, { title: sticker, sticker, width: size.width, height: size.height }, items.length);
  }
  const item = placedIdea(type, placement, options.extras || {}, items.length);
  if (placement.groupId) {
    item.groupId = placement.groupId;
    const frame = items.find(entry => entry.id === placement.groupId);
    if (frame) item.groupOffset = { x: item.x - frame.x, y: item.y - frame.y };
  }
  return item;
}

export function placeExistingIdea(items, id, placement) {
  const next = items.map(item => ({ ...item }));
  const item = next.find(entry => entry.id === id);
  if (!item) return items;
  Object.assign(item, { placed: true, x: placement.x, y: placement.y, width: placement.width || item.width || defaultSize(item.type).width, height: placement.height || item.height || defaultSize(item.type).height });
  return assignToFrame(next, id, placement.groupId || null);
}

export function assignToFrame(items, id, frameId) {
  const next = items.map(item => ({ ...item, memberIds: Array.isArray(item.memberIds) ? [...item.memberIds] : item.memberIds }));
  const item = next.find(entry => entry.id === id);
  if (!item || item.type === FRAME_TYPE || item.type === 'draw') return next;
  if (item.groupId && item.groupId !== frameId) {
    const previous = next.find(entry => entry.id === item.groupId);
    if (previous) previous.memberIds = (previous.memberIds || []).filter(memberId => memberId !== id);
  }
  if (!frameId) {
    delete item.groupId;
    delete item.groupOffset;
    return next;
  }
  const frame = next.find(entry => entry.id === frameId && entry.type === FRAME_TYPE);
  if (!frame) return next;
  item.groupId = frameId;
  item.groupOffset = { x: item.x - frame.x, y: item.y - frame.y };
  frame.memberIds = [...new Set([...(frame.memberIds || []), id])];
  return next;
}

export function movePlacedItems(items, ids, dx, dy) {
  const moving = new Set(ids);
  for (const item of items) {
    if (item.type === FRAME_TYPE && ids.includes(item.id)) {
      for (const memberId of item.memberIds || []) moving.add(memberId);
    }
  }
  return items.map(item => {
    if (!moving.has(item.id) || !isPlaced(item)) return item;
    if (item.type === 'draw') return { ...item, points: (item.points || []).map(point => ({ x: point.x + dx, y: point.y + dy })) };
    const next = { ...item, x: item.x + dx, y: item.y + dy };
    if (next.groupId) {
      const frame = items.find(entry => entry.id === next.groupId);
      if (frame && !moving.has(frame.id)) next.groupOffset = { x: next.x - frame.x, y: next.y - frame.y };
    }
    return next;
  });
}

export function fitFrame(items, frame) {
  const members = items.filter(item => frame.memberIds?.includes(item.id) && isPlaced(item));
  if (!members.length) return frame;
  const left = Math.min(...members.map(item => item.x)) - 24;
  const top = Math.min(...members.map(item => item.y)) - 48;
  const right = Math.max(...members.map(item => item.x + item.width));
  const bottom = Math.max(...members.map(item => item.y + item.height));
  frame.x = left;
  frame.y = top;
  frame.width = right - left + 48;
  frame.height = bottom - top + 24;
  for (const member of members) member.groupOffset = { x: member.x - frame.x, y: member.y - frame.y };
  return frame;
}

export function boardSnapshotData(trip) {
  const persisted = persistableBoardTrip(trip || {});
  return JSON.stringify({ boardItems: persisted.boardItems || [], boardLinks: persisted.boardLinks || [] });
}

export function libraryRecord(item) {
  return ideaContent({ ...item, id: item.libraryIdeaId || item.id });
}
