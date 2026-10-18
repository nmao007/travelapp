// Motion stays on compositor properties and respects the system motion preference.
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const active = new WeakMap();
export function stopMotion(element) {
  active.get(element)?.cancel(); active.delete(element);
}
export function playMotion(element, frames, options = {}) {
  if (!element || reducedMotion()) return null;
  stopMotion(element);
  const animation = element.animate(frames, { duration: 300, easing: 'cubic-bezier(.2,.8,.2,1)', ...options });
  active.set(element, animation);
  // A forwards-filled animation still controls styles after it finishes.
  // Retain its handle so callers can release the frozen height or opacity.
  animation.finished.then(() => { if (active.get(element) === animation && !['forwards', 'both'].includes(options.fill)) active.delete(element); }).catch(() => {});
  return animation;
}

const closingDialogs = new WeakMap();
// Keep the open dialog's layout and modal focus until its exit has finished.
export function closeDialogSmooth(dialog) {
  if (!dialog?.open) return Promise.resolve();
  const existing = closingDialogs.get(dialog);
  if (existing) return existing.promise;
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  const entry = { promise }; closingDialogs.set(dialog, entry);
  const current = typeof getComputedStyle === 'function' ? getComputedStyle(dialog) : null;
  const from = { opacity: current?.opacity || 1, transform: current?.transform || 'translateY(0)' };
  dialog.dataset.closing = 'true';
  const externallyClosed = () => finish(false);
  function finish(close) {
    if (closingDialogs.get(dialog) !== entry) return;
    closingDialogs.delete(dialog); dialog.removeEventListener('close', externallyClosed);
    if (close && dialog.open) dialog.close();
    stopMotion(dialog); delete dialog.dataset.closing; resolve();
  }
  dialog.addEventListener('close', externallyClosed);
  const animation = playMotion(dialog, [
    from,
    { opacity: 0, transform: 'translateY(18px)' },
  ], { duration: 160, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
  if (animation) animation.finished.then(() => finish(true)).catch(() => finish(true));
  else finish(true);
  return promise;
}
export function morphFrames(source, target) {
  if (!source || !target || !target.width || !target.height) return null;
  const x = source.left + source.width / 2 - target.left - target.width / 2;
  const y = source.top + source.height / 2 - target.top - target.height / 2;
  const sx = Math.max(.08, source.width / target.width), sy = Math.max(.08, source.height / target.height);
  return [
    { transform: `translate(${x}px,${y}px) scale(${sx},${sy})`, opacity: .35, offset: 0 },
    { transform: 'translate(0,0) scale(1.012,.99)', opacity: 1, offset: .78 },
    { transform: 'translate(0,0) scale(1)', opacity: 1, offset: 1 },
  ];
}
export function morphFrom(element, source, options = {}) {
  const frames = morphFrames(source, element.getBoundingClientRect());
  return frames ? playMotion(element, frames, { duration: 320, ...options }) : null;
}
export function revealSequence(elements, { delay = 0, step = 24 } = {}) {
  for (const [index, element] of [...elements].entries()) playMotion(element, [
    { opacity: 0, transform: 'translateY(7px)' },
    { opacity: 1, transform: 'none' },
  ], { duration: 220, delay: delay + Math.min(index * step, 60), fill: 'backwards' });
}

// Animate the glyph, never the hit area: scrolling and dragging stay stable.
export function animateIllustration(svg) {
  if (!svg) return;
  const art = svg.dataset?.art;
  if (art === 'plane') playMotion(svg, [
    { transform: 'translate(0,0) rotate(0)' }, { transform: 'translate(7px,-5px) rotate(-12deg)', offset: .4 }, { transform: 'translate(-2px,1px) rotate(3deg)', offset: .78 }, { transform: 'none' },
  ], { duration: 360 });
  else playMotion(svg, [{ transform: 'scale(.84) rotate(-3deg)' }, { transform: 'scale(1.12) rotate(3deg)', offset: .58 }, { transform: 'none' }], { duration: 280 });
  const detail = svg.querySelector?.('.art-detail');
  if (detail) playMotion(detail, art === 'stay'
    ? [{ transform: 'translateY(0)' }, { transform: 'translateY(-4px) rotate(-5deg)', offset: .45 }, { transform: 'none' }]
    : [{ transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(-3px) rotate(8deg)', offset: .45 }, { transform: 'none' }], { duration: 320 });
}

export function installButtonMotion(root) {
  let press = null;
  root.addEventListener('pointerdown', event => {
    const button = event.target.closest?.('button');
    press = button && !button.disabled && !button.closest('.mobile-drag-handle,.day-reorder,.workspace-nav')
      ? { button, pointer: event.pointerId, x: event.clientX, y: event.clientY } : null;
  }, { passive: true });
  root.addEventListener('pointerup', event => {
    const current = press; press = null;
    if (!current || event.pointerId !== current.pointer || Math.hypot(event.clientX - current.x, event.clientY - current.y) > 7) return;
    const illustration = current.button.querySelector('.illustrated-icon') || current.button.closest?.('.timeline-row,.day-card-heading,.flight-main-card')?.querySelector('.illustrated-icon');
    if (illustration) { animateIllustration(illustration); return; }
    playMotion(current.button.querySelector('.icon'), [
      { transform: 'scale(.86)' },
      { transform: 'scale(1.1)', offset: .6 },
      { transform: 'scale(1)' },
    ], { duration: 220 });
  }, { passive: true });
  root.addEventListener('pointercancel', () => { press = null; }, { passive: true });
}

export function celebratePlacement(row) {
  if (!row || reducedMotion()) return;
  playMotion(row, [{ opacity: .65, translate: '0 7px' }, { opacity: 1, translate: '0 -2px', offset: .72 }, { opacity: 1, translate: '0 0' }], { duration: 300 });
  animateIllustration(row.querySelector('.illustrated-icon'));
  playMotion(row.querySelector('.place-marker>img'), [{opacity:.4,transform:'translate(16px,-5px) scale(.8)'},{opacity:1,transform:'translate(-2px,1px) scale(1.04)',offset:.7},{opacity:1,transform:'none'}], {duration:320});
  playMotion(row.querySelector('.place-marker'), [{ scale: '.7', rotate: '-10deg' }, { scale: '1.18', rotate: '5deg', offset: .6 }, { scale: '1', rotate: '0deg' }], { duration: 340 });
  const burst = document.createElement('span'); burst.className = 'plan-spark'; burst.setAttribute('aria-hidden', 'true');
  row.append(burst);
  const check = document.createElement('b'); check.className = 'plan-added-check'; check.textContent = '✓'; burst.append(check);
  playMotion(check, [{opacity:0,transform:'translateY(5px) scale(.4)'},{opacity:1,transform:'translateY(-2px) scale(1.15)',offset:.3},{opacity:1,transform:'none',offset:.7},{opacity:0,transform:'translateY(-4px) scale(.9)'}], {duration:440});
  for (const [index, [x, y]] of [[-15, -15], [12, -20], [23, 5]].entries()) {
    const particle = document.createElement('i'); particle.style.setProperty('--spark-color', ['#ff936c', '#4264f5', '#ffdb78'][index]); burst.append(particle);
    const motion = playMotion(particle, [
      { opacity: 0, transform: 'translate(0,0) scale(.4)' },
      { opacity: 1, transform: `translate(${x * .6}px,${y}px) rotate(35deg)`, offset: .35 },
      { opacity: 0, transform: `translate(${x}px,${y + 12}px) rotate(100deg) scale(.6)` },
    ], { duration: 420, delay: index * 25 });
    if (index === 2) { if (motion) motion.finished.then(() => burst.remove()).catch(() => burst.remove()); else burst.remove(); }
  }
}

// Observe only intentional surfaces, never map tiles or the scrolling timeline.
// Opening a menu reveals its choices; replacing search results reveals new rows.
export function installSurfaceMotion(root) {
  const scheduled = new WeakMap();
  const dismiss = event => {
    if (event.defaultPrevented || !event.target.matches?.('dialog')) return;
    event.preventDefault(); closeDialogSmooth(event.target);
  };
  root.addEventListener?.('cancel', dismiss, true);
  const observer = new MutationObserver(records => {
    for (const target of new Set(records.map(record => record.target))) {
      const previous = scheduled.get(target);
      if (previous) cancelAnimationFrame(previous);
      scheduled.set(target, requestAnimationFrame(() => {
        scheduled.delete(target);
        if (!target.isConnected || target.hidden || !target.getClientRects().length) return;
        if (target.matches('dialog') && (!target.open || target.dataset?.closing === 'true')) return;
        if (target.matches('dialog')) {
          // The entire surface is one layer, so its text and background share a clock.
          playMotion(target, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 180 });
        } else {
          playMotion(target, [{ opacity: .2, translate: '0 -5px' }, { opacity: 1, translate: '0 0' }], { duration: 180 });
          revealSequence([...target.children].filter(child => !child.hidden).slice(0, 6), { step: 18 });
        }
      }));
    }
  });
  for (const surface of root.querySelectorAll('dialog,.trip-menu,.suggestions,#flight-results')) {
    observer.observe(surface, { attributes: true, attributeFilter: ['hidden', 'open'], childList: !surface.matches('dialog') });
  }
  return () => { observer.disconnect(); root.removeEventListener?.('cancel', dismiss, true); };
}

// Pointer streams can arrive faster than the display. Paint only the newest one.
export function createFrameScheduler(update, { request = requestAnimationFrame, cancel = cancelAnimationFrame } = {}) {
  let frame = null, latest, queued = false;
  function run() { frame = null; if (!queued) return; const value = latest; queued = false; update(value); }
  return {
    schedule(value) { latest = value; queued = true; if (frame === null) frame = request(run); },
    flush() { if (frame !== null) cancel(frame); frame = null; run(); },
    cancel() { if (frame !== null) cancel(frame); frame = null; queued = false; latest = undefined; },
  };
}
