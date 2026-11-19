import { apiUrl } from './config';

export type Suggestion = { placeId: string; name: string; detail: string };
export type Place = { placeId: string; name: string; address: string; latitude: number; longitude: number; primaryType?: string; types?: string[]; timeZone?: string };

async function getJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, { signal });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.error || 'Search is unavailable right now.'), { status: response.status });
  return body as T;
}

// One Google autocomplete session per search, ended by the details request.
export const newSession = () => crypto.randomUUID();

export async function autocomplete(input: string, { scope = 'regions', session, signal }: { scope?: 'regions' | 'all'; session: string; signal?: AbortSignal }) {
  const params = new URLSearchParams({ input, scope, session });
  return (await getJSON<{ suggestions: Suggestion[] }>(`/api/places-autocomplete?${params}`, signal)).suggestions;
}

export async function placeDetails(id: string, session: string) {
  return (await getJSON<{ place: Place }>(`/api/place-details?${new URLSearchParams({ id, session })}`)).place;
}

// Same lookup as the site's placeZone(): null when the server can't tell.
export async function placeZone(place: { latitude: number; longitude: number }) {
  try {
    const response = await fetch(`${apiUrl}/api/timezone?lat=${place.latitude}&lng=${place.longitude}`);
    if (!response.ok) return null;
    return ((await response.json()) as { timeZone: string | null }).timeZone;
  } catch { return null; }
}
