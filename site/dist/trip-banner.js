export function bannerSnapDestination(offset, previous, limit) {
  if (limit <= 0 || offset <= 1 || offset >= limit - 1) return null;
  return offset > previous ? limit : offset < previous ? 0 : null;
}

// A trackpad gesture can continue after its first wheel event. Keep the entire
// gesture with the snap, even if the pointer moves over a different panel.
export function createSnapGestureGate({ now = () => performance.now(), quietMs = 180 } = {}) {
  let locked = false, last = -Infinity;
  return {
    begin() { locked = true; last = now(); },
    consume(animating = false) {
      const time = now(), block = locked && (animating || time - last < quietMs);
      last = time; if (!block) locked = false; return block;
    },
    reset() { locked = false; last = -Infinity; },
  };
}

// The banner keeps its full layout height. Scrolling moves that space away;
// its controls counter that movement to become a small, stable header.
export function createTripBanner({ workspace, header, hero, onResize }) {
  const desktop = matchMedia('(min-width:901px)');
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
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const scrollOffset = () => desktop.matches ? workspace.scrollTop : window.scrollY;
  const scrollLimit = () => desktop.matches ? Math.min(travel, workspace.scrollHeight - workspace.clientHeight) : Math.min(origin + travel, document.documentElement.scrollHeight - window.innerHeight);
  const setOffset = value => { if (desktop.matches) workspace.scrollTop = value; else window.scrollTo({ top: value, behavior: 'instant' }); };
  function snapTo(target) {
    if (snapTarget === target) return;
    cancelAnimationFrame(motion);
    snapTarget = target; gesture.begin(); workspace.classList.add('banner-snapping');
    const from = scrollOffset(), start = performance.now();
    if (reduced.matches) { setOffset(target); previousOffset = target; snapTarget = null; workspace.classList.remove('banner-snapping'); schedule(); return; }
    function step(time) {
      const t = Math.min(1, (time - start) / 880);
      const eased = t * t * (3 - 2 * t);
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
    if (workspace.hidden || event.ctrlKey || event.metaKey) return;
    if (gesture.consume(snapTarget !== null)) { event.preventDefault(); event.stopImmediatePropagation(); return; }
    if (workspace.hidden || Math.abs(event.deltaY) < 1 || event.ctrlKey || event.metaKey || event.target.closest('#map, input, textarea, [role=listbox]') || header.querySelector('#edit-date-picker')?.hidden === false) return;
    // Inner lists keep their own scroll position once the banner is compact.
    for (let element = event.target; element && element !== workspace; element = element.parentElement) {
      const overflow = getComputedStyle(element).overflowY;
      if (/auto|scroll/.test(overflow) && element.scrollHeight > element.clientHeight + 1 && (event.deltaY > 0 ? element.scrollTop < element.scrollHeight - element.clientHeight - 1 : element.scrollTop > 1)) return;
    }
    const limit = scrollLimit();
    if (!desktop.matches && scrollOffset() >= limit + 1) return;
    const target = event.deltaY > 0 ? limit : 0;
    if (Math.abs(scrollOffset() - target) <= 1 && snapTarget === null) return;
    event.preventDefault(); event.stopImmediatePropagation(); snapTo(target);
  }
  function update() {
    frame = 0;
    if (workspace.hidden) return;
    const offset = desktop.matches ? workspace.scrollTop : Math.max(0, window.scrollY - origin);
    const shift = Math.min(travel, Math.max(0, offset));
    const progress = travel ? shift / travel : 0;
    workspace.style.setProperty('--banner-progress', String(progress));
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
    travel = Math.max(0, hero.offsetHeight - 68);
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
  workspace.addEventListener('wheel', wheel, { passive: false, capture: true });
  window.addEventListener('scroll', () => desktop.matches ? schedule() : scroll(), { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  desktop.addEventListener('change', measure);
  return { reset() { cancelAnimationFrame(motion); motion = 0; snapTarget = null; gesture.reset(); workspace.classList.remove('banner-snapping'); previousOffset = 0; workspace.scrollTop = 0; window.scrollTo({ top: 0, behavior: 'instant' }); measure(); } };
}
