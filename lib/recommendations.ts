import type { Poi } from './poi-service.ts';
import type { PlannerTrip } from './planner.ts';
import type { Destination } from './destination.ts';

export type NearbyPick = { place: Poi; reason: string };

export function kilometers(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const radians = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * radians;
  const dLon = (b.longitude - a.longitude) * radians;
  const partial = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * radians) * Math.cos(b.latitude * radians) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.atan2(Math.sqrt(partial), Math.sqrt(Math.max(0, 1 - partial)));
}

/** Choose a few sourced, nearby candidates; never infer opening hours, quality, or travel time. */
export function nearbyPicks(places: Poi[], trip: PlannerTrip, day: string, center: { latitude: number; longitude: number }, limit = 3): NearbyPick[] {
  const saved = new Set(trip.entries.map(entry => entry.place?.id));
  const anchors = trip.entries.filter(entry => entry.date === day && entry.place && kilometers(entry.place, center) < 7).map(entry => entry.place!);
  const candidates = places.filter(place => !saved.has(place.id)).map(place => {
    const nearPlan = anchors.length ? Math.min(...anchors.map(anchor => kilometers(anchor, place))) : Infinity;
    const nearCenter = kilometers(center, place);
    return { place, nearPlan, nearCenter };
  }).sort((a, b) => ((anchors.length ? a.nearPlan : a.nearCenter) - (anchors.length ? b.nearPlan : b.nearCenter)) || a.place.name.localeCompare(b.place.name));
  const chosen: typeof candidates = [];
  const used = new Set<Poi['category']>();
  while (chosen.length < limit && candidates.length) {
    const index = candidates.findIndex(candidate => !used.has(candidate.place.category));
    const [candidate] = candidates.splice(index < 0 ? 0 : index, 1);
    chosen.push(candidate);
    used.add(candidate.place.category);
  }
  return chosen.map(({ place, nearPlan }) => ({ place, reason: nearPlan <= 1.5 ? 'Near your day plan' : 'Near this area' }));
}

/** Avoid silently adding a place in a later city to a day associated with another city. */
export function dayForArea(trip: PlannerTrip, day: string, destination: Destination): string {
  if (!day) return '';
  const mapped = trip.entries.filter(entry => entry.date === day && entry.place).map(entry => entry.place!);
  if (mapped.length) return mapped.some(place => kilometers(place, destination) < 10) ? day : '';
  return trip.destinations?.[0]?.id === destination.id ? day : '';
}
