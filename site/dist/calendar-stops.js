import { stopSchedule, stopForDay } from './trip-store.js';

const colors = ['#2761df', '#19765e', '#5540ca', '#9a3c6f', '#856016', '#c23e0c'];
export function calendarStops(trip) {
  return stopSchedule(trip).map(entry => ({ ...entry, color: colors[entry.index % colors.length] }));
}
export function calendarStopOnDay(trip, day, entries = calendarStops(trip)) {
  const stop = stopForDay(trip, day);
  return entries.find(entry => entry.stop.placeId === stop?.placeId) || null;
}
export function renderCalendarStops(container, entries, { onEdit, rangeLabel, icon }) {
  container.replaceChildren(); container.hidden = entries.length < 2;
  for (const entry of entries) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'calendar-stop-row';
    button.style.setProperty('--stop-color', entry.color);
    button.setAttribute('aria-label', `Edit ${entry.stop.name} stop dates, ${rangeLabel(entry)}`);
    const index = document.createElement('span'); index.className = 'calendar-stop-index'; index.textContent = String(entry.index + 1);
    const copy = document.createElement('span'); copy.className = 'calendar-stop-copy';
    const name = document.createElement('strong'); name.textContent = entry.stop.name;
    const dates = document.createElement('span'); dates.textContent = rangeLabel(entry);
    copy.append(name, dates); button.append(index, copy); button.insertAdjacentHTML('beforeend', icon('edit'));
    button.addEventListener('click', () => onEdit(entry.stop)); container.append(button);
  }
}
