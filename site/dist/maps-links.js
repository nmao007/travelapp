// Universal Maps URLs open the matching place or map without another API key.
const point = place => Number.isFinite(place?.latitude) && Math.abs(place.latitude) <= 90 && Number.isFinite(place?.longitude) && Math.abs(place.longitude) <= 180 ? `${place.latitude},${place.longitude}` : '';
const query = place => (!place?.placeId && point(place)) || [place?.kind === 'Tour' ? place?.tour?.meetingName || place?.name : place?.name, place?.address].filter(Boolean).join(', ') || point(place);
function mapsURL(path, params) {
  const url = new URL(path, 'https://www.google.com');
  url.search = new URLSearchParams({ api: '1', ...params }).toString();
  return url.href;
}
export function placeMapsURL(place) {
  const text = query(place); if (!text) return null;
  return mapsURL('/maps/search/', { query: text, ...(place.placeId ? { query_place_id: place.placeId } : {}) });
}
export function mapViewURL(place, zoom = 13) {
  const center = point(place); if (!center) return placeMapsURL(place);
  return mapsURL('/maps/@', { map_action: 'map', center, zoom: String(Math.max(0, Math.min(21, Math.round(Number.isFinite(Number(zoom)) ? Number(zoom) : 13)))) });
}
export function directionsMapsURL(destination, origin = null, mode = null) {
  const target = query(destination); if (!target) return null;
  const modes = { WALK: 'walking', DRIVE: 'driving', TRANSIT: 'transit' };
  return mapsURL('/maps/dir/', { destination: target, ...(destination.placeId ? { destination_place_id: destination.placeId } : {}), ...(origin && query(origin) ? { origin: query(origin), ...(origin.placeId ? { origin_place_id: origin.placeId } : {}) } : {}), ...(modes[mode] ? { travelmode: modes[mode] } : {}) });
}
