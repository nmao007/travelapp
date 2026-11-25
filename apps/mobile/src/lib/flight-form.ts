import { clockParts, clockTime, formatClock, formatDay } from './format';

// A booked flight as stored in trip.transport (makeTransport in
// packages/core/src/itinerary-model.js), with the provider's details when it
// came from a lookup (normalizeFlight in flight-model.js).
export type FlightData = {
  service_id: string; airline?: string; status?: string; provider?: string; aircraft?: string; fetchedAt?: string;
  departure_code?: string; arrival_code?: string; departure_terminal?: string; departure_gate?: string; arrival_terminal?: string; arrival_gate?: string;
  departure_check_in?: string; arrival_baggage?: string;
  [field: string]: unknown;
};
export type Flight = {
  id: string; mode: string; service_id: string; notes?: string; draft?: boolean; flightData?: FlightData | null;
  departure_location: string; departure_date: string; departure_time: string; departure_time_zone: string;
  arrival_location: string; arrival_date: string; arrival_time: string; arrival_time_zone: string;
  [field: string]: unknown;
};

export type Leg = 'departure' | 'arrival';
export type LegForm = { location: string; date: string; hour: string; minute: string; period: 'AM' | 'PM'; zone: string };
export type FlightForm = { service_id: string; notes: string; departure: LegForm; arrival: LegForm };
export const legs: Leg[] = ['departure', 'arrival'];

// openTransport(segment, day) in itinerary-ui.js: a stored or draft flight's
// fields, or the chosen day and its stop's time zone for a new one.
export function flightForm(segment: Partial<Flight> | null, day: string, zoneFor: (day: string) => string): FlightForm {
  const leg = (key: Leg): LegForm => {
    const date = (segment?.[`${key}_date`] as string) || day;
    const [hour, minute, period] = clockParts((segment?.[`${key}_time`] as string | undefined)?.slice(0, 5));
    return { location: (segment?.[`${key}_location`] as string) || '', date, hour, minute, period, zone: (segment?.[`${key}_time_zone`] as string) || zoneFor(date) };
  };
  const form = { service_id: segment?.service_id || '', notes: segment?.notes || '', departure: leg('departure'), arrival: leg('arrival') };
  // syncArrivalDate(): a new arrival starts on the departure day.
  return segment?.arrival_date ? form : { ...form, arrival: { ...form.arrival, date: form.departure.date } };
}

// The selected lookup result fills both airports, dates, local times and zones.
export function formWithFlight(form: FlightForm, flight: Flight | FlightData): FlightForm {
  const leg = (key: Leg): LegForm => {
    const [hour, minute, period] = clockParts(String(flight[`${key}_time`] || ''));
    return { location: String(flight[`${key}_location`] || ''), date: String(flight[`${key}_date`] || ''), hour, minute, period, zone: String(flight[`${key}_time_zone`] || '') };
  };
  return { ...form, service_id: flight.service_id, departure: leg('departure'), arrival: leg('arrival') };
}

// new FormData(#transport-form): the input makeTransport() checks and stores.
export function transportInput(form: FlightForm, mode = 'Flight') {
  const input: Record<string, string> = { mode, service_id: form.service_id, notes: form.notes };
  for (const key of legs) {
    const leg = form[key];
    input[`${key}_location`] = leg.location;
    input[`${key}_date`] = leg.date;
    input[`${key}_time`] = clockTime(leg.hour, leg.minute || '00', leg.period);
    input[`${key}_time_zone`] = leg.zone;
  }
  return input;
}

// searchFlight() in itinerary-ui.js: what /api/flights answered, as either
// flights to choose from or a note above the manual fields.
export type LookupResult = { flights: FlightData[] } | { note: string };
export const lookupNotes = {
  notConnected: 'Flight lookup is not connected. Enter your ticket details below.',
  finding: 'Finding your flight…',
  unavailable: 'Flight lookup could not connect. Enter your ticket details below.',
  none: 'No flight found for this departure date. Enter your ticket details below.',
  outsideTrip: 'This flight falls outside your trip dates. Extend the trip dates before adding it.',
};
export function lookupResult(ok: boolean, data: unknown): LookupResult {
  const body = (data && typeof data === 'object' ? data : {}) as { error?: unknown; flights?: unknown };
  if (!ok) return { note: typeof body.error === 'string' && body.error ? body.error : lookupNotes.unavailable };
  const flights = Array.isArray(body.flights) ? body.flights.filter((flight): flight is FlightData => Boolean(flight && typeof flight === 'object' && (flight as FlightData).service_id)) : [];
  return flights.length ? { flights } : { note: lookupNotes.none };
}

// Labels for the flight rows (transportJourney / arrivalJourney / transportCard).
export const overviewLocation = (value: unknown) => String(value || '').replace(/\s+(?:International\s+)?Airport$/i, '').replace(/\s+International$/i, '');
const shortDay = (date: string) => formatDay(date, { month: 'short', day: 'numeric' });

export function journeyLabels(segment: Flight) {
  const id = segment.service_id || String(segment.flightData?.flightNumber || '') || segment.mode;
  const from = segment.flightData?.departure_code || overviewLocation(segment.departure_location);
  const to = segment.flightData?.arrival_code || overviewLocation(segment.arrival_location);
  const arrivalDay = segment.arrival_date !== segment.departure_date ? ` · ${shortDay(segment.arrival_date)}` : '';
  return { title: `${from} → ${to}`, detail: `${formatClock(segment.departure_time)} – ${formatClock(segment.arrival_time)}${arrivalDay} · ${id}` };
}

export function arrivalLabels(segment: Flight) {
  const location = segment.flightData?.arrival_code || overviewLocation(segment.arrival_location);
  const from = segment.flightData?.departure_code || overviewLocation(segment.departure_location);
  return { title: `Arrive in ${location}`, detail: [segment.service_id, from && `From ${from}`].filter(Boolean).join(' · '), time: formatClock(segment.arrival_time) };
}

export const legLabel = (segment: Flight, key: Leg) => `${key === 'departure' ? 'Departs' : 'Arrives'} · ${shortDay(segment[`${key}_date`])}`;

export function flightMetadata(data: FlightData | null | undefined) {
  if (!data) return [];
  const values: string[] = [];
  if (data.status) values.push(data.status);
  for (const key of ['departure_terminal', 'departure_gate', 'arrival_terminal', 'arrival_gate'] as const) if (data[key]) values.push(`${key.replace('_', ' ')} ${data[key]}`);
  if (data.aircraft) values.push(data.aircraft);
  if (data.departure_check_in) values.push(`Check-in ${data.departure_check_in}`);
  if (data.arrival_baggage) values.push(`Baggage ${data.arrival_baggage}`);
  values.push('Flight data: AeroDataBox');
  if (data.fetchedAt) values.push(`Checked ${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(data.fetchedAt))}`);
  return values;
}
