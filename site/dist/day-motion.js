import { playMotion, stopMotion, reducedMotion, revealSequence } from './motion.js';

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
          const animation = playMotion(snapshot, [{ translate: '0 0', opacity: snapshot.style.opacity }, { translate: `${-direction * 24}px 0`, opacity: 0 }], { duration: 160 });
          const remove = () => { snapshot.remove(); if (outgoing === snapshot) outgoing = null; };
          if (animation) animation.finished.then(remove).catch(remove); else remove();
        }
        incoming = content.querySelector('.selected-day');
        playMotion(incoming, [
          { translate: `${direction * 28}px 0`, opacity: .35 },
          { translate: `${-direction * 2}px 0`, opacity: 1, offset: .78 },
          { translate: '0 0', opacity: 1 },
        ], { duration: 240 });
        const bounds = content.getBoundingClientRect();
        revealSequence([...(incoming?.querySelectorAll('.day-place-card,.transport-card,.flight-main-card') || [])].filter(row => row.getBoundingClientRect().top < bounds.bottom).slice(0, 5), {step:12});
        playMotion(document.querySelector('#phone-day-picker .dropdown-value'), [{opacity:.4,translate:'0 5px'},{opacity:1,translate:'0 0'}], {duration:180});
      };
    },
  };
}
