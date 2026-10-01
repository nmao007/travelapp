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
  return {
    placeId: place.id, name: place.displayName || 'Place', address: place.formattedAddress || '',
    latitude: place.location.lat(), longitude: place.location.lng(),
    photo: place.photos?.[0] || null, rating: place.rating, ratingCount: place.userRatingCount,
    category: place.primaryTypeDisplayName || '', primaryType: place.primaryType || '',
  };
}

export function destinationForDay(trip, stops, day) {
  const dated = stops.map((stop, index) => ({ stop, date: stop.date || (index === 0 ? trip.startDate : null), index }))
    .filter(entry => entry.date && entry.date <= day)
    .sort((a, b) => b.date.localeCompare(a.date) || b.index - a.index);
  return dated[0]?.stop || stops[0];
}
