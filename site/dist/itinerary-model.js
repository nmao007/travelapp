import { tourDetails } from './tour-model.js';
import { activityInstant, isDate, isTimeZone } from './domain.js';
import { eventsForTripDay, tripCalendarMonths, tripDates } from './trip-itinerary.js';

export const mappedPlace = item => Number.isFinite(item?.latitude) && Number.isFinite(item?.longitude);
export const fixedItem = item => Boolean(item.booked || item.time || ['Flight', 'Train'].includes(item.kind));
export const datesForTrip = trip => isDate(trip?.startDate) && isDate(trip?.endDate) ? tripDates(trip.startDate, trip.endDate).slice(0, 366) : [];
export const monthsForTrip = trip => datesForTrip(trip).length ? tripCalendarMonths(trip.startDate, trip.endDate) : [];
export const itineraryEventKey = event => event.kind === 'activity' ? `plan:${event.id}` : `transport:${event.id}:${event.leg}`;
const flexibleEvent = event => event.kind === 'activity' && !fixedItem(event.item);
function flightBoundary(event, trip) {
  if (event.kind !== 'transport' || event.transport.mode !== 'Flight') return null;
  const flight = event.transport;
  if (event.leg === 'arrival' || flight.leg === 'arrival') return 'start';
  if (flight.leg === 'home' || flight.leg === 'transfer') return 'end';
  const stops = trip.stops?.length ? trip.stops : [trip], clean = value => String(value || '').trim().toLocaleLowerCase();
  if (stops.some(stop => flight.fromPlaceId === stop.placeId || clean(flight.departure_location) === clean(stop.name))) return 'end';
  if (stops.some(stop => flight.toPlaceId === stop.placeId || clean(flight.arrival_location) === clean(stop.name))) return 'start';
  return flight.departure_date === trip.endDate && trip.endDate !== trip.startDate ? 'end' : 'start';
}
function flightWindow(events, trip) {
  let start = 0, end = events.length;
  events.forEach((event, index) => { const boundary = flightBoundary(event, trip); if (boundary === 'start') start = index + 1; if (boundary === 'end') end = Math.min(end, index); });
  return { start, end };
}
function anchorFlightPlans(events, trip) {
  const fixed = events.filter(event => !flexibleEvent(event)), window = flightWindow(fixed, trip);
  if (window.start > window.end) return events;
  const slots = Array.from({ length: fixed.length + 1 }, () => []);
  let position = 0;
  for (const event of events) {
    if (!flexibleEvent(event)) position++;
    else slots[Math.max(window.start, Math.min(window.end, position))].push(event);
  }
  return slots.flatMap((slot, index) => [...slot, ...(fixed[index] ? [fixed[index]] : [])]);
}

export function eventsForDay(trip, day) {
  const items = (trip.items || []).filter(item => item.day === day);
  const activities = items.map(item => ({ id: item.id, title: item.name, date: item.day, time: item.time || null, time_zone: item.timeZone || trip.timeZone || 'UTC' }));
  const byId = new Map(items.map(item => [item.id, item]));
  const ordered = eventsForTripDay(day, activities, trip.transport || []).map(event => event.kind === 'activity' ? { ...event, item: byId.get(event.id) } : event);
  const savedOrder = trip.dayOrder?.[day];
  if (!savedOrder?.length) return anchorFlightPlans(ordered, trip);
  const rank = new Map(savedOrder.map((key, index) => [key, index]));
  const key = event => event.kind === 'activity' ? `plan:${event.id}` : `transport:${event.id}:${event.leg}`;
  // Keep manually placed flexible plans in their slots, but never let saved
  // drag order reverse the chronology of reservations and transport legs.
  const ranked = ordered.filter(event => event.at === null || rank.has(key(event)))
    .sort((a, b) => (rank.get(key(a)) ?? Number.MAX_SAFE_INTEGER) - (rank.get(key(b)) ?? Number.MAX_SAFE_INTEGER));
  const timed = ranked.filter(event => event.at !== null).sort((a, b) => a.at - b.at);
  let next = 0;
  const result = ranked.map(event => event.at === null ? event : timed[next++]);
  // Newly added transport is absent from an older saved order. Insert it by
  // time rather than appending a 3 AM arrival after the day's activities.
  for (const event of ordered.filter(event => event.at !== null && !rank.has(key(event)))) {
    const later = result.findIndex(other => other.at !== null && other.at > event.at);
    const previous = result.findLastIndex(other => other.at !== null);
    result.splice(later >= 0 ? later : previous + 1, 0, event);
  }
  return anchorFlightPlans(result, trip);
}

// The preview and persisted order use exactly the same flight boundaries.
export function planDropPosition(trip, sourceId, day, beforeKey = null) {
  if (beforeKey && !/^(plan|transport):/.test(beforeKey)) beforeKey = `plan:${beforeKey}`;
  const source = trip.items?.find(item => item.id === sourceId);
  if (!source || fixedItem(source) || !datesForTrip(trip).includes(day)) return { allowed: false };
  const original = eventsForDay(trip, day), events = original.filter(event => event.kind !== 'activity' || event.id !== sourceId);
  let index = beforeKey ? events.findIndex(event => itineraryEventKey(event) === beforeKey) : events.length;
  if (index < 0) return { allowed: false };
  let { start, end } = flightWindow(events, trip);
  if (source.day === day) {
    const sourceIndex = original.findIndex(event => event.kind === 'activity' && event.id === sourceId);
    const previous = original.slice(0, sourceIndex).findLast(event => event.kind === 'transport');
    const next = original.slice(sourceIndex + 1).find(event => event.kind === 'transport');
    if (previous) start = Math.max(start, events.findIndex(event => itineraryEventKey(event) === itineraryEventKey(previous)) + 1);
    if (next) end = Math.min(end, events.findIndex(event => itineraryEventKey(event) === itineraryEventKey(next)));
  }
  if (start > end) return { allowed: false };
  index = Math.max(start, Math.min(end, index));
  return { allowed: true, beforeKey: events[index] ? itineraryEventKey(events[index]) : null };
}

export function makePlan(trip, input, existing = null) {
  const name = input.name?.trim();
  if (!name || name.length > 160) throw new Error('Give your plan a name, up to 160 characters.');
  const day = input.day || 'ideas', time = input.time || '', timeZone = input.timeZone || trip.timeZone || 'UTC';
  if (day !== 'ideas' && !datesForTrip(trip).includes(day)) throw new Error('Choose a day within the trip.');
  if (time && (day === 'ideas' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) throw new Error('Choose a trip day for a timed plan.');
  if (!isTimeZone(timeZone)) throw new Error('Choose a valid time zone.');
  if (time && activityInstant({ date: day, time, time_zone: timeZone }) === null) throw new Error('That time does not exist when the clocks change.');
  if ((input.notes || '').length > 4000 || (input.address || '').length > 300 || (input.reference || '').length > 160) throw new Error('Shorten the notes, location, or booking reference.');
  return { ...existing, ...(input.placeId && mappedPlace(input) ? { placeId: input.placeId, latitude: input.latitude, longitude: input.longitude } : {}), tour: input.kind === 'Tour' ? tourDetails(input.tour) : undefined, id: existing?.id || crypto.randomUUID(), name, day, time, timeZone, kind: ['Activity', 'Food', 'Stay', 'Flight', 'Train', 'Transport', 'Tour'].includes(input.kind) ? input.kind : 'Activity', booked: Boolean(input.booked), address: input.address?.trim() || '', notes: input.notes?.trim() || '', reference: input.reference?.trim() || '' };
}

export function makeTransport(trip, input, id = crypto.randomUUID()) {
  if (!['Flight', 'Train'].includes(input.mode)) throw new Error('Choose flight or train.');
  for (const [field, limit] of [['service_id', 40], ['departure_location', 240], ['arrival_location', 240]]) {
    if (!input[field]?.trim() || input[field].length > limit) throw new Error('Add the service ID and both airports or stations.');
  }
  const days = datesForTrip(trip);
  for (const leg of ['departure', 'arrival']) {
    if (!days.includes(input[`${leg}_date`])) throw new Error('Keep departure and arrival within the trip dates.');
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input[`${leg}_time`] || '')) throw new Error('Enter both local times.');
    if (!isTimeZone(input[`${leg}_time_zone`])) throw new Error('Choose valid departure and arrival time zones.');
  }
  const departure = activityInstant({ date: input.departure_date, time: input.departure_time, time_zone: input.departure_time_zone });
  const arrival = activityInstant({ date: input.arrival_date, time: input.arrival_time, time_zone: input.arrival_time_zone });
  if (departure === null || arrival === null) throw new Error('A local time does not exist when the clocks change.');
  if (arrival <= departure) throw new Error('Arrival must be after departure, allowing for time zones.');
  if ((input.notes || '').length > 4000) throw new Error('Keep notes under 4,000 characters.');
  return { id, trip_id: trip.id, mode: input.mode, service_id: input.service_id.trim(), departure_location: input.departure_location.trim(), arrival_location: input.arrival_location.trim(), departure_date: input.departure_date, departure_time: input.departure_time, departure_time_zone: input.departure_time_zone, arrival_date: input.arrival_date, arrival_time: input.arrival_time, arrival_time_zone: input.arrival_time_zone, notes: input.notes?.trim() || '' };
}

export function upsertTransport(trip, segment) {
  const transport = trip.transport || [];
  return { ...trip, transport: transport.some(item => item.id === segment.id) ? transport.map(item => item.id === segment.id ? segment : item) : [...transport, segment] };
}

export function duplicatePlan(trip, id, day) {
  const source = (trip.items || []).find(item => item.id === id);
  if (!source) throw new Error('This plan is no longer in the trip.');
  if (fixedItem(source)) throw new Error('Only flexible plans can be duplicated.');
  if (!datesForTrip(trip).includes(day) || day === source.day) throw new Error('Choose another day within your trip.');
  const snapshot = { ...structuredClone(source), id: crypto.randomUUID() };
  delete snapshot.flightData;
  const copy = makePlan(trip, { ...source, day, booked: false, reference: '' }, snapshot);
  const identity = ['day', 'name', 'kind', 'placeId', 'time', 'timeZone', 'notes', 'reference', 'booked'];
  if ((trip.items || []).some(item => identity.every(key => (item[key] || '') === (copy[key] || '')))) throw new Error('That plan is already on this day.');
  return { trip: { ...trip, items: [...(trip.items || []), copy] }, copy };
}

export function reorderPlan(trip, sourceId, targetId) {
  const items = [...(trip.items || [])], source = items.find(item => item.id === sourceId), target = items.find(item => item.id === targetId);
  if (!source || !target || source.id === target.id || fixedItem(source) || fixedItem(target)) return trip;
  const moved = { ...source, day: target.day };
  items.splice(items.indexOf(source), 1);
  items.splice(items.findIndex(item => item.id === target.id), 0, moved);
  const next = insertPlan(trip, sourceId, target.day, `plan:${targetId}`);
  return { ...next, items };
}

// Swap neighboring flexible plans without moving bookings or other days.
export function stepPlan(trip, id, direction) {
  if (!['up', 'down'].includes(direction)) return trip;
  const items = trip.items || [], source = items.find(item => item.id === id);
  if (!source || fixedItem(source) || !datesForTrip(trip).includes(source.day)) return trip;
  const flexible = eventsForDay(trip, source.day).filter(event => event.kind === 'activity' && !fixedItem(event.item)).map(event => event.item);
  const index = flexible.indexOf(source), neighbor = flexible[index + (direction === 'up' ? -1 : 1)];
  if (!neighbor) return trip;
  const events = eventsForDay(trip, source.day), fromEvent = events.findIndex(event => event.id === source.id), toEvent = events.findIndex(event => event.id === neighbor.id);
  if (events.slice(Math.min(fromEvent, toEvent), Math.max(fromEvent, toEvent)).some(event => event.kind === 'transport')) return trip;
  const reordered = [...items], from = items.indexOf(source), to = items.indexOf(neighbor);
  [reordered[from], reordered[to]] = [reordered[to], reordered[from]];
  const dayOrder = { ...(trip.dayOrder || {}) };
  if (dayOrder[source.day]) {
    const keys = [...dayOrder[source.day]], sourceIndex = keys.indexOf(`plan:${source.id}`), neighborIndex = keys.indexOf(`plan:${neighbor.id}`);
    if (sourceIndex >= 0 && neighborIndex >= 0) [keys[sourceIndex], keys[neighborIndex]] = [keys[neighborIndex], keys[sourceIndex]];
    dayOrder[source.day] = keys;
  }
  return { ...trip, items: reordered, dayOrder };
}

export function removeItineraryEvent(trip, collection, id) {
  if (!['items', 'transport'].includes(collection)) throw new Error('Unknown itinerary event.');
  const records = trip[collection] || [], index = records.findIndex(record => record.id === id);
  if (index < 0) throw new Error('This event is no longer in the trip.');
  return {
    trip: { ...trip, [collection]: records.filter(record => record.id !== id) },
    removal: { tripId: trip.id, collection, record: structuredClone(records[index]), index, previousId: records[index - 1]?.id, nextId: records[index + 1]?.id },
  };
}

export function restoreItineraryEvent(trip, removal) {
  if (!removal || trip?.id !== removal.tripId) return trip;
  const { collection, record } = removal;
  if (!['items', 'transport'].includes(collection)) throw new Error('Unknown itinerary event.');
  const records = [...(trip[collection] || [])];
  if (records.some(item => item.id === record.id)) return trip;
  const days = datesForTrip(trip);
  const validDates = collection === 'items' ? record.day === 'ideas' || days.includes(record.day) : [record.departure_date, record.arrival_date].every(day => days.includes(day));
  if (!validDates) throw new Error('Restore the original trip dates to undo this removal.');
  const next = records.findIndex(item => item.id === removal.nextId), previous = records.findIndex(item => item.id === removal.previousId);
  const position = next >= 0 ? next : previous >= 0 ? previous + 1 : Math.min(removal.index, records.length);
  records.splice(position, 0, structuredClone(record));
  return { ...trip, [collection]: records };
}

export function insertPlan(trip, sourceId, day, beforeKey = null) {
  if (beforeKey && !/^(plan|transport):/.test(beforeKey)) beforeKey = `plan:${beforeKey}`;
  const source = (trip.items || []).find(item => item.id === sourceId);
  if (!source || fixedItem(source) || !datesForTrip(trip).includes(day) || beforeKey === `plan:${sourceId}`) return trip;
  const placement = planDropPosition(trip, sourceId, day, beforeKey);
  if (!placement.allowed) return trip;
  beforeKey = placement.beforeKey;
  const keysForDay = date => eventsForDay(trip, date).map(itineraryEventKey);
  const dayOrder = { ...(trip.dayOrder || {}) };
  const sourceKey = `plan:${sourceId}`;
  if (source.day !== day) {
    const prior = keysForDay(source.day).filter(key => key !== sourceKey);
    if (prior.length) dayOrder[source.day] = prior; else delete dayOrder[source.day];
  }
  const target = keysForDay(day).filter(key => key !== sourceKey);
  if (!target.includes(sourceKey)) target.push(sourceKey);
  const before = beforeKey ? target.indexOf(beforeKey) : -1;
  if (beforeKey && before < 0) return trip;
  target.splice(target.indexOf(sourceKey), 1);
  target.splice(beforeKey ? target.indexOf(beforeKey) : target.length, 0, sourceKey);
  dayOrder[day] = target;
  const items = (trip.items || []).filter(item => item.id !== sourceId);
  items.push({ ...source, day });
  return { ...trip, items, dayOrder };
}

// Show complete weeks containing the trip, without weeks that cannot hold its plans.
export function calendarDisplayCells(month, { fullMonth = false } = {}) {
  const [year, number] = month.key.split('-').map(Number);
  const offset = new Date(Date.UTC(year, number - 1, 1)).getUTCDay();
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const tripDays = new Set(month.cells.filter(Boolean));
  const first = month.cells.findIndex(Boolean);
  let last = month.cells.length - 1; while (last >= 0 && !month.cells[last]) last--;
  const firstWeek = Math.floor(first / 7) * 7, lastWeek = Math.floor(last / 7) * 7 + 7;
  const cells = month.cells.map((_, index) => {
    const day = index - offset + 1;
    if (day < 1 || day > count) return null;
    const date = `${month.key}-${String(day).padStart(2, '0')}`;
    return { date, inTrip: tripDays.has(date) };
  });
  return fullMonth ? cells : cells.slice(firstWeek, lastWeek);
}
