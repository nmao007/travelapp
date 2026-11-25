import { apiUrl, loadConfig } from './config';
import { lookupNotes, lookupResult, type LookupResult } from './flight-form';

// searchFlight() in itinerary-ui.js: /api/flights looks up a normalized flight
// number on its departure date (site/flight-service.mjs, AeroDataBox). Without
// AERODATABOX_API_KEY on the server, /api/config says flightLookup is false and
// the traveler enters the ticket by hand.
export async function findFlights(number: string, date: string, signal: AbortSignal): Promise<LookupResult> {
  const config = await loadConfig().catch(() => null);
  if (!config?.flightLookup) return { note: lookupNotes.notConnected };
  try {
    const response = await fetch(`${apiUrl}/api/flights?${new URLSearchParams({ number, date })}`, { signal });
    return lookupResult(response.ok, await response.json().catch(() => ({})));
  } catch (error) {
    if (signal.aborted) throw error;
    return { note: lookupNotes.unavailable };
  }
}
