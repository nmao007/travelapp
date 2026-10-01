import { normalizeFlightNumber, normalizeFlight } from './dist/flight-model.js';

export class FlightLookupError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}

export function createFlightService({ fetcher = fetch, now = Date.now } = {}) {
  const pending = new Map();
  return async function lookup(number, date, { key, gateway = 'direct' } = {}) {
    const ident = normalizeFlightNumber(number);
    const parsedDate = new Date(`${date}T12:00:00Z`);
    if (!ident || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) throw new FlightLookupError('Enter a flight number and departure date.', 400, 'INVALID_FLIGHT');
    if (!key) throw new FlightLookupError('Flight lookup is not connected. Enter your ticket details below.', 503, 'NOT_CONFIGURED');
    const cacheKey = `${gateway}:${ident}:${date}`;
    const cached = pending.get(cacheKey);
    if (cached?.expires > now()) return cached.promise;
    if (pending.size > 100) pending.delete(pending.keys().next().value);
    const promise = (async () => {
      const rapid = gateway === 'rapidapi';
      const host = rapid ? 'aerodatabox.p.rapidapi.com' : 'api.aerodatabox.com';
      const url = new URL(`https://${host}/flights/number/${encodeURIComponent(ident)}/${date}`);
      url.searchParams.set('dateLocalRole', 'Departure');
      const headers = rapid ? { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': host } : { 'X-Api-Key': key };
      let response;
      try { response = await fetcher(url, { headers, signal: AbortSignal.timeout(10_000) }); }
      catch { throw new FlightLookupError('Flight lookup could not connect. You can still enter your ticket details.', 502, 'UNAVAILABLE'); }
      if ([204, 404].includes(response.status)) return [];
      if (!response.ok) {
        const code = response.status === 429 ? 'QUOTA' : [401, 403].includes(response.status) ? 'ACCESS' : 'UNAVAILABLE';
        throw new FlightLookupError(code === 'QUOTA' ? 'Flight lookup has reached its limit. Enter your ticket details.' : code === 'ACCESS' ? 'The flight data connection needs attention. Enter your ticket details.' : 'No flight data available for that date. Enter your ticket details.', 503, code);
      }
      const data = await response.json();
      if (!Array.isArray(data)) throw new FlightLookupError('The flight service returned an unexpected response.', 502, 'UNAVAILABLE');
      return data.filter(flight => !flight.isCargo).map(flight => normalizeFlight(flight, date)).filter(Boolean);
    })();
    pending.set(cacheKey, { promise, expires: now() + 60_000 });
    try { return await promise; } catch (error) { pending.delete(cacheKey); throw error; }
  };
}
