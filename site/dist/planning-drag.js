import { fixedItem, insertPlan } from './itinerary-model.js';
import { playMotion } from './motion.js';

// Real insertion space plus FLIP keeps the layout and the drop position in agreement.
export function createPlanningDrag({ root, tabs, getTrip, commit, onDrop }) {
  let pending = null, drag = null, scrollFrame = 0, suppressClickUntil = 0;
  const rows = () => [...root.querySelectorAll('[data-item-id]')].filter(row => row !== drag?.row);
  const positions = () => new Map(rows().map(row => [row, row.getBoundingClientRect().top]));
  function settle(previous) {
    for (const [row, top] of previous) {
      const delta = top - row.getBoundingClientRect().top;
      if (Math.abs(delta) > 1) playMotion(row, [{ transform: `translateY(${delta}px)` }, { transform: 'none' }], { duration: 180, easing: 'cubic-bezier(.2,.9,.2,1)' });
    }
  }
  function clear() {
    cancelAnimationFrame(scrollFrame);
    const previous = positions(), source = pending?.row, pointer = pending?.pointer;
    if (drag) { drag.row.classList.remove('dragging'); drag.gap.remove(); drag.ghost.remove(); }
    for (const surface of [root, tabs]) surface.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
    drag = null; pending = null; settle(previous);
    if (source?.hasPointerCapture(pointer)) source.releasePointerCapture(pointer);
  }
  root.addEventListener('pointerdown', event => {
    if (event.button !== 0 || event.target.closest('a,input,select,textarea')) return;
    const row = event.target.closest('[data-flexible="true"]');
    const item = getTrip()?.items.find(item => item.id === row?.dataset.itemId);
    if (!row || !item || fixedItem(item)) return;
    pending = { row, id: item.id, pointer: event.pointerId, x: event.clientX, y: event.clientY };
  });
  root.addEventListener('dragstart', event => event.preventDefault());
  function updateTarget(x, y) {
    if (!drag) return;
    const target = document.elementFromPoint(x, y)?.closest('.itinerary-day, .itinerary-cell[data-day], .day-tab');
    for (const surface of [root, tabs]) surface.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
    if (!target || (!root.contains(target) && !tabs.contains(target))) { drag.target = null; return; }
    if (target.classList.contains('itinerary-day')) {
      const candidates = [...target.querySelectorAll('[data-flexible="true"]')].filter(row => row !== drag.row);
      const before = candidates.find(row => { const rect = row.getBoundingClientRect(); return y < rect.top + rect.height / 2; });
      const after = before || target.querySelector('.open-day') || null;
      const previous = positions();
      if (drag.gap.parentElement !== target || drag.gap.nextElementSibling !== after) { target.insertBefore(drag.gap, after); settle(previous); }
      drag.beforeId = before?.dataset.itemId || null;
    } else { target.classList.add('drop-target'); drag.beforeId = null; }
    drag.day = target.dataset.day; drag.target = target;
  }
  document.addEventListener('pointermove', event => {
    if (!pending || event.pointerId !== pending.pointer) return;
    if (!drag && Math.hypot(event.clientX - pending.x, event.clientY - pending.y) < 7) return;
    event.preventDefault();
    if (!drag) {
      const { row, id } = pending, rect = row.getBoundingClientRect();
      const gap = document.createElement('div'); gap.className = 'planning-gap'; gap.setAttribute('aria-hidden', 'true');
      gap.style.height = `${Math.min(120, Math.max(48, rect.height))}px`;
      const ghost = document.createElement('div'); ghost.className = 'drag-ghost'; ghost.setAttribute('aria-hidden', 'true');
      ghost.style.width = `${Math.min(400, rect.width)}px`; ghost.append(row.firstElementChild.cloneNode(true)); document.body.append(ghost);
      drag = { id, row, gap, ghost, day: row.closest('[data-day]').dataset.day, beforeId: null, target: null, offsetX: Math.min(50, pending.x - rect.left), offsetY: 24 };
      row.classList.add('dragging');
      row.setPointerCapture(event.pointerId);
    }
    drag.ghost.style.transform = `translate3d(${event.clientX - drag.offsetX}px,${event.clientY - drag.offsetY}px,0) rotate(-1deg)`;
    updateTarget(event.clientX, event.clientY);
    const rect = root.getBoundingClientRect(), direction = root.contains(document.elementFromPoint(event.clientX, event.clientY)) ? event.clientY < rect.top + 36 ? -1 : event.clientY > rect.bottom - 36 ? 1 : 0 : 0;
    cancelAnimationFrame(scrollFrame);
    if (direction) { const scroll = () => { if (!drag) return; root.scrollTop += direction * 7; updateTarget(event.clientX, event.clientY); scrollFrame = requestAnimationFrame(scroll); }; scrollFrame = requestAnimationFrame(scroll); }
  }, { passive: false });
  document.addEventListener('pointerup', event => {
    if (!pending || event.pointerId !== pending.pointer) return;
    if (!drag) { clear(); return; }
    event.preventDefault(); suppressClickUntil = performance.now() + 350;
    updateTarget(event.clientX, event.clientY);
    const { id, day, beforeId, target, ghost } = drag, source = ghost.getBoundingClientRect();
    const next = target ? insertPlan(getTrip(), id, day, beforeId) : getTrip();
    clear();
    if (next !== getTrip()) {
      commit(next); onDrop(day);
      const row = [...root.querySelectorAll('[data-item-id]')].find(row => row.dataset.itemId === id);
      if (row) { row.scrollIntoView({ block: 'nearest', behavior: 'auto' }); const destination = row.getBoundingClientRect(); playMotion(row, [{ transform: `translate(${Math.max(-35, Math.min(35, source.left - destination.left))}px,${Math.max(-30, Math.min(30, source.top - destination.top))}px) scale(.98)`, background: 'var(--tint)' }, { transform: 'none', background: 'transparent' }], { duration: 230 }); }
    }
  });
  root.addEventListener('click', event => { if (performance.now() < suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); } }, true);
  document.addEventListener('pointercancel', clear);
  root.addEventListener('lostpointercapture', () => { if (pending) clear(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && pending) { suppressClickUntil = performance.now() + 350; clear(); } });
}
