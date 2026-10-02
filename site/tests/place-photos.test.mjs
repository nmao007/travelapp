import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhotoLookup, resolvePlacePhoto } from '../dist/place-photos.js';
import { matchingPhotoPage } from '../wiki-photo-match.mjs';
const photo = src => ({ getURI: () => src, authorAttributions: [{ displayName: 'Photographer' }] });
test('a failed Google image tries another real Google photo and keeps its attribution', async () => {
  let calls = 0;
  const good = photo('good');
  const source = await resolvePlacePhoto({ photos: [photo('broken'), good] }, { width: 420, lookup: () => { calls++; }, fallback: () => { throw new Error('Unexpected fallback'); }, load: async src => { if (src === 'broken') throw new Error('Expired'); return src; } });
  assert.equal(source.src, 'good'); assert.equal(source.googlePhoto, good); assert.equal(calls, 0);
});
test('missing search photos trigger a photos-only lookup before Wikimedia', async () => {
  const calls = [], google = photo('google');
  const source = await resolvePlacePhoto({ placeId: 'real-id' }, { width: 900, lookup: async id => { calls.push(id); return [google]; }, load: async src => src, fallback: () => { throw new Error('Unexpected fallback'); } });
  assert.deepEqual(calls, ['real-id']); assert.equal(source.googlePhoto, google);
});
test('an expired photo can refresh its metadata, and missing provider photos use a verified fallback', async () => {
  const record = { placeId: 'real-id', photos: [photo('expired')] };
  let refreshed = false;
  const source = await resolvePlacePhoto(record, { width: 420, lookup: async (id, refresh) => { refreshed = refresh; return [photo('new')]; }, load: async src => { if (src === 'expired') throw new Error(); return src; }, fallback: async () => null });
  assert.equal(refreshed, true); assert.equal(source.src, 'new');
  const fallback = await resolvePlacePhoto({ placeId: 'no-google-photo' }, { width: 420, lookup: async () => [], load: async src => src, fallback: async () => ({ src: 'verified', license: 'CC BY' }) });
  assert.equal(fallback.license, 'CC BY');
});
test('photo lookups coalesce duplicate requests, bound concurrency and retry empty responses later', async () => {
  let time = 0, active = 0, peak = 0, calls = 0;
  const pending = [];
  const lookup = createPhotoLookup(async () => { calls++; active++; peak = Math.max(peak, active); await new Promise(resolve => pending.push(resolve)); active--; return []; }, { limit: 2, now: () => time });
  const first = lookup('one'); assert.equal(first, lookup('one'));
  const second = lookup('two'), third = lookup('three');
  await Promise.resolve(); assert.equal(calls, 2);
  pending.shift()(); await first;
  await new Promise(resolve => setImmediate(resolve));
  pending.splice(0).forEach(resolve => resolve()); await Promise.all([second, third]);
  assert.equal(peak, 2); assert.equal(calls, 3); assert.equal(lookup('one'), first);
  time = 46000; const retry = lookup('one'); assert.notEqual(retry, first);
  await Promise.resolve(); pending.shift()(); await retry; assert.equal(calls, 4);
});
test('fallback images must match both the place name and nearby coordinates', () => {
  const page = { title: 'Namba Yasaka Shrine', coordinates: [{ lat: 34.66, lon: 135.49 }], thumbnail: { source: 'real-photo' } };
  assert.ok(matchingPhotoPage(page, 'Namba Yasaka Jinja', 34.66, 135.49, () => 0));
  assert.equal(matchingPhotoPage({ ...page, title: 'Namba Parks' }, 'Namba Yasaka Jinja', 34.66, 135.49, () => 0), false);
  assert.equal(matchingPhotoPage(page, 'Namba Yasaka Jinja', 34.66, 135.49, () => 3), false);
  assert.equal(matchingPhotoPage({ ...page, title: 'JR Namba Station' }, 'Namba Parks', 34.66, 135.49, () => 0), false);
  assert.ok(matchingPhotoPage({ ...page, title: 'File:Namba Yasaka-jinja.jpg' }, 'Namba Yasaka Jinja', 34.66, 135.49, () => 0));
  assert.ok(matchingPhotoPage({ ...page, title: 'File:Ninen-zaka Kyoto.jpg' }, 'Ninenzaka', 34.66, 135.49, () => 0));
  assert.equal(matchingPhotoPage({ ...page, title: 'File:Sannen-zaka Kyoto.jpg' }, 'Ninenzaka', 34.66, 135.49, () => 0), false);
});
test('all available Google photos can be used and an empty array does not hide the primary photo', async () => {
  const source = await resolvePlacePhoto({ placeId: 'real', photos: Array.from({ length: 6 }, (_, i) => photo(String(i))) }, { width: 420, load: async src => { if (src !== '5') throw new Error('Unavailable'); return src; }, lookup: () => { throw new Error('Unexpected refresh'); }, fallback: () => null });
  assert.equal(source.src, '5');
  const primary = await resolvePlacePhoto({ placeId: 'real', photos: [], photo: photo('primary') }, { width: 420, load: async src => src, lookup: () => [], fallback: () => null });
  assert.equal(primary.src, 'primary');
});
test('a fast successful photo renders without waiting for its slow neighbor', async () => {
  const source = await resolvePlacePhoto({ photos: [photo('slow'), photo('fast')] }, { width: 420, load: src => src === 'slow' ? new Promise(() => {}) : Promise.resolve(src), lookup: () => [], fallback: () => null });
  assert.equal(source.src, 'fast');
});
test('fresh photo metadata can retry the same URI after a transient image failure', async () => {
  let attempts = 0;
  const source = await resolvePlacePhoto({ placeId: 'real', photos: [photo('image')] }, { width: 420, load: async src => { if (++attempts === 1) throw new Error('Transient'); return src; }, lookup: async () => [photo('image')], fallback: () => null });
  assert.equal(source.src, 'image'); assert.equal(attempts, 2);
});
test('photos are fetched fresh on later lookups, while pending duplicates are coalesced', async () => {
  let calls = 0;
  const lookup = createPhotoLookup(async () => { calls++; return [photo('fresh')]; });
  const first = lookup('real'); assert.equal(lookup('real'), first); await first;
  await lookup('real'); assert.equal(calls, 2);
});
test('a stalled photo metadata request releases the queue for other places', async () => {
  const lookup = createPhotoLookup(id => id === 'stalled' ? new Promise(() => {}) : Promise.resolve([photo('good')]), { limit: 1, timeoutMs: 5 });
  const failed = assert.rejects(lookup('stalled'), /timed out/);
  const good = lookup('next'); await failed; assert.equal((await good)[0].getURI(), 'good');
});

test('a healthy first image does not request additional Google photos', async () => {
  const requested = [];
  const source = await resolvePlacePhoto({ photos: [photo('first'), photo('second'), photo('third')] }, { width: 420, load: async src => { requested.push(src); return src; }, lookup: () => { throw new Error('Unexpected lookup'); }, fallback: () => null });
  assert.equal(source.src, 'first'); assert.deepEqual(requested, ['first']);
});
