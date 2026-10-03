export function bannerSnapDestination(offset, previous, limit) {
  if (limit <= 0 || offset <= 1 || offset >= limit - 1) return null;
  return offset > previous ? limit : offset < previous ? 0 : null;
}

// A trackpad gesture can continue after its first wheel event. Keep the entire
// gesture with the snap, even if the pointer moves over a different panel.
export function createSnapGestureGate({ now = () => performance.now(), quietMs = 180 } = {}) {
  let locked = false, last = -Infinity, snapDirection = 0;
  return {
    begin(direction = 0) { locked = true; last = now(); snapDirection = Math.sign(direction); },
    consume(animating = false, direction = 0) {
      // A deliberate reversal must not be mistaken for the previous snap's momentum.
      if (!animating && direction && snapDirection && Math.sign(direction) !== snapDirection) locked = false;
      const time = now(), block = locked && (animating || time - last < quietMs);
      last = time; if (!block) locked = false; return block;
    },
    reset() { locked = false; last = -Infinity; snapDirection = 0; },
  };
}

// Reaching the list's top consumes the rest of this gesture. Header expansion
// starts only after a pause/new gesture, never from the fling that got here.
export function scrollPanelWithinGesture(panel, delta, gesture) {
  const before = panel.scrollTop;
  panel.scrollTop = Math.max(0, Math.min(panel.scrollHeight - panel.clientHeight, before + delta));
  if (delta < 0 && before > 0 && panel.scrollTop <= 1) {
    panel.scrollTop = 0;
    gesture.begin(-1);
  }
}

// Wheel events can stay latched to a scrolling ancestor after the layout moves.
// Resolve the current surface under the pointer rather than that stale target.
export function bannerWheelTarget(event, workspace, hitTest) {
  const target = hitTest(event.clientX, event.clientY) || event.target;
  return workspace.contains(target) ? target : null;
}

// Require deliberate movement before changing banner states. A list first
// reaches its own boundary; a new gesture then counts toward a snap.
export function createHeaderScrollIntent({ now = () => performance.now(), direction = -1, threshold = 450, quietMs = 600 } = {}) {
  let amount = 0, last = -Infinity, source = null;
  function reset() { amount = 0; last = -Infinity; source = null; }
  return {
    reset,
    consume(delta, panel = null) {
      if (Math.sign(delta) !== direction) { reset(); return false; }
      const time = now();
      if (time - last > quietMs || panel !== source) amount = 0;
      source = panel; last = time; amount += Math.abs(delta);
      if (amount < threshold) return false;
      reset(); return true;
    },
  };
}

// The banner keeps its full layout height. Scrolling moves that space away;
// its controls counter that movement to become a small, stable header.
export function createTripBanner({ workspace, header, hero, onResize }) {
  const desktop = matchMedia('(min-width:901px)');
  const phone = matchMedia('(max-width:580px)');
  const gallery = hero.querySelector('.hero-gallery');
  const date = hero.querySelector('.hero-date');
  const thumbnail = document.createElement('div'); thumbnail.className = 'banner-thumbnail'; thumbnail.setAttribute('aria-hidden', 'true'); thumbnail.inert = true; hero.prepend(thumbnail);
  function syncThumbnail() {
    const images = [...gallery.querySelectorAll('img[src]')];
    if (thumbnail.dataset.photos === images.map(image => image.src).join('|')) return;
    thumbnail.dataset.photos = images.map(image => image.src).join('|');
    thumbnail.replaceChildren(...images.map(image => { const copy = image.cloneNode(); copy.hidden = false; copy.removeAttribute('class'); copy.alt = ''; return copy; }));
  }
  new MutationObserver(syncThumbnail).observe(gallery, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  syncThumbnail();
  let frame = 0, travel = 0, origin = 0, dateShift = 0, bodyHeight = 0;
  let motion = 0, snapTarget = null, previousOffset = 0, intentUntil = 0;
  const gesture = createSnapGestureGate();
  const returnIntent = createHeaderScrollIntent();
  const minimizeIntent = createHeaderScrollIntent({ direction: 1, threshold: 240 });
  const resetIntent = () => { returnIntent.reset(); minimizeIntent.reset(); };
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const scrollOffset = () => desktop.matches ? workspace.scrollTop : window.scrollY;
  const scrollLimit = () => desktop.matches ? Math.min(travel, workspace.scrollHeight - workspace.clientHeight) : Math.min(origin + travel, document.documentElement.scrollHeight - window.innerHeight);
  const setOffset = value => { if (desktop.matches) workspace.scrollTop = value; else window.scrollTo({ top: value, behavior: 'instant' }); };
  function snapTo(target) {
    if (snapTarget === target) return;
    cancelAnimationFrame(motion);
    const from = scrollOffset(), start = performance.now();
    snapTarget = target; gesture.begin(target - from); resetIntent(); workspace.classList.add('banner-snapping');
    if (reduced.matches) { setOffset(target); previousOffset = target; snapTarget = null; workspace.classList.remove('banner-snapping'); schedule(); return; }
    function step(time) {
      const t = Math.min(1, (time - start) / 460);
      // Move immediately, then settle without overshooting the panels' boundary.
      const eased = 1 - Math.pow(1 - t, 3);
      setOffset(from + (target - from) * eased);
      previousOffset = scrollOffset();
      update();
      if (t < 1) motion = requestAnimationFrame(step);
      else { setOffset(target); previousOffset = target; motion = 0; snapTarget = null; workspace.classList.remove('banner-snapping'); update(); }
    }
    motion = requestAnimationFrame(step);
  }
  function scroll() {
    const offset = scrollOffset();
    if (snapTarget === null && performance.now() < intentUntil && !workspace.hidden && header.querySelector('#edit-date-picker')?.hidden !== false) {
      const target = bannerSnapDestination(offset, previousOffset, scrollLimit());
      if (target !== null) snapTo(target);
    }
    previousOffset = offset; schedule();
  }
  function wheel(event) {
    // Phone panels use native touch scrolling, with no nested header snap.
    if (phone.matches) return;
    if (workspace.hidden || event.ctrlKey || event.metaKey) { resetIntent(); return; }
    const targetElement = desktop.matches ? bannerWheelTarget(event, workspace, (x, y) => document.elementFromPoint(x, y)) : event.target;
    if (!targetElement || !workspace.contains(targetElement)) return;
    const panel = targetElement.closest('.day-content, .nearby-results, #transport-content');
    if (Math.abs(event.deltaY) < 1 || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    if (gesture.consume(snapTarget !== null, event.deltaY)) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (targetElement.closest('#map, input, textarea, [role=listbox], .dropdown-menu') || header.querySelector('#edit-date-picker')?.hidden === false) { resetIntent(); return; }
    if (desktop.matches) {
      // Keep both scroll containers alive. One owner handles each wheel event,
      // so native scroll chaining and compositor latching cannot bypass a snap.
      event.preventDefault(); event.stopImmediatePropagation();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? (panel || workspace).clientHeight : 1);
      const compact = workspace.classList.contains('banner-compact');
      if (compact && panel && (delta > 0 || panel.scrollTop > 1)) {
        resetIntent(); scrollPanelWithinGesture(panel, delta, gesture); return;
      }
      const target = delta > 0 ? scrollLimit() : 0;
      if (Math.abs(scrollOffset() - target) <= 1) { resetIntent(); return; }
      const intent = delta > 0 ? minimizeIntent : returnIntent;
      (delta > 0 ? returnIntent : minimizeIntent).reset();
      if (intent.consume(delta, delta > 0 ? workspace : panel || workspace)) snapTo(target);
      return;
    }
    let innerScroller = null;
    for (let element = targetElement; element && element !== workspace; element = element.parentElement) {
      const overflow = getComputedStyle(element).overflowY;
      if (/auto|scroll/.test(overflow) && element.scrollHeight > element.clientHeight + 1 && (event.deltaY > 0 ? element.scrollTop < element.scrollHeight - element.clientHeight - 1 : element.scrollTop > 1)) { innerScroller = element; break; }
    }
    if (innerScroller) {
      resetIntent();
      return;
    }
    const limit = scrollLimit();
    if (!desktop.matches && scrollOffset() >= limit + 1) { resetIntent(); return; }
    const target = event.deltaY > 0 ? limit : 0;
    if (Math.abs(scrollOffset() - target) <= 1 && snapTarget === null) { resetIntent(); return; }
    // Keep the header still until enough scroll input accumulates in either
    // direction. Native scroll chaining cannot bypass the threshold.
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? (panel || workspace).clientHeight : 1);
    event.preventDefault(); event.stopImmediatePropagation();
    const intent = delta > 0 ? minimizeIntent : returnIntent;
    (delta > 0 ? returnIntent : minimizeIntent).reset();
    if (intent.consume(delta, delta > 0 ? workspace : panel || workspace)) snapTo(target);
  }
  function update() {
    frame = 0;
    if (workspace.hidden) return;
    const offset = desktop.matches ? workspace.scrollTop : Math.max(0, window.scrollY - origin);
    const shift = Math.min(travel, Math.max(0, offset));
    const progress = travel ? shift / travel : 0;
    workspace.style.setProperty('--banner-progress', String(progress));
    // Let the photo and typography dock just ahead of the scrolling surface.
    workspace.style.setProperty('--banner-morph', String(1 - Math.pow(1 - progress, 2)));
    workspace.style.setProperty('--banner-shift', `${shift}px`);
    workspace.style.setProperty('--banner-date-shift', `${dateShift * progress}px`);
    workspace.style.setProperty('--banner-date-room', `${(date.offsetWidth + 12) * progress}px`);
    const compact = progress >= .995 && (!desktop.matches || workspace.scrollTop >= scrollLimit() - 1);
    workspace.classList.toggle('banner-compact', compact);
    gallery.inert = progress >= .995;
  }
  function schedule() { if (!frame) frame = requestAnimationFrame(update); }
  function measure() {
    if (workspace.hidden) return;
    const compactHeight = parseFloat(getComputedStyle(workspace).getPropertyValue('--banner-compact-height')) || 60;
    travel = phone.matches ? 0 : Math.max(0, hero.offsetHeight - compactHeight);
    workspace.style.setProperty('--banner-travel', `${travel}px`);
    origin = workspace.getBoundingClientRect().top + window.scrollY;
    dateShift = Math.max(0, hero.clientWidth - date.offsetWidth - 62 - 26);
    if (desktop.matches) {
      const styles = getComputedStyle(workspace);
      const height = Math.max(240, workspace.clientHeight - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom) - header.offsetHeight + travel);
      workspace.style.setProperty('--workspace-body-height', `${height}px`);
      if (height !== bodyHeight) { bodyHeight = height; onResize?.(); }
    } else {
      workspace.style.removeProperty('--workspace-body-height');
      if (bodyHeight) { bodyHeight = 0; onResize?.(); }
    }
    schedule();
  }
  const observer = new ResizeObserver(measure);
  for (const element of [workspace, header, date]) observer.observe(element);
  new MutationObserver(measure).observe(workspace, { attributes: true, attributeFilter: ['hidden'] });
  workspace.addEventListener('keydown', event => { if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key) && !event.target.closest('input, textarea, [role=listbox]')) intentUntil = performance.now() + 1000; });
  workspace.addEventListener('touchstart', event => { if (!event.target.closest('#map')) intentUntil = performance.now() + 1500; }, { passive: true });
  workspace.addEventListener('pointerdown', event => { if (event.clientX >= workspace.getBoundingClientRect().right - 12) intentUntil = performance.now() + 1500; });
  workspace.addEventListener('scroll', scroll, { passive: true });
  // Listen above both surfaces, including wheel events latched to the page.
  document.addEventListener('wheel', wheel, { passive: false, capture: true });
  window.addEventListener('scroll', () => desktop.matches ? schedule() : scroll(), { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  desktop.addEventListener('change', measure);
  return { reset() { cancelAnimationFrame(motion); motion = 0; snapTarget = null; gesture.reset(); resetIntent(); workspace.classList.remove('banner-snapping'); previousOffset = 0; workspace.scrollTop = 0; window.scrollTo({ top: 0, behavior: 'instant' }); measure(); } };
}
