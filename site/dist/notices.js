import { playMotion, stopMotion } from './motion.js';

// Versions prevent a finishing exit or an old timeout from dismissing a newer
// message. Timers pause while someone is interacting with the notification.
export function createTransientNotice(element, { duration = 7000, onHide = () => {}, pauseOnFocus = true, animate = playMotion, stop = stopMotion, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let timer = null, version = 0, hovered = false, focused = false, visible = false;
  function cancelTimer() { if (timer !== null) clearTimer(timer); timer = null; }
  function finish(current) {
    if (current !== version) return;
    visible = false; element.hidden = true; stop(element); onHide();
  }
  function dismiss() {
    cancelTimer(); if (!visible) return;
    const current = ++version;
    const animation = animate(element, [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '0 6px' }], { duration: 240, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
    if (animation) animation.finished.then(() => finish(current)).catch(() => {});
    else finish(current);
  }
  function schedule() {
    cancelTimer();
    if (visible && !hovered && !focused) {
      const current = version;
      timer = setTimer(() => { timer = null; if (current === version) dismiss(); }, duration);
    }
  }
  function show() {
    version++; cancelTimer(); stop(element); visible = true; element.hidden = false;
    animate(element, [{ opacity: 0, translate: '0 8px' }, { opacity: 1, translate: '0 0' }], { duration: 200 });
    schedule();
  }
  function clear() { cancelTimer(); stop(element); finish(++version); }
  element.addEventListener('pointerenter', () => { hovered = true; cancelTimer(); });
  element.addEventListener('pointerleave', () => { hovered = false; schedule(); });
  if (pauseOnFocus) {
    element.addEventListener('focusin', () => { focused = true; cancelTimer(); });
    element.addEventListener('focusout', event => { focused = element.contains(event.relatedTarget); schedule(); });
  }
  element.addEventListener('keydown', schedule);
  return { show, clear, dismiss };
}
