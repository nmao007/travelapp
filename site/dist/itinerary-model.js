import { activityInstant, isDate, isTimeZone } from './domain.js';
import { eventsForTripDay, tripCalendarMonths, tripDates } from './trip-itinerary.js';

export const mappedPlace = item => Number.isFinite(item?.latitude) && Number.isFinite(item?.longitude);
export const fixedItem = item => Boolean(item.booked || item.time || ['Flight', 'Train'].includes(item.kind));
export const datesForTrip = trip => isDate(trip?.startDate) && isDate(trip?.endDate) ? tripDates(trip.startDate, trip.endDate).slice(0, 366) : [];
export const monthsForTrip = trip => datesForTrip(trip).length ? tripCalendarMonths(trip.startDate, trip.endDate) : [];

export function eventsForDay(trip, day) {
  const items = (trip.items || []).filter(item => item.day === day);
  const activities = items.map(item => ({ id: item.id, title: item.name, date: item.day, time: item.time || null, time_zone: item.timeZone || trip.timeZone || 'UTC' }));
  const byId = new Map(items.map(item => [item.id, item]));
  return eventsForTripDay(day, activities, trip.transport || []).map(event => event.kind === 'activity' ? { ...event, item: byId.get(event.id) } : event);
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
  return { ...existing, id: existing?.id || crypto.randomUUID(), name, day, time, timeZone, kind: ['Activity', 'Food', 'Stay', 'Flight', 'Train', 'Transport'].includes(input.kind) ? input.kind : 'Activity', booked: Boolean(input.booked), address: input.address?.trim() || '', notes: input.notes?.trim() || '', reference: input.reference?.trim() || '' };
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

export function reorderPlan(trip, sourceId, targetId) {
  const items = [...(trip.items || [])], source = items.find(item => item.id === sourceId), target = items.find(item => item.id === targetId);
  if (!source || !target || source.id === target.id || fixedItem(source) || fixedItem(target)) return trip;
  const moved = { ...source, day: target.day };
  items.splice(items.indexOf(source), 1);
  items.splice(items.findIndex(item => item.id === target.id), 0, moved);
  return { ...trip, items };
}
