import { fixedItem, insertPlan } from './itinerary-model.js';
import { playMotion, stopMotion } from './motion.js';

const motionKey = element => element.dataset.itemId ? `plan:${element.dataset.itemId}` : element.dataset.motionKey;
const motionElements = root => [...root.querySelectorAll('[data-item-id], [data-motion-key]')];
export function capturePlanningLayout(root) {
  return new Map(motionElements(root).filter(element => element.getClientRects().length).map(element => [motionKey(element), element.getBoundingClientRect()]));
}
export function animatePlanningLayout(root, previous) {
  for (const element of motionElements(root)) {
    const before = previous.get(motionKey(element));
    if (!element.getClientRects().length) continue;
    if (!before) { element.classList.add('planning-settled'); playMotion(element, [{ opacity: 0, translate: '0 8px' }, { opacity: 1, translate: '0 0' }], { duration: 240 }); continue; }
    // Cancel old movement before measuring layout, preserving the captured
    // visual position when another gap move interrupts an animation.
    stopMotion(element); element.classList.add('planning-settled');
    const after = element.getBoundingClientRect(), x = before.left - after.left, y = before.top - after.top;
    if (Math.abs(x) + Math.abs(y) > 1) playMotion(element, [{ transform: `translate(${x}px,${y}px)` }, { transform: 'none' }], { duration: 240, easing: 'cubic-bezier(.2,.85,.25,1)' });
  }
}

// A full-size placeholder replaces the source, then every affected row and day
// heading follows the gap. The keyed layout survives a complete redraw.
export function createPlanningDrag({ root, tabs, getTrip, commit, onDrop }) {
  let pending = null, drag = null, scrollFrame = 0, suppressClickUntil = 0;
  function clearTargets() { for (const surface of [root, tabs]) surface.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target')); }
  function landGhost(ghost, row) {
    if (!row) { const motion = playMotion(ghost, [{ opacity: 1 }, { opacity: 0, scale: '.94' }], { duration: 180 }); if (motion) motion.finished.then(() => ghost.remove()).catch(() => ghost.remove()); else ghost.remove(); return; }
    row.classList.add('planning-settled');
    const destination = row.getBoundingClientRect();
    const motion = playMotion(ghost, [
      { transform: ghost.style.transform, opacity: 1 },
      { transform: `translate3d(${destination.left}px,${destination.top}px,0) rotate(0deg)`, opacity: .8, offset: .75 },
      { transform: `translate3d(${destination.left}px,${destination.top}px,0) rotate(0deg)`, opacity: 0 },
    ], { duration: 320, easing: 'cubic-bezier(.2,.85,.25,1)' });
    playMotion(row, [{ opacity: .35, background: 'var(--tint)' }, { opacity: 1, background: 'transparent' }], { duration: 360 });
    const landed = () => {
      ghost.remove();
      if (!root.contains(row)) return;
      const bounds = root.getBoundingClientRect(), rect = row.getBoundingClientRect();
      const offset = rect.top < bounds.top ? rect.top - bounds.top : rect.bottom > bounds.bottom ? Math.min(rect.top - bounds.top, rect.bottom - bounds.bottom) : 0;
      if (offset) root.scrollTo({ top: root.scrollTop + offset, behavior: 'smooth' });
    };
    if (motion) motion.finished.then(landed).catch(() => ghost.remove()); else landed();
  }
  function finish(drop = false) {
    cancelAnimationFrame(scrollFrame);
    if (!drag) { pending = null; return; }
    suppressClickUntil = performance.now() + 400;
    const current = drag, pointer = pending.pointer, previous = capturePlanningLayout(root), trip = getTrip(), scrollTop = root.scrollTop;
    const next = drop && current.target ? insertPlan(trip, current.id, current.day, current.beforeId) : trip;
    current.row.classList.remove('dragging'); current.gap.remove(); clearTargets();
    drag = null; pending = null;
    if (current.row.hasPointerCapture(pointer)) current.row.releasePointerCapture(pointer);
    try { if (next !== trip) { commit(next); onDrop(current.day); } }
    finally {
      const row = motionElements(root).find(element => element.dataset.itemId === current.id);
      root.scrollTop = scrollTop;
      animatePlanningLayout(root, previous); landGhost(current.ghost, row);
    }
  }
  root.addEventListener('pointerdown', event => {
    if (pending || event.button !== 0 || event.target.closest('a,input,select,textarea,.day-reorder')) return;
    // Swiping the card scrolls. Only the dedicated grip starts a touch drag.
    if ((event.pointerType === 'touch' || document.documentElement.dataset.devicePreview === 'iphone16') && !event.target.closest('.mobile-drag-handle')) return;
    const row = event.target.closest('[data-flexible="true"]');
    const item = getTrip()?.items.find(item => item.id === row?.dataset.itemId);
    if (!row || !item || fixedItem(item)) return;
    pending = { row, id: item.id, pointer: event.pointerId, x: event.clientX, y: event.clientY };
  });
  root.addEventListener('dragstart', event => event.preventDefault());
  function updateTarget(x, y) {
    if (!drag) return;
    const target = document.elementFromPoint(x, y)?.closest('.itinerary-day, .itinerary-cell[data-day], .day-tab');
    clearTargets();
    if (!target || (!root.contains(target) && !tabs.contains(target))) { drag.target = null; return; }
    if (target.classList.contains('itinerary-day')) {
      const candidates = [...target.querySelectorAll('[data-flexible="true"]')].filter(row => row !== drag.row);
      const before = candidates.find(row => { const rect = row.getBoundingClientRect(); return y < rect.top + rect.height / 2; });
      const after = before || target.querySelector('.open-day') || null;
      if (drag.gap.parentElement !== target || drag.gap.nextElementSibling !== after) {
        const previous = capturePlanningLayout(root), gapBefore = drag.gap.isConnected ? drag.gap.getBoundingClientRect() : null;
        target.insertBefore(drag.gap, after); animatePlanningLayout(root, previous); stopMotion(drag.gap);
        const gapAfter = drag.gap.getBoundingClientRect();
        playMotion(drag.gap, [{ opacity: .6, transform: gapBefore ? `translate(${gapBefore.left - gapAfter.left}px,${gapBefore.top - gapAfter.top}px)` : 'none' }, { opacity: 1, transform: 'none' }], { duration: 220 });
      }
      drag.beforeId = before?.dataset.itemId || null;
    } else {
      if (drag.gap.isConnected) { const previous = capturePlanningLayout(root); drag.gap.remove(); animatePlanningLayout(root, previous); }
      target.classList.add('drop-target'); drag.beforeId = null;
    }
    drag.day = target.dataset.day; drag.target = target;
  }
  document.addEventListener('pointermove', event => {
    if (!pending || event.pointerId !== pending.pointer) return;
    if (!drag && Math.hypot(event.clientX - pending.x, event.clientY - pending.y) < 7) return;
    event.preventDefault();
    if (!drag) {
      const { row, id } = pending, rect = row.getBoundingClientRect(), style = getComputedStyle(row), previous = capturePlanningLayout(root);
      const gap = document.createElement('div'); gap.className = 'planning-gap'; gap.setAttribute('aria-hidden', 'true');
      gap.style.height = `${rect.height}px`; gap.style.minHeight = '0'; gap.style.marginTop = style.marginTop; gap.style.marginBottom = style.marginBottom;
      const ghost = document.createElement('div'); ghost.className = 'drag-ghost'; ghost.setAttribute('aria-hidden', 'true');
      ghost.style.width = `${Math.min(400, rect.width)}px`; ghost.append(row.firstElementChild.cloneNode(true)); document.body.append(ghost);
      drag = { id, row, gap, ghost, day: row.closest('[data-day]').dataset.day, beforeId: null, target: null, offsetX: Math.min(Math.min(400, rect.width) - 12, pending.x - rect.left), offsetY: Math.min(ghost.getBoundingClientRect().height - 12, pending.y - rect.top) };
      row.before(gap); row.setPointerCapture(event.pointerId); row.classList.add('dragging');
      previous.delete(`plan:${id}`); animatePlanningLayout(root, previous);
      playMotion(ghost, [{ opacity: .4 }, { opacity: 1 }], { duration: 160 });
    }
    drag.ghost.style.transform = `translate3d(${event.clientX - drag.offsetX}px,${event.clientY - drag.offsetY}px,0) rotate(-1deg)`;
    updateTarget(event.clientX, event.clientY);
    const rect = root.getBoundingClientRect(), direction = root.contains(document.elementFromPoint(event.clientX, event.clientY)) ? event.clientY < rect.top + 36 ? -1 : event.clientY > rect.bottom - 36 ? 1 : 0 : 0;
    cancelAnimationFrame(scrollFrame);
    if (direction) { const scroll = () => { if (!drag) return; root.scrollTop += direction * 7; updateTarget(event.clientX, event.clientY); scrollFrame = requestAnimationFrame(scroll); }; scrollFrame = requestAnimationFrame(scroll); }
  }, { passive: false });
  document.addEventListener('pointerup', event => {
    if (!pending || event.pointerId !== pending.pointer) return;
    if (!drag) { pending = null; return; }
    event.preventDefault(); updateTarget(event.clientX, event.clientY); finish(true);
  });
  root.addEventListener('click', event => { if (performance.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
  document.addEventListener('pointercancel', () => finish());
  root.addEventListener('lostpointercapture', () => { if (pending) finish(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && pending) finish(); });
}
