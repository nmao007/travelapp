import { eventsForDay, mappedPlace } from './itinerary-model.js';
import { activityInstant, isDate, isTimeZone } from './domain.js';

export const routeModes = { WALK: { icon: 'walk', label: 'Walking' }, DRIVE: { icon: 'car', label: 'Driving' }, TRANSIT: { icon: 'train', label: 'Transit' } };

export function dayRouteLegs(trip, day) {
  const legs = [];
  let previous = null;
  for (const event of eventsForDay(trip, day)) {
    const item = event.kind === 'activity' ? event.item : null;
    if (!mappedPlace(item) || ['Flight', 'Train'].includes(item.kind)) { previous = null; continue; }
    if (previous && (previous.latitude !== item.latitude || previous.longitude !== item.longitude)) {
      legs.push({ key: `${previous.id}:${item.id}`, from: previous, to: item });
    }
    previous = item;
  }
  return legs;
}
export const routePoint = item => ({ latitude: item.latitude, longitude: item.longitude });
export function routeKey(leg, mode) { return JSON.stringify([mode, routePoint(leg.from), routePoint(leg.to)]); }
export function travelLabel(seconds, meters) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  const duration = minutes >= 60 ? `${Math.floor(minutes / 60)} hr${minutes % 60 ? ` ${minutes % 60} min` : ''}` : `${minutes} min`;
  const distance = meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters / 10) * 10} m`;
  return `${duration} · ${distance}`;
}
export function travelTiming(leg, seconds, trip) {
  if (!Number.isFinite(seconds) || seconds < 0 || !leg.to.time) return null;
  const zone = item => item.timeZone || trip.timeZone || 'UTC';
  const valid = item => isDate(item.day) && isTimeZone(zone(item)) && /^([01]\d|2[0-3]):[0-5]\d(?::00)?$/.test(item.time || '');
  if (!valid(leg.to) || !isTimeZone(zone(leg.from))) return null;
  const at = item => activityInstant({ date: item.day, time: item.time, time_zone: zone(item) });
  const to = at(leg.to);
  if (to === null || !Number.isFinite(to)) return null;
  // Round the journey up, rather than suggesting departure a few seconds late.
  const leaveAt = to - Math.ceil(seconds / 60) * 60000;
  const from = valid(leg.from) ? at(leg.from) : null;
  const duration = leg.from.kind === 'Tour' && Number.isFinite(leg.from.tour?.durationMinutes) ? Math.max(0, leg.from.tour.durationMinutes) * 60000 : 0;
  const shortageMinutes = from !== null && Number.isFinite(from) ? Math.max(0, Math.ceil((from + duration - leaveAt) / 60000)) : null;
  const timeZone = zone(leg.from);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(leaveAt);
  const part = name => parts.find(value => value.type === name).value;
  const leaveDay = `${part('year')}-${part('month')}-${part('day')}`;
  const leaveLabel = new Intl.DateTimeFormat('en', { timeZone, hour: 'numeric', minute: '2-digit', hour12: true, ...(leaveDay !== leg.from.day ? { month: 'short', day: 'numeric' } : {}) }).format(leaveAt);
  return { leaveAt, leaveDay, leaveLabel, timeZone, shortageMinutes, conflict: shortageMinutes > 0 };
}
export function travelConflict(leg, seconds, trip) { return travelTiming(leg, seconds, trip)?.conflict || false; }

export function decodePolyline(encoded) {
  const path = []; let index = 0, lat = 0, lng = 0;
  function next() {
    let value = 0, shift = 0, byte;
    do {
      if (index >= encoded.length || shift > 30) throw new Error('Invalid route geometry');
      byte = encoded.charCodeAt(index++) - 63;
      if (byte < 0 || byte > 63) throw new Error('Invalid route geometry');
      value |= (byte & 31) << shift; shift += 5;
    } while (byte >= 32);
    return value & 1 ? ~(value >> 1) : value >> 1;
  }
  while (index < encoded.length) { lat += next(); lng += next(); path.push({ lat: lat / 1e5, lng: lng / 1e5 }); }
  return path;
}
