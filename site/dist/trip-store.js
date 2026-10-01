import { fixedItem } from './itinerary-model.js';
export const STORAGE_KEY = 'trippilot-site-trips-v1';

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

export function moveStop(trip, index, direction) {
  const stops = tripStops(trip);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= stops.length) return trip;
  [stops[index], stops[target]] = [stops[target], stops[index]];
  return withStops(trip, stops);
}

export function removeStop(trip, placeId) {
  const stops = tripStops(trip);
  if (stops.length === 1) throw new Error('A trip needs at least one destination.');
  const next = stops.filter(stop => stop.placeId !== placeId);
  if (next.length === stops.length) return trip;
  return withStops(trip, next);
}

export function readTrips(storage = localStorage) {
  try {
    const value = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(value) ? value.filter(isTrip).map(trip => ({ ...trip, stops: tripStops(trip), items: Array.isArray(trip.items) ? trip.items : [] })) : [];
  } catch { return []; }
}

export function saveTrip(trip, storage = localStorage) {
  if (!isTrip(trip)) throw new Error('Choose a destination first.');
  const trips = readTrips(storage);
  const next = [{ ...trip, stops: tripStops(trip), items: Array.isArray(trip.items) ? trip.items : [] }, ...trips.filter(item => item.id !== trip.id)];
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function deleteTrip(id, storage = localStorage) {
  const next = readTrips(storage).filter(trip => trip.id !== id);
  storage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function addPlace(trip, place) {
  if (!isTrip(trip) || !place?.placeId || !place?.name) throw new Error('Choose a place.');
  if (trip.items?.some(item => item.placeId === place.placeId && item.day === place.day)) return trip;
  return { ...trip, items: [...(trip.items || []), { id: crypto.randomUUID(), ...place }] };
}

export function removePlace(trip, itemId) {
  return { ...trip, items: (trip.items || []).filter(item => item.id !== itemId) };
}

export function movePlace(trip, itemId, day) {
  if (trip.items?.some(item => item.id === itemId && fixedItem(item))) return trip;
  return { ...trip, items: (trip.items || []).map(item => item.id === itemId ? { ...item, day } : item) };
}

export const tripTitle = trip => trip.title?.trim() || tripStops(trip).map(stop => stop.name).join(' → ');
export function renameTrip(trip, title) {
  const value = String(title || '').trim();
  if (!value || value.length > 120) throw new Error('Use a trip title between 1 and 120 characters.');
  return { ...trip, title: value };
}
