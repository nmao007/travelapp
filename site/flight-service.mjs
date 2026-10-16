import { createHash } from 'node:crypto';
import { normalizeFlightNumber, normalizeFlight } from './dist/flight-model.js';

export class FlightLookupError extends Error {
  constructor(message, status, code) { super(message); this.status = status; this.code = code; }
}

export function createFlightService({ fetcher = fetch, now = Date.now } = {}) {
  const pending = new Map(), cooldowns = new Map();
  return async function lookup(number, date, { key, gateway = 'rapidapi' } = {}) {
    const ident = normalizeFlightNumber(number);
    const parsedDate = new Date(`${date}T12:00:00Z`);
    if (!ident || !/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) throw new FlightLookupError('Enter a flight number and departure date.', 400, 'INVALID_FLIGHT');
    if (!key) throw new FlightLookupError('Flight lookup is not connected. Enter your ticket details below.', 503, 'NOT_CONFIGURED');
    if (!['direct', 'rapidapi'].includes(gateway)) throw new FlightLookupError('The flight data connection needs attention. Enter your ticket details.', 503, 'ACCESS');
    // Credentials never leave server headers or appear in URLs, logs, or cache keys.
    const scope = `${gateway}:${createHash('sha256').update(key).digest('hex')}`;
    const cooldown = cooldowns.get(scope);
    if (cooldown?.expires > now()) throw cooldown.error;
    cooldowns.delete(scope);
    const cacheKey = `${scope}:${ident}:${date}`;
    const cached = pending.get(cacheKey);
    if (cached?.expires > now()) return cached.promise;
    for (const [id, entry] of pending) if (entry.expires <= now()) pending.delete(id);
    if (pending.size >= 100) {
      const oldest = [...pending].find(([, entry]) => entry.expires !== Infinity);
      if (oldest) pending.delete(oldest[0]);
      else throw new FlightLookupError('Flight lookup is busy. Please try again shortly.', 503, 'UNAVAILABLE');
    }
    const promise = (async () => {
      const rapid = gateway === 'rapidapi';
      const host = rapid ? 'aerodatabox.p.rapidapi.com' : 'api.aerodatabox.com';
      const url = new URL(`https://${host}/flights/number/${encodeURIComponent(ident)}/${date}`);
      url.searchParams.set('dateLocalRole', 'Departure');
      url.searchParams.set('withFlightPlan', 'false'); // Avoid the provider’s double-unit flight-plan option.
      const headers = rapid ? { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': host } : { 'X-Api-Key': key };
      let response;
      try { response = await fetcher(url, { headers, signal: AbortSignal.timeout(10_000) }); }
      catch { throw new FlightLookupError('Flight lookup could not connect. You can still enter your ticket details.', 502, 'UNAVAILABLE'); }
      if ([204, 404].includes(response.status)) return [];
      if (!response.ok) {
        const code = response.status === 429 ? 'QUOTA' : [401, 403].includes(response.status) ? 'ACCESS' : 'UNAVAILABLE';
        throw new FlightLookupError(code === 'QUOTA' ? 'Flight lookup has reached its limit. Enter your ticket details.' : code === 'ACCESS' ? 'The flight data connection needs attention. Enter your ticket details.' : 'No flight data available for that date. Enter your ticket details.', 503, code);
      }
      let data;
      try { data = await response.json(); } catch { throw new FlightLookupError('The flight service returned an unexpected response.', 502, 'UNAVAILABLE'); }
      if (!Array.isArray(data)) throw new FlightLookupError('The flight service returned an unexpected response.', 502, 'UNAVAILABLE');
      return data.filter(flight => !flight.isCargo).map(flight => normalizeFlight(flight, date)).filter(Boolean);
    })();
    const entry = { promise, expires: Infinity };
    pending.set(cacheKey, entry);
    try {
      const flights = await promise;
      // Future schedules change slowly; near-departure data needs fresher checks.
      // Empty results are cached too so incomplete typing does not burn the free allowance.
      const distant = Math.abs(parsedDate.getTime() - now()) > 2 * 86_400_000;
      entry.expires = now() + (!flights.length ? 15 * 60_000 : distant ? 6 * 3_600_000 : 5 * 60_000);
      return flights;
    } catch (error) {
      pending.delete(cacheKey);
      if (['QUOTA', 'ACCESS'].includes(error.code)) {
        if (cooldowns.size >= 100) cooldowns.delete(cooldowns.keys().next().value);
        cooldowns.set(scope, { error, expires: now() + 60_000 });
      }
      throw error;
    }
  };
}
