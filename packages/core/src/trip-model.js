// Pure trip editing rules shared by the web app and the native app.
// Nothing here touches storage, the network, or the page.
import { assertFlightAvailability } from './flight-window.js';
import { fixedItem, datesForTrip } from './itinerary-model.js';
import { isDate, activityInstant } from './domain.js';
import { dateOffset, offsetDate } from './trip-dates.js';
import { persistableBoardTrip } from './board-model.js';

export function isTrip(value) {
  return Boolean(value && typeof value === 'object' && typeof value.id === 'string' &&
    typeof value.placeId === 'string' && typeof value.name === 'string' &&
    Number.isFinite(value.latitude) && Number.isFinite(value.longitude));
}

export function tripStops(trip) {
  const primary = { placeId: trip.placeId, name: trip.name, address: trip.address || '', latitude: trip.latitude, longitude: trip.longitude, ...(trip.timeZone ? { timeZone: trip.timeZone } : {}) };
  const stops = Array.isArray(trip.stops) ? trip.stops.filter(stop => stop?.placeId && stop?.name && Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude)) : [];
  const unique = [...new Map([primary, ...stops].map(stop => [stop.placeId, stop])).values()];
  return unique.length ? unique : [primary];
}

// Departure can share a day with the next arrival; that day belongs to the
// arriving stop in the itinerary, while both stays retain their travel date.
export function stopSchedule(trip, stops = tripStops(trip)) {
  return stops.map((stop, index) => {
    const start = isDate(stop.date) ? stop.date : index === 0 && isDate(trip.startDate) ? trip.startDate : null;
    const next = stops.slice(index + 1).find(item => isDate(item.date));
    const end = start ? (isDate(stop.endDate) ? stop.endDate : next?.date || (isDate(trip.endDate) ? trip.endDate : start)) : null;
    return { stop, index, start, end };
  });
}

export function stopForDay(trip, day, stops = tripStops(trip)) {
  if (!isDate(day)) return null;
  return stopSchedule(trip, stops).filter(entry => entry.start && entry.start <= day && entry.end >= day)
    .sort((a, b) => b.start.localeCompare(a.start) || b.index - a.index)[0]?.stop || null;
}

// A transfer day may belong to two stays. Remember an activity's destination
// after route edits so moving back and forth never reassigns it to its neighbor.
export function stopForPlan(trip, item) {
  const assigned = item.routeStopId && stopSchedule(trip).find(entry => entry.stop.placeId === item.routeStopId && isDate(item.day) && entry.start <= item.day && entry.end >= item.day);
  return assigned?.stop || stopForDay(trip, item.day);
}

export function datesForStop(trip, placeId) {
  const entry = stopSchedule(trip).find(entry => entry.stop.placeId === placeId);
  return entry?.start ? datesForTrip(trip).filter(day => day >= entry.start && day <= entry.end) : [];
}

export function setStopDates(trip, placeId, start, end, { extendTrip = false } = {}) {
  if (extendTrip) {
    if (!isDate(start) || !isDate(end)) throw new Error('Choose arrival and departure dates.');
    if (end < start) throw new Error('Departure must be on or after arrival.');
    const startDate = isDate(trip.startDate) && trip.startDate < start ? trip.startDate : start;
    const endDate = isDate(trip.endDate) && trip.endDate > end ? trip.endDate : end;
    if ((Date.parse(endDate) - Date.parse(startDate)) / 86400000 >= 366) throw new Error('Keep the trip within one year.');
    // Preserve earlier stays when a new destination extends the journey.
    // In-range transfers can still share a day with the previous stop.
    trip = { ...trip, startDate, endDate, stops: stopSchedule(trip).map(entry => entry.stop.placeId === placeId ? entry.stop : {
      ...entry.stop,
      ...(entry.start ? { date: entry.start } : {}),
      ...(entry.end && endDate > trip.endDate && entry.end < start ? { endDate: entry.end } : {})
    }) };
  }
  const days = datesForTrip(trip), stops = tripStops(trip), index = stops.findIndex(stop => stop.placeId === placeId);
  if (index < 0) throw new Error('Choose a stop on this trip.');
  if (!days.includes(start) || !days.includes(end)) throw new Error('Keep stop dates within the trip dates.');
  if (end < start) throw new Error('Departure must be on or after arrival.');
  const previous = stops.slice(0, index).map((stop, position) => ({ ...stop, date: stop.date || (position === 0 ? trip.startDate : null) })).filter(stop => stop.date).at(-1), next = stops.slice(index + 1).find(stop => stop.date);
  if ((previous?.date || (index === 1 ? trip.startDate : null)) > start || previous?.endDate > start) throw new Error('Arrival must be on or after the previous stop’s departure.');
  if (next?.date && end > next.date) throw new Error('Departure must be on or before the next stop’s arrival.');
  return { ...trip, stops: stops.map((stop, position) => position === index ? { ...stop, date: start, endDate: end } : stop) };
}

function withStops(trip, stops) {
  const [first] = stops;
  return { ...trip, placeId: first.placeId, name: first.name, address: first.address || '', latitude: first.latitude, longitude: first.longitude, ...(first.timeZone ? { timeZone: first.timeZone } : {}), stops };
}

export function addStop(trip, stop) {
  if (!isTrip(trip) || !stop?.placeId || !stop?.name || !Number.isFinite(stop.latitude) || !Number.isFinite(stop.longitude)) throw new Error('Choose a destination.');
  const stops = tripStops(trip);
  if (stops.some(item => item.placeId === stop.placeId)) return trip;
  if (stops.length >= 20) throw new Error('A trip can have up to 20 destinations.');
  return withStops(trip, [...stops, stop]);
}

// Rebuild a route from each stay's own duration, rather than swapping city
// names into someone else's dates. Build and validate before persisting anything.
export function reorderStops(trip, order) {
  const stops = tripStops(trip), ids = stops.map(stop => stop.placeId);
  if (!Array.isArray(order) || order.length !== ids.length || new Set(order).size !== ids.length || order.some(id => !ids.includes(id))) throw new Error('Include each stop once.');
  if (order.every((id, index) => id === ids[index])) return trip;
  const entries = stopSchedule(trip), byId = new Map(entries.map(entry => [entry.stop.placeId, entry]));
  if (entries.every(entry => !entry.start)) return withStops(trip, order.map(id => byId.get(id).stop));
  if (entries.some(entry => !entry.start || !entry.end || entry.end < entry.start)) throw new Error('Set dates for every stop before changing the route.');
  const gaps = entries.slice(1).map((entry, index) => dateOffset(entries[index].end, entry.start));
  if (gaps.some(gap => gap < 0)) throw new Error('Resolve overlapping stop dates before changing the route.');
  let cursor = entries[0].start;
  const moved = order.map((id, index) => {
    const entry = byId.get(id), date = cursor, endDate = offsetDate(date, dateOffset(entry.start, entry.end));
    cursor = offsetDate(endDate, gaps[index] || 0);
    return { ...entry.stop, date, endDate };
  });
  const offsets = new Map(moved.map(stop => [stop.placeId, dateOffset(byId.get(stop.placeId).start, stop.date)]));
  const items = (trip.items || []).map(item => {
    const owner = stopForPlan(trip, item);
    return owner ? { ...item, day: offsetDate(item.day, offsets.get(owner.placeId)), routeStopId: owner.placeId, ...(item.timeZone || owner.timeZone || trip.timeZone ? { timeZone: item.timeZone || owner.timeZone || trip.timeZone } : {}) } : item;
  });
  const itemDays = new Map(items.map(item => [`plan:${item.id}`, item.day]));
  const dayOrder = {};
  for (const [day, keys] of Object.entries(trip.dayOrder || {})) for (const key of keys) {
    const target = itemDays.get(key) || day;
    const bucket = dayOrder[target] ||= [];
    if (!bucket.includes(key)) bucket.push(key);
  }
  const next = { ...withStops(trip, moved), items, ...(trip.dayOrder ? { dayOrder } : {}) };
  for (const item of items) {
    if (isDate(item.day) && item.time && activityInstant({ date: item.day, time: item.time, time_zone: item.timeZone || stopForDay(next, item.day)?.timeZone || next.timeZone || 'UTC' }) === null) throw new Error(`Adjust the time for ${item.name} before moving it across a clock change.`);
    assertFlightAvailability(next, item);
  }
  // Booked journeys are real reservations. Keep them intact; obsolete generated
  // connection prompts will be rebuilt for the new neighboring destinations.
  if (trip.transport) next.transport = trip.transport.filter(segment => !segment.draft || !['transfer', 'arrival', 'home'].includes(segment.leg));
  return next;
}

export function moveStop(trip, index, direction) {
  const order = tripStops(trip).map(stop => stop.placeId), target = index + direction;
  if (!Number.isInteger(index) || !Number.isInteger(target) || index < 0 || index >= order.length || target < 0 || target >= order.length) return trip;
  [order[index], order[target]] = [order[target], order[index]];
  return reorderStops(trip, order);
}

export function removeStop(trip, placeId) {
  const stops = tripStops(trip);
  if (stops.length === 1) throw new Error('A trip needs at least one destination.');
  const next = stops.filter(stop => stop.placeId !== placeId);
  if (next.length === stops.length) return trip;
  return withStops(trip, next);
}


export function addPlace(trip, place) {
  if (!isTrip(trip) || !place?.placeId || !place?.name) throw new Error('Choose a place.');
  if (trip.items?.some(item => item.placeId === place.placeId && item.day === place.day)) return trip;
  assertFlightAvailability(trip, place);
  return { ...trip, items: [...(trip.items || []), { id: crypto.randomUUID(), ...place }] };
}

export function removePlace(trip, itemId) {
  return { ...trip, items: (trip.items || []).filter(item => item.id !== itemId) };
}

export function movePlace(trip, itemId, day) {
  if (trip.items?.some(item => item.id === itemId && fixedItem(item))) return trip;
  const source = trip.items?.find(item => item.id === itemId);
  if (source) assertFlightAvailability(trip, { ...source, day });
  return { ...trip, items: (trip.items || []).map(item => item.id === itemId ? { ...item, day } : item) };
}

export const tripTitle = trip => trip.title?.trim() || tripStops(trip).map(stop => stop.name).join(' → ');
export function renameTrip(trip, title) {
  const value = String(title || '').trim();
  if (!value || value.length > 120) throw new Error('Use a trip title between 1 and 120 characters.');
  return { ...trip, title: value };
}

// The saved shape of a trip: stops resolved and list fields present.
export function normalizeTrip(trip) {
  return persistableBoardTrip({ ...trip, stops: tripStops(trip), items: Array.isArray(trip.items) ? trip.items : [] });
}
