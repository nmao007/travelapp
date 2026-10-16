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
    { opacity: .55, transform: 'translateY(12px) scale(.985)' },
    { opacity: 1, transform: 'translateY(-2px) scale(1.002)', offset: .78 },
    { opacity: 1, transform: 'none' },
  ], { duration: 260, delay: delay + Math.min(index * step, 100), fill: 'backwards' });
}

// Animate the glyph, never the hit area: scrolling and dragging stay stable.
export function installButtonMotion(root) {
  let press = null;
  root.addEventListener('pointerdown', event => {
    const button = event.target.closest?.('button');
    press = button && !button.disabled && !button.closest('.mobile-drag-handle,.day-reorder')
      ? { button, pointer: event.pointerId, x: event.clientX, y: event.clientY } : null;
  }, { passive: true });
  root.addEventListener('pointerup', event => {
    const current = press; press = null;
    if (!current || event.pointerId !== current.pointer || Math.hypot(event.clientX - current.x, event.clientY - current.y) > 7) return;
    playMotion(current.button.querySelector('.icon'), [
      { transform: 'scale(.8) rotate(-8deg)' },
      { transform: 'scale(1.18) rotate(5deg)', offset: .55 },
      { transform: 'scale(1) rotate(0)' },
    ], { duration: 220 });
  }, { passive: true });
  root.addEventListener('pointercancel', () => { press = null; }, { passive: true });
}

export function celebratePlacement(row) {
  if (!row || reducedMotion()) return;
  playMotion(row, [{ opacity: .65, translate: '0 7px' }, { opacity: 1, translate: '0 -2px', offset: .72 }, { opacity: 1, translate: '0 0' }], { duration: 300 });
  playMotion(row.querySelector('.place-marker'), [{ scale: '.7', rotate: '-10deg' }, { scale: '1.18', rotate: '5deg', offset: .6 }, { scale: '1', rotate: '0deg' }], { duration: 340 });
  const burst = document.createElement('span'); burst.className = 'plan-spark'; burst.setAttribute('aria-hidden', 'true');
  row.append(burst);
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
