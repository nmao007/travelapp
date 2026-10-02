import { directionsMapsURL } from './maps-links.js';
import { dayRouteLegs, routePoint, routeKey, routeModes, travelLabel, travelConflict, decodePolyline } from './day-route-model.js';

const node = (tag, className, text) => { const element = document.createElement(tag); element.className = className; if (text) element.textContent = text; return element; };
export function createDayRoutes({ state, commit, icon, cancelCamera }) {
  let version = 0, timer, lines = [], fittedKey = '';
  const cache = new Map();
  const clearLines = () => { lines.forEach(line => line.setMap(null)); lines = []; };
  function clear() { version++; clearTimeout(timer); clearLines(); fittedKey = ''; }
  async function lookup(leg, mode) {
    const key = routeKey(leg, mode), saved = cache.get(key);
    if (saved && saved.expires > Date.now()) return saved.promise;
    const promise = fetch('/api/route', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ origin: routePoint(leg.from), destination: routePoint(leg.to), mode }) }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Directions unavailable.'); return data;
    });
    cache.set(key, { promise, expires: Date.now() + (mode === 'WALK' ? 600000 : 60000) });
    if (cache.size > 100) cache.delete(cache.keys().next().value);
    try { return await promise; } catch (error) { cache.delete(key); throw error; }
  }
  function fit(paths) {
    if (!state.map || !paths.length) return;
    const bounds = new google.maps.LatLngBounds(); paths.flat().forEach(point => bounds.extend(point));
    cancelCamera(); state.map.fitBounds(bounds, 65);
  }
  function render() {
    const current = ++version; clearTimeout(timer); clearLines();
    if (!state.trip || state.planMode !== 'day' || state.workspaceView !== 'itinerary') { fittedKey = ''; return; }
    const section = document.querySelector('.selected-day');
    if (!section) return;
    section.querySelectorAll('.day-route-bar,.travel-leg,.route-notice').forEach(element => element.remove());
    const legs = dayRouteLegs(state.trip, state.day); if (!legs.length) { fittedKey = ''; return; }
    const mode = routeModes[state.trip.routeMode] ? state.trip.routeMode : 'WALK';
    const bar = node('div', 'day-route-bar'), controls = node('div', 'route-modes'); controls.setAttribute('role', 'group'); controls.setAttribute('aria-label', 'Travel mode');
    for (const [value, details] of Object.entries(routeModes)) {
      const button = node('button', 'route-mode'); button.type = 'button'; button.innerHTML = icon(details.icon);
      button.setAttribute('aria-label', details.label); button.title = details.label; button.setAttribute('aria-pressed', String(value === mode));
      button.addEventListener('click', () => { if (mode !== value) commit({ ...state.trip, routeMode: value }); }); controls.append(button);
    }
    const total = node('span', 'route-total', 'Calculating…'); total.setAttribute('role', 'status');
    bar.append(controls, total); section.querySelector('.itinerary-day-heading').after(bar);
    if (mode === 'TRANSIT') bar.after(node('p', 'route-notice', 'Transit estimates use current schedules.'));
    const holders = legs.map(leg => {
      const holder = node('div', 'travel-leg'); holder.dataset.routeKey = leg.key;
      holder.append(node('span', 'travel-loading', 'Calculating…'));
      const target = [...section.querySelectorAll('[data-item-id]')].find(row => row.dataset.itemId === leg.to.id); target?.before(holder); return holder;
    });
    timer = setTimeout(async () => {
      const results = await Promise.allSettled(legs.map(leg => lookup(leg, mode)));
      if (current !== version || !section.isConnected) return;
      const routes = [], paths = []; let seconds = 0, meters = 0, unavailable = 0;
      results.forEach((result, index) => {
        const holder = holders[index], leg = legs[index]; holder.replaceChildren();
        if (result.status === 'rejected' || !result.value.available) {
          unavailable++; holder.append(node('span', 'travel-unavailable', result.status === 'rejected' ? result.reason.message : 'No route found.')); return;
        }
        const route = result.value; let path;
        try { path = decodePolyline(route.polyline); } catch { unavailable++; holder.append(node('span', 'travel-unavailable', 'Route geometry unavailable.')); return; }
        routes.push(route); paths.push(path); seconds += route.seconds; meters += route.meters;
        const details = node('details', 'travel-directions'), summary = node('summary', 'travel-summary');
        summary.innerHTML = icon(routeModes[mode].icon); summary.append(node('span', '', travelLabel(route.seconds, route.meters))); summary.insertAdjacentHTML('beforeend', icon('chevron'));
        summary.setAttribute('aria-label', `${routeModes[mode].label} from ${leg.from.name} to ${leg.to.name}, ${travelLabel(route.seconds, route.meters)}`);
        details.append(summary);
        const steps = node('ol', 'route-steps');
        for (const step of route.steps) {
          const text = step.line ? `${step.line}${step.headsign ? ` toward ${step.headsign}` : ''}${step.departureStop ? ` · ${step.departureStop} → ${step.arrivalStop}` : ''}` : step.instruction;
          if (text) steps.append(node('li', '', text));
        }
        if (steps.children.length) details.append(steps);
        const mapsLink = node('a', 'detail-chip', 'Google Maps'); mapsLink.href = directionsMapsURL(leg.to, leg.from, mode); mapsLink.target = '_blank'; mapsLink.rel = 'noopener noreferrer'; mapsLink.insertAdjacentHTML('afterbegin', icon('external')); details.append(mapsLink);
        for (const warning of route.warnings) details.append(node('p', 'route-warning', warning));
        if (travelConflict(leg, route.seconds, state.trip)) details.append(node('p', 'route-warning', 'Travel time exceeds the gap between these plans.'));
        details.addEventListener('toggle', () => { if (details.open) fit([path]); }); holder.append(details);
      });
      total.textContent = routes.length ? `${travelLabel(seconds, meters)}${unavailable ? ' · partial' : ''}` : 'Directions unavailable';
      total.title = 'Total travel between mapped stops';
      if (!state.map || !paths.length) return;
      const routeColor = getComputedStyle(document.documentElement).getPropertyValue(`--route-${mode.toLowerCase()}`).trim();
      for (const path of paths) lines.push(new google.maps.Polyline({ map: state.map, path, strokeColor: routeColor, strokeOpacity: .85, strokeWeight: 5, clickable: false, zIndex: 1 }));
      const key = JSON.stringify([state.trip.id, state.day, mode, legs.map(leg => routeKey(leg, mode))]);
      if (key !== fittedKey) { fit(paths); fittedKey = key; }
      const fitButton = node('button', 'route-fit'); fitButton.type = 'button'; fitButton.innerHTML = icon('directions'); fitButton.title = 'Show day route'; fitButton.setAttribute('aria-label', 'Show day route'); fitButton.addEventListener('click', () => fit(paths)); bar.append(fitButton);
    }, 180);
  }
  return { render, clear };
}
