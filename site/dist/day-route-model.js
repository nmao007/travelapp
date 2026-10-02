import { eventsForDay, mappedPlace } from './itinerary-model.js';
import { activityInstant } from './domain.js';

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
export function travelConflict(leg, seconds, trip) {
  if (!leg.from.time || !leg.to.time) return false;
  const at = item => activityInstant({ date: item.day, time: item.time, time_zone: item.timeZone || trip.timeZone || 'UTC' });
  const from = at(leg.from), to = at(leg.to);
  return from !== null && to !== null && to > from && seconds * 1000 + (leg.from.kind === 'Tour' ? (leg.from.tour?.durationMinutes || 0) * 60000 : 0) > to - from;
}

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
