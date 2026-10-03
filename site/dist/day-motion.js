import { playMotion, stopMotion, reducedMotion } from './motion.js';

// Snapshot only the departing day, keeping the map and scroll containers stable.
export function createDayMotion(content, host) {
  let displayed = null, outgoing = null, incoming = null;
  function clear() {
    if (outgoing) { stopMotion(outgoing); outgoing.remove(); outgoing = null; }
    if (incoming) { stopMotion(incoming); incoming = null; }
  }
  return {
    prepare(next) {
      const previous = displayed;
      const section = content.querySelector('.selected-day');
      const changed = previous?.trip === next.trip && previous.mode === 'day' && next.mode === 'day' && previous.day !== next.day;
      let snapshot = null;
      if (changed && section && !reducedMotion()) {
        const bounds = content.getBoundingClientRect(), parent = host.getBoundingClientRect();
        const visible = getComputedStyle(section);
        snapshot = document.createElement('div'); snapshot.className = 'day-transition-snapshot';
        snapshot.setAttribute('aria-hidden', 'true'); snapshot.inert = true;
        Object.assign(snapshot.style, { left: `${bounds.left - parent.left}px`, top: `${bounds.top - parent.top}px`, width: `${content.clientWidth}px`, height: `${content.clientHeight}px`, opacity: visible.opacity });
        const copy = section.cloneNode(true);
        copy.classList.remove('selected-day');
        // A second click starts from the currently visible incoming day.
        copy.style.transform = visible.transform;
        copy.style.translate = visible.translate;
        copy.style.position = 'relative'; copy.style.top = `${-content.scrollTop}px`;
        for (const element of [copy, ...copy.querySelectorAll('[id]')]) element.removeAttribute('id');
        snapshot.append(copy);
      }
      clear(); displayed = { ...next };
      if (!changed) return () => {};
      content.scrollTop = 0;
      const direction = next.day > previous.day ? 1 : -1;
      return () => {
        if (snapshot) {
          outgoing = snapshot; host.append(snapshot);
          const animation = playMotion(snapshot, [{ translate: '0 0', opacity: snapshot.style.opacity }, { translate: `${-direction * 26}px 0`, opacity: 0 }], { duration: 240 });
          const remove = () => { snapshot.remove(); if (outgoing === snapshot) outgoing = null; };
          if (animation) animation.finished.then(remove).catch(remove); else remove();
        }
        incoming = content.querySelector('.selected-day');
        playMotion(incoming, [{ translate: `${direction * 32}px 0`, opacity: 0 }, { translate: '0 0', opacity: 1 }], { duration: 340 });
      };
    },
  };
}
