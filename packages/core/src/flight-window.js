import { activityInstant, isDate, isTimeZone } from './domain.js';

const zones = new Map();
function validZone(value) {
  if (typeof value !== 'string' || !value) return false;
  if (!zones.has(value)) zones.set(value, isTimeZone(value));
  return zones.get(value);
}
const validTime = value => /^([01]\d|2[0-3]):[0-5]\d(?::00)?$/.test(value || '');
const instant = (day, time, zone) => isDate(day) && validTime(time) && validZone(zone) ? activityInstant({ date: day, time, time_zone: zone }) : null;
const schedules = new WeakMap();
function schedule(trip) {
  const key = JSON.stringify((trip.transport || []).map(flight => ['mode','draft','id','service_id','departure_date','departure_time','departure_time_zone','arrival_date','arrival_time','arrival_time_zone'].map(field => flight[field])));
  const cached = schedules.get(trip);
  if (cached?.key === key) return cached;
  const values = (trip.transport || []).flatMap(flight => {
    if (flight.mode !== 'Flight' || flight.draft) return [];
    const start = instant(flight.departure_date, flight.departure_time, flight.departure_time_zone);
    const end = instant(flight.arrival_date, flight.arrival_time, flight.arrival_time_zone);
    return start !== null && end !== null && end > start ? [{ start, end, flight }] : [];
  }).sort((a, b) => a.start - b.start);
  const result = { key, values, days: new Map() }; schedules.set(trip, result); return result;
}
function dayZone(trip, day, zone) {
  if (validZone(zone)) return zone;
  const stop = (trip.stops || []).filter(stop => stop.date && stop.date <= day && (!stop.endDate || stop.endDate >= day) && validZone(stop.timeZone)).sort((a, b) => b.date.localeCompare(a.date))[0];
  return stop?.timeZone || (validZone(trip.timeZone) ? trip.timeZone : 'UTC');
}
export function flightDayBlock(trip, day, zone) {
  if (!isDate(day)) return null;
  const cached = schedule(trip), timeZone = dayZone(trip, day, zone), key = `${day}:${timeZone}`;
  if (cached.days.has(key)) return cached.days.get(key);
  const remember = value => { cached.days.set(key, value); return value; };
  // Between airport-local departure and arrival dates there is no ground-day
  // slot, even when an eastbound time-zone change spans extra calendar dates.
  const between = cached.values.filter(({ flight }) => flight.departure_date < day && day < flight.arrival_date);
  if (between.length) return remember({ flights: between.map(window => window.flight) });
  const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + 1);
  const start = instant(day, '00:00', timeZone), end = instant(date.toISOString().slice(0, 10), '00:00', timeZone);
  if (start === null || end === null) return remember(null);
  let covered = start; const flights = [];
  for (const window of cached.values) {
    if (window.end <= covered) continue;
    if (window.start > covered) break;
    flights.push(window.flight); covered = window.end;
    if (covered >= end) return remember({ flights });
  }
  return remember(null);
}
export function flightConflict(trip, item) {
  if (!isDate(item.day)) return null;
  const zone = dayZone(trip, item.day, item.timeZone);
  const blocked = flightDayBlock(trip, item.day, zone);
  if (blocked) return blocked.flights[0];
  if (!item.time) return null;
  const start = instant(item.day, item.time, zone);
  if (start === null) return null;
  const duration = item.kind === 'Tour' && Number.isFinite(item.tour?.durationMinutes) ? Math.max(0, item.tour.durationMinutes) * 60000 : 0;
  return schedule(trip).values.find(window => start < window.end && (duration ? start + duration > window.start : start >= window.start))?.flight || null;
}
export function assertFlightAvailability(trip, item) {
  const flight = flightConflict(trip, item);
  if (flight) throw new Error(`${item.name || 'This plan'} overlaps flight ${flight.service_id || ''}. Choose a time before departure or after arrival, or another day.`);
}
