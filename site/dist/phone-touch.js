// Mouse input in the device preview behaves like a single finger. Native touch
// input and the map's own pan gestures continue through their normal handlers.
export function enablePhoneTouch(document) {
  const view = document.defaultView, now = () => view.performance.now();
  let gesture = null, suppressClick = false, momentum = 0, dragFrame = 0;
  const stopMomentum = () => { view.cancelAnimationFrame(momentum); momentum = 0; };
  const phone = () => Boolean(document.documentElement.dataset.devicePreview);
  function surfaces(target) {
    const candidates = [];
    for (let el = target; el; el = el.parentElement) {
      const style = view.getComputedStyle(el);
      const horizontalRail = el.matches('.day-tabs,.route-list,.nearby-filters,.plan-sheet .sheet-day-chips');
      const x = horizontalRail && /auto|scroll/.test(style.overflowX) && el.scrollWidth > el.clientWidth + 1;
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
  function paintDrag() {
    view.cancelAnimationFrame(dragFrame); dragFrame = 0;
    if (!phone()) { finish(); return; }
    if (!gesture?.surface) return;
    if (!gesture.pending && gesture.samples.at(-1).time === gesture.lastTime) return;
    const current = gesture, property = current.axis === 'y' ? 'scrollTop' : 'scrollLeft';
    const before = current.surface.el[property], previous = current.samples.at(-1);
    // Apply only the new finger movement. Absolute offsets would undo native
    // scroll anchoring when photos load, and create a dead zone at either edge.
    current.surface.el[property] = before + current.pending; current.pending = 0;
    const moved = current.surface.el[property] - before;
    if (moved && current.direction && Math.sign(moved) !== current.direction) current.samples = [previous];
    if (moved) current.direction = Math.sign(moved);
    current.distance += moved;
    current.samples.push({ time: current.lastTime, position: current.distance });
    current.samples = current.samples.filter(sample => sample.time >= current.lastTime - 100);
  }
  function releaseVelocity(current) {
    const samples = current.samples;
    if (samples.length < 2) return 0;
    const meanTime = samples.reduce((sum, sample) => sum + sample.time, 0) / samples.length;
    const meanPosition = samples.reduce((sum, sample) => sum + sample.position, 0) / samples.length;
    const denominator = samples.reduce((sum, sample) => sum + (sample.time - meanTime) ** 2, 0);
    if (denominator < 32) return 0;
    const velocity = samples.reduce((sum, sample) => sum + (sample.time - meanTime) * (sample.position - meanPosition), 0) / denominator;
    return Math.max(-1.6, Math.min(1.6, velocity));
  }
  function glide(current) {
    if (!current.surface || view.matchMedia('(prefers-reduced-motion:reduce)').matches || now() - current.lastTime > 80) return;
    let velocity = releaseVelocity(current), time = now();
    const property = current.axis === 'y' ? 'scrollTop' : 'scrollLeft';
    function step(timestamp) {
      if (!phone() || !current.surface.el.getClientRects().length || Math.abs(velocity) < .03) { momentum = 0; return; }
      const elapsed = Math.max(0, Math.min(32, timestamp - time)); time = timestamp;
      const decay = Math.exp(-elapsed / 160), before = current.surface.el[property];
      // Integrate the easing curve instead of making a full-speed jump first.
      current.surface.el[property] += velocity * 160 * (1 - decay); velocity *= decay;
      if (elapsed && Math.abs(current.surface.el[property] - before) < .1) { momentum = 0; return; }
      momentum = view.requestAnimationFrame(step);
    }
    if (Math.abs(velocity) >= .03) momentum = view.requestAnimationFrame(step);
  }
  function finish() {
    view.cancelAnimationFrame(dragFrame); dragFrame = 0;
    if (!gesture) return;
    const current = gesture; gesture = null;
    document.documentElement.classList.remove('finger-scrolling');
    if (current.surface?.el.hasPointerCapture(current.id)) current.surface.el.releasePointerCapture(current.id);
  }
  document.addEventListener('pointerdown', event => {
    stopMomentum(); suppressClick = false;
    if (!phone() || event.pointerType !== 'mouse' || event.button !== 0 || gesture) return;
    if (event.target.closest('input,textarea,select,[contenteditable],.google-map,.mobile-drag-handle')) return;
    const candidates = surfaces(event.target), time = now();
    if (candidates.length) gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, candidates, lastTime: time, pending: 0, distance: 0, direction: 0, samples: [{ time, position: 0 }] };
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
      gesture.axis = axis; gesture.lastPosition = axis === 'y' ? gesture.y : gesture.x;
      gesture.surface.el.setPointerCapture(event.pointerId);
      document.documentElement.classList.add('finger-scrolling');
    }
    event.preventDefault(); event.stopImmediatePropagation();
    const position = gesture.axis === 'y' ? event.clientY : event.clientX;
    gesture.pending += gesture.lastPosition - position;
    gesture.lastPosition = position; gesture.lastTime = now();
    if (!dragFrame) dragFrame = view.requestAnimationFrame(paintDrag);
  }, { capture: true, passive: false });
  document.addEventListener('pointerup', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    if (gesture.surface) { suppressClick = true; event.preventDefault(); event.stopImmediatePropagation(); }
    paintDrag(); const current = gesture; finish(); glide(current);
  }, true);
  document.addEventListener('click', event => {
    if (!suppressClick || !event.detail) return;
    suppressClick = false; event.preventDefault(); event.stopImmediatePropagation();
  }, true);
  document.addEventListener('pointercancel', finish, true);
  document.addEventListener('lostpointercapture', finish, true);
  document.addEventListener('wheel', () => { stopMomentum(); finish(); }, { capture: true, passive: true });
  view.addEventListener('blur', () => { stopMomentum(); finish(); });
}
