import { days, makeEntry, uid, type Entry, type PlannerTrip } from './planner.ts';
import type { RealPlace } from './place-service.ts';

/** Timed commitments keep their clock order; only flexible plans are manually ordered. */
export function entriesForDay(trip: PlannerTrip, date: string): Entry[] {
  return trip.entries.filter(entry => entry.date === date).map((entry, index) => ({ entry, index })).sort((a, b) => {
    const group = (entry: Entry) => entry.time ? 0 : entry.booked ? 1 : 2;
    const difference = group(a.entry) - group(b.entry);
    if (difference) return difference;
    if (a.entry.time && b.entry.time) return a.entry.time.localeCompare(b.entry.time) || a.index - b.index;
    return (a.entry.order ?? a.index) - (b.entry.order ?? b.index) || a.index - b.index;
  }).map(item => item.entry);
}

export function moveEntryToDay(trip: PlannerTrip, id: string, date: string): PlannerTrip {
  if (date && !days(trip).includes(date)) throw new Error('Choose a day in this trip.');
  const entry = trip.entries.find(item => item.id === id);
  if (!entry) throw new Error('That place is no longer in this trip.');
  if (entry.booked || entry.time) throw new Error('Edit the reservation or timed item to change its day.');
  if (entry.date === date) return trip;
  const order = date ? entriesForDay(trip, date).filter(item => !item.booked && !item.time).length : undefined;
  return { ...trip, entries: trip.entries.map(item => item.id === id ? { ...item, date, order } : item) };
}

export function reorderFlexibleEntry(trip: PlannerTrip, id: string, direction: -1 | 1): PlannerTrip {
  const target = trip.entries.find(item => item.id === id);
  if (!target || !target.date || target.time || target.booked) return trip;
  const flexible = entriesForDay(trip, target.date).filter(item => !item.time && !item.booked);
  const index = flexible.findIndex(item => item.id === id), swap = index + direction;
  if (index < 0 || swap < 0 || swap >= flexible.length) return trip;
  [flexible[index], flexible[swap]] = [flexible[swap], flexible[index]];
  const positions = new Map(flexible.map((item, position) => [item.id, position]));
  return { ...trip, entries: trip.entries.map(item => positions.has(item.id) ? { ...item, order: positions.get(item.id) } : item) };
}

/** One sourced place is one trip item. Scheduling an existing idea keeps its identity and notes. */
export function addPlaceToTrip(trip: PlannerTrip, place: RealPlace, date = ''): { trip: PlannerTrip; entry: Entry; action: 'added' | 'scheduled' | 'already' } {
  if (date && !days(trip).includes(date)) throw new Error('Choose a day in this trip.');
  const existing = trip.entries.find(item => item.place?.id === place.id);
  if (existing) {
    if (date && !existing.date && !existing.time && !existing.booked) {
      const updated = moveEntryToDay(trip, existing.id, date);
      return { trip: updated, entry: updated.entries.find(item => item.id === existing.id)!, action: 'scheduled' };
    }
    return { trip, entry: existing, action: 'already' };
  }
  const entry = { ...makeEntry(trip, { title: place.name, date, location: place.address || place.name }, uid()), place };
  return { trip: { ...trip, entries: [...trip.entries, entry] }, entry, action: 'added' };
}
