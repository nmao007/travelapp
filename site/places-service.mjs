// Google Places (New) for clients that can't run the Maps JavaScript API, such
// as the native app. The key stays on the server; results are cached briefly
// and each address is rate limited so the endpoint can't drain the quota.
function failure(message, status = 502) { return Object.assign(new Error(message), { status }); }

export function createPlacesService({ request = fetch, now = Date.now, perMinute = 60 } = {}) {
  const cache = new Map(), windows = new Map();

  function allow(client) {
    const minute = Math.floor(now() / 60_000), entry = windows.get(client);
    if (!entry || entry.minute !== minute) { windows.set(client, { minute, count: 1 }); if (windows.size > 5000) windows.delete(windows.keys().next().value); return; }
    if (++entry.count > perMinute) throw failure('Too many searches. Try again in a minute.', 429);
  }

  async function google(path, init, key) {
    if (!key) throw failure('Place search is not configured on the server.', 503);
    const response = await request(`https://places.googleapis.com/v1/${path}`, { ...init, headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': key, ...(init.headers || {}) }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) {
      if (response.status === 429) throw failure('Place search limit reached. Try again shortly.', 429);
      if (response.status === 403) throw failure('Enable Places API (New) for the server Maps key.', 502);
      throw failure('Place search is unavailable right now.');
    }
    return response.json();
  }

  async function cached(cacheKey, ttl, load) {
    const hit = cache.get(cacheKey);
    if (hit && hit.expires > now()) return hit.promise;
    const promise = load();
    cache.set(cacheKey, { promise, expires: now() + ttl });
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    try { return await promise; } catch (error) { cache.delete(cacheKey); throw error; }
  }

  return {
    // Same request as the site: regions only for destinations, any place otherwise.
    async autocomplete({ input, scope, session }, key, client) {
      const text = String(input || '').trim();
      if (!text || text.length > 120) throw failure('Type a place to search.', 400);
      allow(client);
      const regions = scope !== 'all';
      return cached(`a:${regions}:${text.toLowerCase()}`, 10 * 60_000, async () => {
        const data = await google('places:autocomplete', { method: 'POST', body: JSON.stringify({ input: text, languageCode: 'en', ...(regions ? { includedPrimaryTypes: ['(regions)'] } : {}), ...(session ? { sessionToken: String(session).slice(0, 64) } : {}) }) }, key);
        return (data.suggestions || []).map(item => item.placePrediction).filter(Boolean).slice(0, 5).map(prediction => ({
          placeId: prediction.placeId,
          name: prediction.structuredFormat?.mainText?.text || prediction.text?.text || '',
          detail: prediction.structuredFormat?.secondaryText?.text || '',
        })).filter(item => item.placeId && item.name);
      });
    },
    async details({ id, session }, key, client) {
      const placeId = String(id || '');
      if (!/^[\w-]{10,300}$/.test(placeId)) throw failure('Choose a place.', 400);
      allow(client);
      return cached(`d:${placeId}`, 60 * 60_000, async () => {
        const fields = 'id,displayName,formattedAddress,location,primaryType,types';
        const data = await google(`places/${encodeURIComponent(placeId)}?languageCode=en${session ? `&sessionToken=${encodeURIComponent(String(session).slice(0, 64))}` : ''}`, { method: 'GET', headers: { 'X-Goog-FieldMask': fields } }, key);
        if (!Number.isFinite(data.location?.latitude) || !Number.isFinite(data.location?.longitude)) throw failure('Google returned a place without a location.');
        return { placeId: data.id, name: data.displayName?.text || '', address: data.formattedAddress || '', latitude: data.location.latitude, longitude: data.location.longitude, primaryType: data.primaryType || '', types: data.types || [] };
      });
    },
  };
}
