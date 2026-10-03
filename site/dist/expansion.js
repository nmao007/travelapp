import { playMotion, stopMotion } from './motion.js';

const panels = new WeakMap(), disclosures = new WeakSet();
export const panelIsOpen = element => panels.get(element)?.open ?? !element.hidden;

// Height participates in layout so content below an expander moves with it.
// Rapid reversal starts from the visible height instead of jumping to an end.
export function setPanelOpen(element, open, { animate = true, onComplete = () => {} } = {}) {
  const overflow = panels.get(element)?.overflow ?? element.style.overflow;
  const current = { open, overflow }; panels.set(element, current);
  const from = element.hidden ? 0 : element.getBoundingClientRect().height;
  stopMotion(element); element.hidden = false; element.style.height = 'auto';
  const to = open ? element.getBoundingClientRect().height : 0;
  function finish() {
    if (panels.get(element) !== current) return;
    stopMotion(element); element.hidden = !open; element.style.height = ''; element.style.overflow = overflow; onComplete();
  }
  if (!animate) { finish(); return; }
  element.style.overflow = 'hidden'; element.style.height = `${from}px`;
  const motion = playMotion(element, [{ height: `${from}px`, opacity: from ? 1 : 0 }, { height: `${to}px`, opacity: open ? 1 : 0 }], { duration: 260, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
  if (motion) motion.finished.then(finish).catch(() => {}); else finish();
}

export function enhanceDisclosures(root = document) {
  const candidates = [...(root.matches?.('details') ? [root] : []), ...root.querySelectorAll('details')];
  for (const details of candidates) {
    if (disclosures.has(details)) continue;
    const summary = [...details.children].find(child => child.tagName === 'SUMMARY'); if (!summary) continue;
    const body = document.createElement('div'); body.className = 'disclosure-body'; body.id = `disclosure-${crypto.randomUUID()}`;
    for (const child of [...details.childNodes]) if (child !== summary) body.append(child);
    details.append(body); details.classList.add('coded-disclosure');
    // Some existing summaries already have a chevron; keep one icon per row.
    const oldChevron = summary.querySelector('svg:last-child use[href="#i-chevron"]'); oldChevron?.closest('svg').remove();
    summary.insertAdjacentHTML('beforeend', '<svg class="icon disclosure-chevron" aria-hidden="true"><use href="#i-chevron"/></svg>');
    summary.setAttribute('aria-controls', body.id); summary.setAttribute('aria-expanded', String(details.open)); body.hidden = !details.open;
    let desired = details.open;
    summary.addEventListener('click', event => {
      event.preventDefault(); desired = !desired; details.open = true;
      summary.setAttribute('aria-expanded', String(desired)); details.classList.toggle('disclosure-closing', !desired);
      setPanelOpen(body, desired, { onComplete: () => { details.open = desired; details.classList.remove('disclosure-closing'); } });
    });
    disclosures.add(details);
  }
}
