// A finger can explore a board without accidentally moving its contents.
// Timers are invalidated on every exit, including pinch and pointer cancellation.
export function createBoardTouch({ onHold, onPan, onTap, onPending = () => {}, delay = 380, slop = 10, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let current = null, version = 0;
  function cancel() {
    version++;
    if (current?.timer !== undefined) clearTimer(current.timer);
    if (current) onPending(current.context, false);
    current = null;
  }
  return {
    start(point, context) {
      cancel(); const ticket = version;
      current = { point, latest: point, context, mode: 'pending' };
      onPending(context, true);
      current.timer = setTimer(() => {
        if (!current || ticket !== version || current.mode !== 'pending') return;
        current.mode = 'held'; onPending(context, false); onHold(context, current.latest);
      }, delay);
    },
    move(point) {
      if (!current || current.point.id !== point.id) return;
      current.latest = point;
      if (current.mode === 'pending' && Math.hypot(point.x - current.point.x, point.y - current.point.y) > slop) {
        clearTimer(current.timer); version++; current.mode = 'pan';
        onPending(current.context, false); onPan(current.context, point);
      }
    },
    end(point, cancelled = false) {
      if (!current || current.point.id !== point.id) return;
      const previous = current;
      cancel();
      if (!cancelled && previous.mode === 'pending') onTap(previous.context);
    },
    cancel,
  };
}
