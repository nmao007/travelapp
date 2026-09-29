import type { RealPlace } from './place-service.ts';
import { createTrip, type PlannerTrip } from './planner.ts';
import { destinationLabel } from './trip-edit.ts';
import { isTimeZone } from './domain.ts';

export type Destination = RealPlace & { zones: string[]; zoneSource: 'timezone-boundary-builder'; };
/** Multiple sourced destinations form one trip; dates describe the overall journey. */
export function tripFromDestinations(destinations: Destination[], start = '', end = '', zone = destinations[0]?.zones[0]): PlannerTrip {
  if (!destinations.length || destinations.length>20 || new Set(destinations.map(d=>d.id)).size!==destinations.length || destinations.some(destination => !/^osm:(node|way|relation):[1-9]\d*$/.test(destination.id) || !destination.name.trim() || !Number.isFinite(destination.latitude) || !Number.isFinite(destination.longitude) || Math.abs(destination.latitude)>90 || Math.abs(destination.longitude)>180 || !destination.zones.length || destination.zones.some(z=>!isTimeZone(z))) || !destinations[0].zones.includes(zone)) throw new Error('Select valid destinations from the results.');
  const stops=destinations.map(destinationLabel);
  const title=destinations.length===1 ? destinations[0].name : `${destinations[0].name} & beyond`;
  const trip=createTrip({title,stops:stops.join('\n'),start,end,zone});
  return {...trip,destinations};
}
export function tripFromDestination(destination: Destination,start = '',end = '',zone = destination.zones[0]): PlannerTrip {
  return tripFromDestinations([destination],start,end,zone);
}

export function calendarMonth(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month, 1));
  const blanks = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return [...Array(blanks).fill(null), ...Array.from({length: count}, (_, i) => new Date(Date.UTC(year, month, i + 1)).toISOString().slice(0, 10))];
}
