import { inSearchArea, viewportSearchArea } from './explore-model.js';
import { isTourOperator } from './tour-model.js';

export const placeSearchGroups = {
  see: { types: ['tourist_attraction', 'historical_landmark', 'museum', 'art_gallery'], query: 'tourist attractions' },
  eat: { types: ['restaurant', 'cafe', 'bakery'], query: 'restaurants and cafes', primary: true },
  stay: { types: ['hotel'], query: 'hotels' },
  nature: { types: ['park', 'hiking_area', 'national_park'], query: 'parks and outdoor attractions' },
  culture: { types: ['museum', 'art_gallery', 'historical_landmark'], query: 'museums and art galleries' },
  tour: { types: ['tour_agency'], query: 'tour operators', primary: true },
};
export const placeSearchFields = ['id', 'displayName', 'formattedAddress', 'location', 'photos', 'rating', 'userRatingCount', 'primaryType', 'types', 'primaryTypeDisplayName', 'businessStatus'];
export const quotaFailure = error => /RESOURCE_EXHAUSTED|OVER_QUERY_LIMIT|quota exceeded/i.test(String(error?.message || error));
const mapClickGroup = { query: 'places', textOnly: true };
const mixedGroup = { types: [...new Set(['see', 'eat', 'stay', 'nature', 'tour'].flatMap(key => placeSearchGroups[key].types))], query: 'tourist attractions restaurants hotels parks and tour operators' };
export function clickedPlaceArea(point) {
  if (!Number.isFinite(point?.lat) || !Number.isFinite(point?.lng) || Math.abs(point.lat) >= 89.9 || Math.abs(point.lng) > 180) return null;
  const latitude = 60 / 111320, longitude = latitude / Math.cos(point.lat * Math.PI / 180);
  const wrap = value => ((value + 180) % 360 + 360) % 360 - 180;
  return viewportSearchArea({ north: point.lat + latitude, south: point.lat - latitude, west: wrap(point.lng - longitude), east: wrap(point.lng + longitude) }, 0);
}
const searchBounds = area => {
  const r = area.rectangle;
  return !r.allLongitudes && r.west < r.east ? { locationRestriction: { north: r.north, south: r.south, east: r.east, west: r.west } } : { locationBias: { center: area.center, radius: area.radius } };
};
export async function boundedPlaceRequest(call, timeoutMs = 8000) {
  let timer;
  try { return await Promise.race([Promise.resolve().then(call), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('PLACE_SEARCH_TIMEOUT')), timeoutMs); })]); }
  finally { clearTimeout(timer); }
}
// Persist only retry deadlines, never place content or photo references. This
// prevents a reload from immediately retrying an already exhausted endpoint.
export function createQuotaMemory(storage, now = Date.now) {
  return {
    read(endpoint) {
      try {
        const until = Number(storage?.getItem(`trip:google-cooldown:${endpoint}`));
        return Number.isFinite(until) && until > now() && until <= now() + 30 * 60000 ? until : 0;
      } catch { return 0; }
    },
    block(endpoint) {
      const until = now() + 30 * 60000;
      try { storage?.setItem(`trip:google-cooldown:${endpoint}`, String(until)); } catch { /* Private browsing can deny storage. */ }
      return until;
    },
  };
}
export function createPlaceSearch({ nearby, text, record, now = Date.now, timeoutMs = 10000, concurrency = 2, quotaMemory }) {
  const cache = new Map(), records = new Map(), queue = [];
  let active = 0, nearbyBlockedUntil = quotaMemory?.read('nearby') || 0, textBlockedUntil = quotaMemory?.read('text') || 0;
  function drain() {
    while (active < concurrency && queue.length) {
      const job = queue.shift(); active++;
      Promise.resolve().then(job.run).then(job.resolve, job.reject).finally(() => { active--; drain(); });
    }
  }
  const queued = (run, priority) => new Promise((resolve, reject) => { queue[priority ? 'unshift' : 'push']({ run, resolve, reject }); drain(); });
  const bounded = call => boundedPlaceRequest(call, timeoutMs);
  function search(category, area, { force = false } = {}) {
    const group = category === 'map-click' ? mapClickGroup : category === 'mixed' ? mixedGroup : placeSearchGroups[category];
    if (!group || !area) return Promise.reject(new Error('Choose a map area and category.'));
    const key = `${category}:${area.key}`, saved = cache.get(key);
    if (saved && (saved.pending || (!force && saved.expires > now()))) return saved.promise;
    const entry = { pending: true, expires: Infinity };
    entry.promise = queued(async () => {
      const fields = [...placeSearchFields, ...(category === 'tour' ? ['websiteURI', 'internationalPhoneNumber'] : [])];
      let response;
      if (!group.textOnly && now() >= nearbyBlockedUntil) {
        try { response = await bounded(() => nearby({ fields, locationRestriction: { center: area.center, radius: area.radius }, ...(group.primary ? { includedPrimaryTypes: group.types } : { includedTypes: group.types }), maxResultCount: 20, rankPreference: 'POPULARITY', language: 'en' })); }
        catch (error) { if (quotaFailure(error)) nearbyBlockedUntil = quotaMemory?.block('nearby') || now() + 30 * 60000; else if (error.message === 'PLACE_SEARCH_TIMEOUT') nearbyBlockedUntil = now() + 60000; }
      }
      if (!response) {
        if (now() < textBlockedUntil) throw new Error('PLACE_SEARCH_LIMIT');
        try { response = await bounded(() => text({ fields, textQuery: group.query, ...searchBounds(area), maxResultCount: 20, language: 'en' })); }
        catch (error) { if (quotaFailure(error)) { textBlockedUntil = quotaMemory?.block('text') || now() + 30 * 60000; throw new Error('PLACE_SEARCH_LIMIT'); } if (error.message === 'PLACE_SEARCH_TIMEOUT') textBlockedUntil = now() + 60000; throw error; }
      }
      const matches = [];
      for (const place of response.places || []) {
        try {
          const value = record(place);
          if (!value.placeId || !inSearchArea(area, { lat: value.latitude, lng: value.longitude }) || (category === 'tour' && !isTourOperator(value))) continue;
          records.set(value.placeId, value); matches.push(value);
        } catch { /* A malformed individual record must not freeze the category. */ }
      }
      while (records.size > 500) records.delete(records.keys().next().value);
      return matches.sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.ratingCount || 0) - (a.ratingCount || 0));
    }, category === 'map-click').then(result => { entry.pending = false; entry.expires = now() + 5 * 60000; return result; }, error => { if (cache.get(key) === entry) cache.delete(key); throw error; });
    cache.set(key, entry);
    if (cache.size > 60) for (const [id, item] of cache) if (!item.pending && id !== key) { cache.delete(id); break; }
    return entry.promise;
  }
  return { search, find: id => records.get(id) || null, async findAt(id, point) {
    if (records.has(id)) return records.get(id);
    const area = clickedPlaceArea(point); if (!id || !area) return null;
    return (await search('map-click', area)).find(place => place.placeId === id) || null;
  } };
}

// Each category contributes a few well-reviewed places rather than letting
// one category (or a single five-star review) fill the entire map.
export function topMapPlaces(groups, { perGroup = 3, minimumRating = 4.5, minimumReviews = 20 } = {}) {
  const selected = new Map();
  for (const group of groups) {
    let count = 0;
    for (const place of [...group].sort((a, b) => b.rating - a.rating || b.ratingCount - a.ratingCount)) {
      if (!Number.isFinite(place.rating) || place.rating < minimumRating || !Number.isFinite(place.ratingCount) || place.ratingCount < minimumReviews || (place.businessStatus && place.businessStatus !== 'OPERATIONAL') || selected.has(place.placeId)) continue;
      selected.set(place.placeId, place); if (++count === perGroup) break;
    }
  }
  return [...selected.values()];
}

export function placeIcon(place) {
  const type = place.primaryType || '', types = place.types || [];
  if (place.kind === 'Tour' || isTourOperator(place)) return 'guide';
  if (place.kind === 'Stay' || /hotel|lodging|resort|hostel|motel|guest_house|bed_and_breakfast|ryokan|inn/.test(type)) return 'stay';
  if (place.kind === 'Food' || /restaurant|cafe|bakery|bar|meal|coffee|tea_house|ice_cream/.test(type)) return 'food';
  if (/amusement|aquarium|zoo/.test(type)) return 'landmark';
  if (/park|hiking|garden|beach|natural/.test(type)) return 'leaf';
  if (/museum|gallery|historical|landmark|monument|tourist_attraction|cultural|castle|temple|shrine|church|mosque/.test(type) || types.includes('tourist_attraction')) return 'landmark';
  return 'pin';
}

// A completed or failed old request cannot overwrite a newer filter or trip.
export function createSearchSelection() {
  let version = 0;
  return { begin: (tripId, category, areaKey) => ({ version: ++version, tripId, category, areaKey }), invalidate: () => { version++; }, current: ticket => ticket.version === version };
}

export function mixedMapPlaces(places) {
  const groups = new Map();
  for (const place of places) { const key = placeIcon(place); if (!groups.has(key)) groups.set(key, []); groups.get(key).push(place); }
  return topMapPlaces([...groups.values()]);
}
