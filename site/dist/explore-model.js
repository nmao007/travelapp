const radians = value => value * Math.PI / 180;
const wrap = value => ((value + 180) % 360 + 360) % 360 - 180;

export function distanceMeters(a, b) {
  const arc = Math.sin(radians(b.lat - a.lat) / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(radians(b.lng - a.lng) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, arc)));
}

// Nearby Search accepts a circle. Enclose the viewport, then clip returned places
// to its lightly padded rectangle so off-screen city landmarks cannot dominate.
export function viewportSearchArea(bounds, padding = .04) {
  if (!bounds || !['north', 'south', 'east', 'west'].every(key => Number.isFinite(bounds[key]))) return null;
  if (bounds.north <= bounds.south) return null;
  const width = bounds.east === 180 && bounds.west === -180 ? 360 : ((bounds.east - bounds.west) % 360 + 360) % 360;
  if (!width) return null;
  const height = bounds.north - bounds.south;
  const center = { lat: (bounds.north + bounds.south) / 2, lng: wrap(bounds.west + width / 2) };
  const rectangle = { north: Math.min(90, bounds.north + height * padding), south: Math.max(-90, bounds.south - height * padding), west: wrap(bounds.west - width * padding), east: wrap(bounds.east + width * padding), allLongitudes: width * (1 + 2 * padding) >= 360 };
  const radius = Math.min(50000, Math.max(1, Math.ceil(Math.max(...[rectangle.north, rectangle.south].flatMap(lat => [rectangle.east, rectangle.west].map(lng => distanceMeters(center, { lat, lng })))))));
  const key = [rectangle.north, rectangle.south, rectangle.east, rectangle.west].map(value => value.toFixed(5)).join(':');
  return { center, radius, rectangle, key };
}

export function inSearchArea(area, point) {
  if (!area || !Number.isFinite(point?.lat) || !Number.isFinite(point?.lng)) return false;
  const { rectangle: r } = area, lng = wrap(point.lng);
  return point.lat >= r.south && point.lat <= r.north && (r.allLongitudes || (r.west <= r.east ? lng >= r.west && lng <= r.east : lng >= r.west || lng <= r.east));
}

// Ignore tiny camera/layout shifts while still searching after a deliberate pan
// or zoom. No Google content is written to persistent storage.
export function createSearchAreaTracker() {
  let previous = null;
  return {
    reset() { previous = null; },
    read(bounds) {
      const next = viewportSearchArea(bounds);
      if (!next) return null;
      if (previous) {
        const heightRatio = (next.rectangle.north - next.rectangle.south) / (previous.rectangle.north - previous.rectangle.south);
        const span = area => area.rectangle.allLongitudes ? 360 : ((area.rectangle.east - area.rectangle.west + 360) % 360);
        const widthRatio = span(next) / span(previous);
        const ratio = next.radius / previous.radius;
        if (widthRatio >= .85 && widthRatio <= 1.18 && ratio >= .85 && ratio <= 1.18 && heightRatio >= .85 && heightRatio <= 1.18 && distanceMeters(next.center, previous.center) <= Math.min(next.radius, previous.radius) * .12) return previous;
      }
      previous = next; return next;
    },
  };
}
