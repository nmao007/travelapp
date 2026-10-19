import { addPlace } from './trip-store.js';
import { datesForTrip } from './itinerary-model.js';
import { destinationForDay } from './place-model.js';

// Build the whole change before saving, so a blocked day cannot leave a partial visit.
export function addPlaceToDays(trip, place, selectedDays) {
  const validDays = new Set(datesForTrip(trip));
  const days = [...new Set(selectedDays)];
  if (!days.length || days.some(day => !validDays.has(day))) throw new Error('Choose at least one day in this trip.');
  return days.reduce((next, day) => addPlace(next, {
    placeId: place.placeId, name: place.name, address: place.address,
    latitude: place.latitude, longitude: place.longitude, day,
    timeZone: destinationForDay(trip, day)?.timeZone || trip.timeZone,
    kind: place.primaryType === 'hotel' ? 'Stay' : ['restaurant', 'cafe', 'bakery'].includes(place.primaryType) ? 'Food' : 'Activity',
  }), trip);
}
