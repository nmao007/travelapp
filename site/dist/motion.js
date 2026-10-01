// Motion stays on compositor properties and respects the system motion preference.
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const active = new WeakMap();
export function playMotion(element, frames, options = {}) {
  if (!element || reducedMotion()) return null;
  active.get(element)?.cancel();
  const animation = element.animate(frames, { duration: 480, easing: 'cubic-bezier(.2,.8,.2,1)', ...options });
  active.set(element, animation);
  animation.finished.then(() => { if (active.get(element) === animation) active.delete(element); }).catch(() => {});
  return animation;
}
export function morphFrames(source, target) {
  if (!source || !target || !target.width || !target.height) return null;
  const x = source.left + source.width / 2 - target.left - target.width / 2;
  const y = source.top + source.height / 2 - target.top - target.height / 2;
  const sx = Math.max(.08, source.width / target.width), sy = Math.max(.08, source.height / target.height);
  return [
    { transform: `translate(${x}px,${y}px) scale(${sx},${sy})`, opacity: .35, borderRadius: '0px', offset: 0 },
    { transform: 'translate(0,0) scale(1.012,.99)', opacity: 1, borderRadius: '0px', offset: .78 },
    { transform: 'translate(0,0) scale(1)', opacity: 1, borderRadius: '0px', offset: 1 },
  ];
}
export function morphFrom(element, source, options = {}) {
  const frames = morphFrames(source, element.getBoundingClientRect());
  return frames ? playMotion(element, frames, { duration: 460, ...options }) : null;
}
export function revealSequence(elements, { delay = 0, step = 45 } = {}) {
  for (const [index, element] of [...elements].entries()) playMotion(element, [
    { opacity: 0, transform: 'translateX(14px) scale(.97)', filter: 'blur(3px)' },
    { opacity: 1, transform: 'translateX(-1px) scale(1.004)', filter: 'blur(0)', offset: .8 },
    { opacity: 1, transform: 'none', filter: 'blur(0)' },
  ], { duration: 500, delay: delay + Math.min(index * step, 240), fill: 'backwards' });
}
