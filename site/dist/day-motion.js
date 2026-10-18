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
        const copy = section.cloneNode(false);
        Object.assign(copy.style, {position:'relative',top:'0',height:`${content.clientHeight}px`,margin:'0'});
        // Only snapshot what is on screen. A long day no longer clones every
        // address, disclosure and link just to animate a few visible cards.
        for (const child of section.children) {
          const rect = child.getBoundingClientRect();
          if (!rect.height || rect.top > bounds.bottom + 80 || rect.bottom < bounds.top - 80) continue;
          const clone = child.cloneNode(true);
          Object.assign(clone.style, {position:'absolute',left:`${rect.left - bounds.left}px`,top:`${rect.top - bounds.top}px`,width:`${rect.width}px`,margin:'0'});
          copy.append(clone);
        }
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
          const animation = playMotion(snapshot, [{ translate: '0 0', opacity: snapshot.style.opacity }, { translate: `${-direction * 16}px 0`, opacity: 0 }], { duration: 220 });
          const remove = () => { snapshot.remove(); if (outgoing === snapshot) outgoing = null; };
          if (animation) animation.finished.then(remove).catch(remove); else remove();
        }
        incoming = content.querySelector('.selected-day');
        playMotion(incoming, [
          { translate: `${direction * 18}px 0`, opacity: 0 },
          { translate: '0 0', opacity: 1 },
        ], { duration: 240 });
        // Move the whole day as one surface; nested card entrances made text
        // and cards drift at different speeds during rapid day navigation.
        playMotion(document.querySelector('#phone-day-picker .dropdown-value'), [{opacity:.4,translate:'0 5px'},{opacity:1,translate:'0 0'}], {duration:180});
      };
    },
  };
}
