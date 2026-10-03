import { activityInstant, isDate, isTimeZone } from './domain.js';
import { datesForTrip } from './itinerary-model.js';
import { tripTitle } from './trip-store.js';
import { placeMapsURL } from './maps-links.js';
import { tourDetails, tourSummary } from './tour-model.js';

// RFC 5545 text escaping and UTF-8 folding keep names and notes intact, even
// when they contain punctuation, line breaks or non-Latin characters.
const text = value => String(value ?? '').replaceAll('\\', '\\\\').replace(/\r\n|\r|\n/g, '\\n').replaceAll(';', '\\;').replaceAll(',', '\\,');
const utc = instant => new Date(instant).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
const dateValue = day => day.replaceAll('-', '');
const nextDate = day => dateValue(new Date(Date.parse(`${day}T00:00:00Z`) + 86400000).toISOString().slice(0, 10));
const encoder = new TextEncoder();
function fold(line) {
  let result = '', length = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (length + size > 75) { result += '\r\n '; length = 1; }
    result += character; length += size;
  }
  return result;
}
function localInstant(day, time, zone, label) {
  if (!isDate(day) || !/^([01]\d|2[0-3]):[0-5]\d(?::00)?$/.test(time || '') || !isTimeZone(zone)) throw new Error(`Check the date, time and time zone for ${label}.`);
  const instant = activityInstant({ date: day, time, time_zone: zone });
  if (instant === null || !Number.isFinite(instant)) throw new Error(`Check the time for ${label}; it falls during a clock change.`);
  return instant;
}
function eventLines(trip, collection, record, stamp) {
  if (!record.id) throw new Error('A plan is missing its ID. Reopen the trip before exporting.');
  return ['BEGIN:VEVENT', `UID:${encodeURIComponent(trip.id)}.${collection}.${encodeURIComponent(record.id)}@trippilot.local`, `DTSTAMP:${stamp}`, 'CLASS:PRIVATE'];
}

export function exportTripCalendar(trip, { now = new Date() } = {}) {
  if (!trip?.id) throw new Error('Open a trip first.');
  const days = new Set(datesForTrip(trip));
  if (!days.size) throw new Error('Choose trip dates before exporting.');
  const title = tripTitle(trip) || 'Trip', stamp = utc(now), events = [], identities = new Set();
  function add(collection, record, lines) {
    const identity = `${collection}:${record.id}`;
    if (identities.has(identity)) throw new Error('Two plans have the same ID. Reopen the trip before exporting.');
    identities.add(identity); events.push(...eventLines(trip, collection, record, stamp), ...lines, 'END:VEVENT');
  }
  for (const item of trip.items || []) {
    if (item.day === 'ideas') continue;
    if (!days.has(item.day) || !item.name?.trim()) throw new Error('Check that every plan has a name and a day within the trip.');
    const lines = [`SUMMARY:${text(item.name)}`], description = [title];
    if (item.time) {
      const zone = item.timeZone || trip.timeZone, start = localInstant(item.day, item.time, zone, item.name);
      lines.push(`DTSTART:${utc(start)}`);
      description.push(`${item.day} ${item.time.slice(0, 5)} · ${zone}`);
      // Only tours have an explicit duration. Never invent an end time for a
      // restaurant reservation, hotel check-in or other timed plan.
      if (item.kind === 'Tour') {
        const tour = tourDetails(item.tour);
        lines.push(`DTEND:${utc(start + tour.durationMinutes * 60000)}`);
      }
    } else {
      lines.push(`DTSTART;VALUE=DATE:${dateValue(item.day)}`, `DTEND;VALUE=DATE:${nextDate(item.day)}`);
      description.push('Time not set');
    }
    lines.push(`TRANSP:${item.time && item.booked ? 'OPAQUE' : 'TRANSPARENT'}`, `STATUS:${item.booked ? 'CONFIRMED' : 'TENTATIVE'}`);
    if (item.kind === 'Tour') { const tour = tourDetails(item.tour); description.push(tour.operatorName, tourSummary(tour)); if (tour.meetingName) description.push(`Meeting point: ${tour.meetingName}`); }
    if (item.address) lines.push(`LOCATION:${text(item.address)}`);
    if (item.reference) description.push(`Booking reference: ${item.reference}`);
    if (item.notes) description.push(item.notes);
    const maps = item.placeId || item.address ? placeMapsURL(item) : null;
    if (maps) { description.push(maps); lines.push(`URL:${maps}`); }
    lines.push(`DESCRIPTION:${text(description.join('\n'))}`);
    add('plan', item, lines);
  }
  for (const segment of trip.transport || []) {
    if (!['Flight', 'Train'].includes(segment.mode) || !segment.service_id?.trim() || !segment.departure_location || !segment.arrival_location || !days.has(segment.departure_date) || !days.has(segment.arrival_date)) throw new Error('Check the flight or train details before exporting.');
    const start = localInstant(segment.departure_date, segment.departure_time, segment.departure_time_zone, segment.service_id);
    const end = localInstant(segment.arrival_date, segment.arrival_time, segment.arrival_time_zone, segment.service_id);
    if (end <= start) throw new Error(`Check the arrival time for ${segment.service_id}.`);
    const description = [title, `Departure: ${segment.departure_date} ${segment.departure_time.slice(0, 5)} · ${segment.departure_time_zone}`, `Arrival: ${segment.arrival_date} ${segment.arrival_time.slice(0, 5)} · ${segment.arrival_time_zone}`];
    if (segment.flightData?.airline) description.push(segment.flightData.airline);
    for (const leg of ['departure', 'arrival']) for (const field of ['terminal', 'gate']) {
      const value = segment.flightData?.[`${leg}_${field}`];
      if (value) description.push(`${leg === 'departure' ? 'Departure' : 'Arrival'} ${field}: ${value}`);
    }
    if (segment.flightData?.fetchedAt) description.push(`Flight details checked: ${segment.flightData.fetchedAt}`);
    if (segment.notes) description.push(segment.notes);
    add('transport', segment, [`SUMMARY:${text(`${segment.mode} ${segment.service_id} · ${segment.departure_location} → ${segment.arrival_location}`)}`, `DTSTART:${utc(start)}`, `DTEND:${utc(end)}`, 'TRANSP:OPAQUE', `LOCATION:${text(segment.departure_location)}`, `DESCRIPTION:${text(description.join('\n'))}`]);
  }
  if (!identities.size) throw new Error('Add a plan, flight or train to a trip day before exporting.');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//TripPilot//Trip Calendar//EN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${text(title)}`, ...events, 'END:VCALENDAR'];
  const filename = `${[...title.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/^[.\s]+|[.\s]+$/g, '')].slice(0, 50).join('') || 'Trip'}.ics`;
  return { content: lines.map(fold).join('\r\n') + '\r\n', filename, count: identities.size };
}

export function downloadTripCalendar(trip) {
  const result = exportTripCalendar(trip), url = URL.createObjectURL(new Blob([result.content], { type: 'text/calendar;charset=utf-8' }));
  const link = document.createElement('a'); link.href = url; link.download = result.filename; link.hidden = true;
  try { document.body.append(link); link.click(); }
  finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
  return result;
}
