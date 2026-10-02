const words = value => (String(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().match(/[\p{L}\p{N}]+/gu) || []).map(word => ({ jinja: 'shrine', parks: 'park', arts: 'art' })[word] || word);
const generic = new Set(['the', 'of', 'in', 'and', 'file', 'jpg', 'jpeg', 'png']);
export function matchingPhotoPage(page, title, lat, lng, distanceKm) {
  const point = page?.coordinates?.[0];
  if (!point || !page.thumbnail?.source || distanceKm({ lat, lng }, { lat: point.lat, lng: point.lon }) > 2) return false;
  const expected = words(title).filter(word => !generic.has(word));
  const titleWords = words(page.title);
  const actual = new Set([...titleWords, ...titleWords.slice(1).map((word, index) => titleWords[index] + word)]);
  // A nearby photo is not necessarily a photo of the requested place.
  return expected.length > 0 && expected.filter(word => actual.has(word)).length / expected.length >= .75;
}
