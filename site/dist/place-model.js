// Map entries have one marker per Google place, even across several trip days.
export function mapEntries(items = [], suggestions = []) {
  const entries = new Map();
  for (const item of items) {
    if (!Number.isFinite(item.latitude) || !Number.isFinite(item.longitude)) continue;
    const key = item.placeId || item.id;
    if (!entries.has(key)) entries.set(key, { ...item, planned: true, number: entries.size + 1 });
  }
  for (const place of suggestions) {
    if (!Number.isFinite(place.latitude) || !Number.isFinite(place.longitude) || entries.has(place.placeId)) continue;
    entries.set(place.placeId, { ...place, planned: false });
  }
  return [...entries.values()];
}

// Keep old unscheduled plans, but put them directly onto the first day once dated.
export function scheduleUnassigned(trip) {
  if (!trip.startDate) return trip;
  let changed = false;
  const seen = new Set();
  const items = (trip.items || []).map(item => {
    if (item.day && item.day !== 'ideas') return item;
    changed = true;
    return { ...item, day: trip.startDate };
  }).filter(item => {
    if (!item.placeId) return true;
    // Only collapse identical sourced entries; different times, notes or bookings stay separate.
    const key = JSON.stringify(Object.keys(item).filter(key => key !== 'id').sort().map(key => [key, item[key]]));
    if (seen.has(key)) { changed = true; return false; }
    seen.add(key); return true;
  });
  return changed ? { ...trip, items } : trip;
}

export function googlePlaceRecord(place) {
  if (!place?.id || !place.location) throw new Error('This place has no map location.');
  const field = name => { try { return place[name]; } catch { return undefined; } };
  const photos = field('photos') || [], types = field('types') || [];
  return {
    placeId: place.id, name: field('displayName') || 'Place', address: field('formattedAddress') || '',
    latitude: place.location.lat(), longitude: place.location.lng(),
    photo: photos[0] || null, photos, rating: field('rating'), ratingCount: field('userRatingCount'), types,
    websiteURI: field('websiteURI') || '', internationalPhoneNumber: field('internationalPhoneNumber') || '', businessStatus: field('businessStatus') || '',
    category: field('primaryTypeDisplayName') || '', primaryType: field('primaryType') || '', tourOperator: types.includes('tour_agency'),
    editorialSummary: googleDescription(field('editorialSummary')), googleMapsURI: field('googleMapsURI') || '',
    currentOpeningHours: field('currentOpeningHours'), regularOpeningHours: field('regularOpeningHours'),
    priceLevel: field('priceLevel'), accessibilityOptions: field('accessibilityOptions'), attributions: field('attributions') || [],
  };
}

// Descriptions come only from Google's editorial field. Photo sources and
// Wikipedia extracts must never become descriptions of a saved place.
export function googleDescription(summary) {
  return typeof summary === 'string' ? summary.trim() : typeof summary?.text === 'string' ? summary.text.trim() : '';
}
export function googleRatingLabel(place) {
  if (!Number.isFinite(place?.rating) || place.rating < 1 || place.rating > 5) return '';
  const count = Number.isInteger(place.ratingCount) && place.ratingCount > 0 ? ` · ${place.ratingCount.toLocaleString('en')} ${place.ratingCount === 1 ? 'review' : 'reviews'}` : '';
  return `${place.rating.toFixed(1)}${count}`;
}
export function mergeGoogleContent(saved, live) {
  if (!live || !saved?.placeId || live.placeId !== saved.placeId) return { ...saved };
  const merged = { ...saved };
  for (const [key, value] of Object.entries(live)) {
    if (value == null || value === '' || (Array.isArray(value) && !value.length)) continue;
    merged[key] = value;
  }
  return merged;
}

export function destinationForDay(trip, stops, day) {
  const dated = stops.map((stop, index) => ({ stop, date: stop.date || (index === 0 ? trip.startDate : null), index }))
    .filter(entry => entry.date && entry.date <= day)
    .sort((a, b) => b.date.localeCompare(a.date) || b.index - a.index);
  return dated[0]?.stop || stops[0];
}

// Label placement uses screen geometry, so it works without another Maps query.
export function mapLabelPosition(anchor, bounds, size, obstacles = []) {
  const gap = 12, edge = 10, width = Math.min(size.width, Math.max(1, bounds.width - edge * 2)), height = size.height;
  const candidates = [
    { left: anchor.left + (anchor.width - width) / 2, top: anchor.top - height - gap, side: 'above' },
    { left: anchor.left + anchor.width + gap, top: anchor.top + (anchor.height - height) / 2, side: 'right' },
    { left: anchor.left - width - gap, top: anchor.top + (anchor.height - height) / 2, side: 'left' },
    { left: anchor.left + (anchor.width - width) / 2, top: anchor.top + anchor.height + gap, side: 'below' },
  ];
  const overlap = (a, b) => Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));
  return candidates.map((candidate, index) => {
    const left = Math.max(edge, Math.min(bounds.width - edge - width, candidate.left));
    const top = Math.max(edge, Math.min(bounds.height - edge - height, candidate.top));
    const rect = { left, top, width, height };
    const score = overlap(rect, anchor) * 4 + obstacles.reduce((sum, obstacle) => sum + overlap(rect, obstacle), 0) + Math.abs(left - candidate.left) + Math.abs(top - candidate.top) + index * .01;
    return { left, top, side: candidate.side, score };
  }).sort((a, b) => a.score - b.score)[0];
}
