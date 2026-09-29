import type { Destination } from './destination.ts';
import type { RealPlace } from './place-service.ts';
import { isDate, isTimeZone, parseMoney, activityInstant, currencyDigits, dateInZone } from './domain.ts';

export type View = 'trip' | 'plan' | 'explore' | 'essentials';
export type Resource = 'reservations' | 'documents' | 'readiness' | 'packing' | 'money' | 'connectivity' | 'basics';
export type Entry = { id: string; title: string; kind: 'Activity' | 'Flight' | 'Stay' | 'Transport' | 'Food'; date: string; time: string; zone: string; location: string; notes: string; reference: string; booked: boolean; place?: RealPlace };
export type Check = { id: string; title: string; group: 'Before leaving' | 'On the trip' | 'Coming home'; done: boolean };
export type Pack = { id: string; title: string; group: string; done: boolean };
export type Cost = { id: string; title: string; amount: number; category: string; date: string };
export type Memo = { id: string; title: string; text: string; resource: 'documents' | 'connectivity' | 'basics' };
export type PlannerTrip = { id: string; title: string; destinations?: Destination[]; stops: string[]; start: string; end: string; zone: string; currency: string; budget: number | null; travelers: number; pace: string; entries: Entry[]; checks: Check[]; packing: Pack[]; costs: Cost[]; memos: Memo[]; saved: string[]; created: string; deletedAt?: string };
export type Store = { version: 1; trips: PlannerTrip[] };
export const emptyStore = (): Store => ({ version: 1, trips: [] });
export const uid = () => globalThis.crypto.randomUUID();
export function days(trip: Pick<PlannerTrip, 'start' | 'end'>): string[] {
  if (!isDate(trip.start) || !isDate(trip.end) || trip.end < trip.start) return [];
  const result: string[] = [];
  for (let date = new Date(`${trip.start}T12:00:00Z`); date.toISOString().slice(0, 10) <= trip.end && result.length < 366; date.setUTCDate(date.getUTCDate() + 1)) result.push(date.toISOString().slice(0, 10));
  return result;
}

export function nextEntry(trip: PlannerTrip, now = new Date()): Entry | undefined {
  return trip.entries.map(entry => {
    if (!entry.date) return { entry, at: null };
    const today = dateInZone(entry.zone, now);
    const at = entry.time ? activityInstant({ date: entry.date, time: entry.time, time_zone: entry.zone }) : entry.date === today ? now.getTime() : activityInstant({ date: entry.date, time: '00:00', time_zone: entry.zone });
    return { entry, at };
  }).filter((item): item is { entry: Entry; at: number } => item.at !== null && item.at >= now.getTime()).sort((a,b) => Number(!a.entry.time)-Number(!b.entry.time) || a.at-b.at)[0]?.entry;
}

export function createTrip(input: Record<string, string>, id = uid()): PlannerTrip {
  const stops = (input.stops ?? '').split('\n').map(s => s.trim()).filter(Boolean);
  if (!stops.length || stops.length > 20 || stops.some(s => s.length > 160)) throw new Error('Add between 1 and 20 destinations, up to 160 characters each.');
  const start = input.start ?? '', end = input.end ?? '';
  if ((start || end) && (!isDate(start) || !isDate(end) || end < start || (Date.parse(end) - Date.parse(start)) / 86400000 > 365)) throw new Error('Choose a valid date range of up to 366 days, or leave both dates undecided.');
  const zone = input.zone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!isTimeZone(zone)) throw new Error('Use a valid destination time zone, such as Asia/Tokyo.');
  const currency = input.currency || 'USD';
  currencyDigits(currency);
  const budget = input.budget?.trim() ? parseMoney(input.budget, currency) : null;
  if (input.budget?.trim() && budget === null) throw new Error('Enter a non-negative budget with the right decimal precision for your currency.');
  const travelers = Number(input.travelers || 1);
  if (!Number.isInteger(travelers) || travelers < 1 || travelers > 100) throw new Error('Choose between 1 and 100 travelers.');
  const title = input.title?.trim() || (stops.length > 1 ? `${stops[0]} & beyond` : `A trip to ${stops[0]}`);
  if (title.length > 160) throw new Error('Use a trip name under 160 characters.');
  return { id, title, stops, start, end, zone, currency, budget, travelers, pace: input.pace || 'Balanced', entries: [], costs: [], packing: [], memos: [], saved: [], created: new Date().toISOString(), checks: [
    ['Check passport validity and entry requirements', 'Before leaving'], ['Arrange arrival transport and first-night accommodation', 'Before leaving'], ['Check travel insurance and medication needs', 'Before leaving'], ['Prepare payments, phone connectivity, and offline copies', 'Before leaving'], ['Secure home, keys, pets, and deliveries', 'Before leaving'], ['Confirm the next day’s reservations and opening hours', 'On the trip'], ['Confirm return transport and check-in', 'Coming home'], ['Settle shared costs and save receipts', 'Coming home'],
  ].map(([title, group], i) => ({ id: `${id}-check-${i}`, title, group: group as Check['group'], done: false })) };
}
export function makeEntry(trip: PlannerTrip, input: Record<string, string>, id = uid()): Entry {
  const title = input.title?.trim();
  if (!title || title.length > 160) throw new Error('Add a title, up to 160 characters.');
  const date = input.date || '';
  if (date && (!isDate(date) || (trip.start && (date < trip.start || date > trip.end)))) throw new Error('Choose a date within this trip, or leave it unscheduled.');
  const time = input.time || '';
  if (time && (!date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) throw new Error('A time needs a valid day. Leave time blank for a flexible item.');
  const zone = input.zone || trip.zone;
  if (!isTimeZone(zone)) throw new Error('Use a valid IANA time zone.');
  if (time && activityInstant({ date, time, time_zone: zone }) === null) throw new Error('That local time does not exist because of a clock change. Choose another time.');
  const kind = input.kind || 'Activity';
  if (!['Activity','Flight','Stay','Transport','Food'].includes(kind)) throw new Error('Choose a valid item type.');
  if ((input.notes || '').length > 4000 || (input.location || '').length > 300 || (input.reference || '').length > 160) throw new Error('Shorten the address, reference, or notes.');
  return { id, title, kind: kind as Entry['kind'], date, time, zone, location: input.location?.trim() || '', notes: input.notes?.trim() || '', reference: input.reference?.trim() || '', booked: input.booked === 'on' };
}
export function upsertEntry(trip: PlannerTrip, entry: Entry): PlannerTrip {
  return { ...trip, entries: trip.entries.some(e => e.id === entry.id) ? trip.entries.map(e => e.id === entry.id ? entry : e) : [...trip.entries, entry] };
}
export function makeCost(trip: PlannerTrip, input: Record<string, string>, id = uid()): Cost {
  if (!input.title?.trim() || input.title.length > 160) throw new Error('Add an expense description, up to 160 characters.');
  if (!isDate(input.date)) throw new Error('Choose a valid expense date.');
  const amount = parseMoney(input.amount, trip.currency);
  if (amount === null) throw new Error('Enter a non-negative amount with the right decimal precision for your currency.');
  return { id, title: input.title.trim(), amount, category: input.category || 'Other', date: input.date };
}
export const places = [
  { id: 'sensoji', name: 'Sensō-ji', city: 'Tokyo', area: 'Asakusa', category: 'Culture', description: 'A historic Buddhist temple and the surrounding Asakusa streets.', tip: 'Allow time for the surrounding neighborhood. Check access and opening times before visiting.' },
  { id: 'gyoen', name: 'Shinjuku Gyoen', city: 'Tokyo', area: 'Shinjuku', category: 'Outdoors', description: 'Spacious gardens for a slower break between city neighborhoods.', tip: 'Check the official seasonal hours, closure days, admission, and reservation requirements.' },
  { id: 'yanaka', name: 'Yanaka neighborhood', city: 'Tokyo', area: 'Yanaka', category: 'Neighborhoods', description: 'Small streets, local shops, and a quieter side of Tokyo.', tip: 'Treat this as a flexible walk. Individual businesses keep their own hours.' },
  { id: 'ueno', name: 'Ueno Park', city: 'Tokyo', area: 'Ueno', category: 'Outdoors', description: 'A park district with museums, gardens, and places to pause.', tip: 'Choose a particular museum before reserving time; each venue has different rules.' },
  { id: 'meiji', name: 'Meiji Jingū', city: 'Tokyo', area: 'Harajuku', category: 'Culture', description: 'A Shinto shrine approached through wooded grounds.', tip: 'Check the official access hours and etiquette. Leave room for the walk from the station.' },
  { id: 'tsukiji', name: 'Tsukiji Outer Market', city: 'Tokyo', area: 'Tsukiji', category: 'Food', description: 'A market neighborhood with food vendors and specialty shops.', tip: 'Confirm individual shop hours. Dietary requirements need to be checked with each vendor.' },
] as const;
export function sampleTrip(): PlannerTrip {
  const trip = createTrip({ title: 'Five days in Tokyo', stops: 'Tokyo, Japan', start: '2026-10-12', end: '2026-10-16', zone: 'Asia/Tokyo', currency: 'JPY', budget: '140000', travelers: '2', pace: 'Balanced' }, 'sample-tokyo');
  trip.entries = [
    makeEntry(trip, { title: 'Arrive at Haneda', kind: 'Flight', date: trip.start, time: '14:30', location: 'Haneda Airport, Tokyo', booked: 'on', reference: 'DEMO-ONLY', notes: 'Fictional reservation for design review. Allow time for immigration and baggage.' }, 'sample-flight'),
    makeEntry(trip, { title: 'Check in at the hotel', kind: 'Stay', date: trip.start, time: '17:00', location: 'Asakusa, Tokyo', booked: 'on', reference: 'DEMO-HOTEL', notes: 'Fictional booking. Replace with your actual address and check-in instructions.' }, 'sample-stay'),
    makeEntry(trip, { title: 'Dinner near the hotel', kind: 'Food', date: trip.start, location: 'Asakusa', notes: 'Keep the first evening flexible.' }, 'sample-dinner'),
    makeEntry(trip, { title: 'Visit Sensō-ji', kind: 'Activity', date: '2026-10-13', location: 'Asakusa', notes: 'Check current access hours before visiting.' }, 'sample-temple'),
  ];
  trip.saved = ['gyoen','yanaka'];
  trip.packing = ['Passport','Phone & charger','Comfortable walking shoes','Medication'].map((title, i) => ({ id: `sample-pack-${i}`, title, group: 'Essentials', done: i === 1 }));
  trip.costs = [{ id: 'sample-cost', title: 'Hotel deposit · sample', amount: 42000, category: 'Stay', date: '2026-09-27' }];
  return trip;
}
