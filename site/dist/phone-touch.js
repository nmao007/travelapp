// Mouse input in the device preview behaves like a single finger. Native touch
// input and the map's own pan gestures continue through their normal handlers.
export function enablePhoneTouch(document) {
  const view = document.defaultView;
  let gesture = null, suppressClick = false;
  const phone = () => document.documentElement.dataset.devicePreview === 'iphone16';
  function surfaces(target) {
    const candidates = [];
    for (let el = target; el; el = el.parentElement) {
      const style = view.getComputedStyle(el);
      const x = /auto|scroll/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 1;
      const y = /auto|scroll/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 1;
      if (x || y) candidates.push({ el, x, y });
    }
    const el = document.scrollingElement;
    if (el && !candidates.some(surface => surface.el === el)) {
      const style = view.getComputedStyle(document.body);
      if (style.overflowY !== 'hidden' && el.scrollHeight > view.innerHeight + 1) candidates.push({ el, x: false, y: true });
    }
    return candidates;
  }
  function finish() {
    if (!gesture) return;
    const current = gesture; gesture = null;
    document.documentElement.classList.remove('finger-scrolling');
    if (current.surface?.el.hasPointerCapture(current.id)) current.surface.el.releasePointerCapture(current.id);
  }
  document.addEventListener('pointerdown', event => {
    suppressClick = false;
    if (!phone() || event.pointerType !== 'mouse' || event.button !== 0 || gesture) return;
    if (event.target.closest('input,textarea,select,[contenteditable],.google-map,.mobile-drag-handle')) return;
    const candidates = surfaces(event.target);
    if (candidates.length) gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, candidates };
  }, true);
  document.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (!phone()) { finish(); return; }
    const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
    if (!gesture.surface) {
      if (Math.hypot(dx, dy) < 7) return;
      const axis = Math.abs(dy) >= Math.abs(dx) ? 'y' : 'x';
      gesture.surface = gesture.candidates.find(surface => surface[axis]);
      if (!gesture.surface) { finish(); return; }
      gesture.axis = axis;
      gesture.left = gesture.surface.el.scrollLeft; gesture.top = gesture.surface.el.scrollTop;
      gesture.surface.el.setPointerCapture(event.pointerId);
      document.documentElement.classList.add('finger-scrolling');
    }
    event.preventDefault(); event.stopImmediatePropagation();
    if (gesture.axis === 'y') gesture.surface.el.scrollTop = gesture.top - dy;
    else gesture.surface.el.scrollLeft = gesture.left - dx;
  }, { capture: true, passive: false });
  document.addEventListener('pointerup', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (gesture.surface) { suppressClick = true; event.preventDefault(); event.stopImmediatePropagation(); }
    finish();
  }, true);
  document.addEventListener('click', event => {
    if (!suppressClick || !event.detail) return;
    suppressClick = false; event.preventDefault(); event.stopImmediatePropagation();
  }, true);
  document.addEventListener('pointercancel', finish, true);
  document.addEventListener('lostpointercapture', finish, true);
  view.addEventListener('blur', finish);
}
