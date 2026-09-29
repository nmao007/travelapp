import type { Destination } from './destination.ts';
import type { PlannerTrip } from './planner.ts';
import { isDate, isTimeZone } from './domain.ts';
export type TripStop = { label: string; destination?: Destination };
export const destinationLabel = (destination: Destination) => [destination.name,destination.country].filter(Boolean).join(', ');
export function editableStops(trip: PlannerTrip): TripStop[] {
  const remaining=[...(trip.destinations || [])];
  return trip.stops.map(label => {
    const index=remaining.findIndex(destination => destinationLabel(destination)===label);
    return index<0 ? {label} : {label,destination:remaining.splice(index,1)[0]};
  });
}
export function addStop(stops: TripStop[],destination: Destination): TripStop[] {
  if (stops.length>=20) throw new Error('A trip can have up to 20 destinations.');
  if (stops.some(stop => stop.destination?.id===destination.id)) return stops;
  return [...stops,{label:destinationLabel(destination),destination}];
}
export function moveStop(stops: TripStop[],index: number,direction: -1 | 1): TripStop[] {
  const next=[...stops],target=index+direction;
  if (index<0 || target<0 || target>=next.length) return next;
  [next[index],next[target]]=[next[target],next[index]];
  return next;
}
export function reviseTrip(trip: PlannerTrip,stops: TripStop[],details: {title:string;start:string;end:string;travelers:number;pace:string;budget:number|null}): PlannerTrip {
  if (!stops.length || stops.length>20 || stops.some(stop => !stop.label.trim() || stop.label.length>160)) throw new Error('Keep between one and 20 destinations.');
  if (new Set(stops.map(stop => stop.destination?.id || stop.label)).size!==stops.length) throw new Error('Each destination should appear once.');
  const {title,start,end,travelers,pace,budget}=details;
  if (!title.trim() || title.length>160) throw new Error('Use a trip name under 160 characters.');
  if ((start || end) && (!isDate(start) || !isDate(end) || end<start || (Date.parse(end)-Date.parse(start))/86400000>365)) throw new Error('Choose both dates within a year, or leave both undecided.');
  if (trip.entries.some(item => item.date && start && (item.date<start || item.date>end))) throw new Error('Move existing plan items inside the new dates before shortening the trip.');
  if (!Number.isInteger(travelers) || travelers<1 || travelers>100) throw new Error('Choose between 1 and 100 travelers.');
  if (budget!==null && (!Number.isSafeInteger(budget) || budget<0)) throw new Error('Choose a valid budget.');
  const destination=stops[0].destination;
  const zone=destination?.zones[0] || trip.zone;
  if (!isTimeZone(zone)) throw new Error('The first destination needs a valid time zone.');
  return {...trip,title:title.trim(),stops:stops.map(stop=>stop.label),destinations:stops.flatMap(stop=>stop.destination ? [stop.destination] : []),start,end,zone,travelers,pace,budget};
}
