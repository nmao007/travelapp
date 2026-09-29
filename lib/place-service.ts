/** Provider records are real source data, not generated descriptions or fabricated availability. */
export type RealPlace = {
  id: string; name: string; address: string; latitude: number; longitude: number;
  category: string; sourceUrl: string; fetchedAt: string; country?: string; region?: string;
  nativeName?: string; website?: string; phone?: string; hoursText?: string;
};
export class PlaceSearchError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
export function normalizePlaces(data: unknown, fetchedAt: string): RealPlace[] {
  if (!Array.isArray(data)) throw new PlaceSearchError('The place service returned an unexpected response.', 502);
  const seen = new Set<string>();
  const seenNames = new Set<string>();
  return data.slice(0, 8).flatMap((raw: unknown) => {
    if (!raw || typeof raw !== 'object') return [];
    const value = raw as Record<string, unknown>;
    if (!['node', 'way', 'relation'].includes(String(value.osm_type)) || !Number.isSafeInteger(value.osm_id) || Number(value.osm_id) < 1) return [];
    if (typeof value.lat !== 'string' || typeof value.lon !== 'string' || typeof value.display_name !== 'string') return [];
    const latitude = Number(value.lat), longitude = Number(value.lon);
    if (!value.lat.trim() || !value.lon.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return [];
    const id = `osm:${value.osm_type}:${value.osm_id}`;
    if (seen.has(id)) return [];
    seen.add(id);
    const labelKey = value.display_name.toLocaleLowerCase('en').replace(/\s+/g, ' ').trim();
    if (seenNames.has(labelKey)) return [];
    seenNames.add(labelKey);
    const address = value.address && typeof value.address === 'object' ? value.address as Record<string, unknown> : {};
    return [{ country: typeof address.country === 'string' ? address.country.slice(0, 100) : undefined, region: typeof address.state === 'string' ? address.state.slice(0, 100) : undefined, id, name: (typeof value.name === 'string' && value.name.trim() ? value.name : value.display_name.split(',')[0]).slice(0, 160), address: value.display_name.slice(0, 300), latitude, longitude, category: typeof value.type === 'string' ? value.type.replaceAll('_', ' ').slice(0, 50) : 'Place', sourceUrl: `https://www.openstreetmap.org/${value.osm_type}/${value.osm_id}`, fetchedAt }];
  });
}
export function placeQuery(query: string, destination: string): string {
  const clean = (s: string) => s.trim().replace(/\s+/g, ' ');
  const q = clean(query), city = clean(destination);
  if (q.length < 2 || q.length > 160 || city.length > 160 || /[\x00-\x1f]/.test(query + destination)) throw new PlaceSearchError('Enter a place name or type, up to 160 characters.', 400);
  return city && !q.toLowerCase().includes(city.toLowerCase()) ? `${q}, ${city}` : q;
}
// One server only: explicit user searches, bounded queue, 1.1s spacing and a bounded 24h cache.
// Public Nominatim is NOT enabled by default in production or for distributed/serverless deployment.
export class PlaceSearchService {
  private cache = new Map<string, { until: number; places: RealPlace[] }>();
  private inFlight = new Map<string, Promise<RealPlace[]>>();
  private queue: Promise<void> = Promise.resolve();
  private nextAt = 0;
  private endpoint: string;
  private fetcher: typeof fetch;
  constructor(endpoint = 'https://nominatim.openstreetmap.org/search', fetcher: typeof fetch = fetch) {
    this.endpoint = endpoint; this.fetcher = fetcher;
    const url = new URL(endpoint);
    if (url.protocol !== 'https:') throw new Error('Place services must use HTTPS.');
  }
  search(query: string, destination: string, mode: 'place' | 'destination' = 'place'): Promise<RealPlace[]> {
    const combined = placeQuery(query, destination), key = `${mode}:${combined.toLowerCase()}`;
    const cached = this.cache.get(key);
    if (cached && cached.until > Date.now()) return Promise.resolve(cached.places);
    if (this.inFlight.has(key)) return this.inFlight.get(key)!;
    if (this.inFlight.size >= 4) return Promise.reject(new PlaceSearchError('Place search is busy. Try again in a few seconds.', 429));
    const task = this.queue.then(async () => {
      const pause = this.nextAt - Date.now();
      if (pause > 0) await new Promise(resolve => setTimeout(resolve, pause));
      const url = new URL(this.endpoint);
      url.search = new URLSearchParams({ q: combined, format: 'jsonv2', limit: '8', 'accept-language': 'en' }).toString();
      if (mode === 'destination') { url.searchParams.set('featureType', 'city'); url.searchParams.set('addressdetails', '1'); }
      this.nextAt = Date.now() + 1100;
      let response: Response;
      try { response = await this.fetcher(url, { headers: { 'User-Agent': 'TripPilot/0.2 (single-server travel planner)', Accept: 'application/json' }, signal: AbortSignal.timeout(8000), cache: 'no-store', redirect: 'error' }); }
      catch { throw new PlaceSearchError('Place search could not connect. Try again shortly.', 503); }
      if (!response.ok) throw new PlaceSearchError(response.status === 429 ? 'The place service is busy. Try again shortly.' : 'Place search is temporarily unavailable.', response.status === 429 ? 429 : 502);
      const text = await response.text();
      if (text.length > 250_000) throw new PlaceSearchError('The place service returned an oversized response.', 502);
      let data: unknown;
      try { data = JSON.parse(text); } catch { throw new PlaceSearchError('The place service returned an invalid response.', 502); }
      const places = normalizePlaces(data, new Date().toISOString());
      if (this.cache.size >= 256) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, { until: Date.now() + 86400000, places });
      return places;
    });
    this.queue = task.then(() => {}, () => {});
    this.inFlight.set(key, task);
    void task.finally(() => this.inFlight.delete(key)).catch(() => {});
    return task;
  }
}
