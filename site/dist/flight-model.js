import { activityInstant, isDate } from './domain.js';

export function normalizeFlightNumber(value) {
  const number = String(value || '').toUpperCase().replace(/[\s-]/g, '');
  return /^(?:[A-Z]{2,3}|[A-Z]\d|\d[A-Z])\d{1,4}[A-Z]?$/.test(number) ? number : null;
}

// Local dates come from the provider's airport-local timestamp, never from UTC slicing.
export function normalizeFlight(flight, departureDate) {
  const number = normalizeFlightNumber(flight?.number);
  if (!number || !flight.departure?.airport?.name || !flight.arrival?.airport?.name) return null;
  const result = { mode: 'Flight', service_id: number, provider: 'AeroDataBox', status: flight.status || '', airline: flight.airline?.name || '', fetchedAt: new Date().toISOString(), updatedAt: flight.lastUpdatedUtc || null };
  for (const leg of ['departure', 'arrival']) {
    const movement = flight[leg], local = movement.scheduledTime?.local;
    const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(local || '');
    const zone = movement.airport.timeZone;
    if (!match || !isDate(match[1]) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(match[2]) || !zone) return null;
    try { new Intl.DateTimeFormat('en', { timeZone: zone }); } catch { return null; }
    result[`${leg}_date`] = match[1]; result[`${leg}_time`] = match[2]; result[`${leg}_time_zone`] = zone;
    result[`${leg}_location`] = movement.airport.name;
    result[`${leg}_code`] = movement.airport.iata || movement.airport.icao || '';
    result[`${leg}_terminal`] = movement.terminal || ''; result[`${leg}_gate`] = movement.gate || '';
    result[`${leg}_revised`] = movement.revisedTime?.local || null;
  }
  const departure = activityInstant({ date: result.departure_date, time: result.departure_time, time_zone: result.departure_time_zone });
  const arrival = activityInstant({ date: result.arrival_date, time: result.arrival_time, time_zone: result.arrival_time_zone });
  return result.departure_date === departureDate && departure !== null && arrival !== null && arrival > departure ? result : null;
}

export function sameFlightDetails(a, b) {
  return Boolean(a && b && ['mode', 'service_id', 'departure_date', 'departure_time', 'departure_time_zone', 'departure_location', 'arrival_date', 'arrival_time', 'arrival_time_zone', 'arrival_location'].every(key => key === 'service_id' ? normalizeFlightNumber(a[key]) === normalizeFlightNumber(b[key]) : a[key] === b[key]));
}
