// Photo metadata is kept only in this session. Fetch only photos, rather than
// charging every visible recommendation for a full Place Details request.
export function createPhotoLookup(fetchPhotos, { limit = 3, now = Date.now, timeoutMs = 8000 } = {}) {
  const cache = new Map(), queue = [];
  let active = 0;
  function drain() {
    while (active < limit && queue.length) {
      const job = queue.shift(); active++;
      let timer;
      Promise.race([Promise.resolve().then(() => fetchPhotos(job.id, job.record)), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Photo lookup timed out')), timeoutMs); })]).then(job.resolve, job.reject).finally(() => { clearTimeout(timer); active--; drain(); });
    }
  }
  return (id, refresh = false, record = null) => {
    const existing = cache.get(id);
    if (existing && (!refresh || existing.pending) && existing.expires > now()) return existing.promise;
    const entry = { expires: Infinity, pending: true };
    entry.promise = new Promise((resolve, reject) => { queue.push({ id, record, resolve, reject }); drain(); })
      .then(photos => { entry.pending = false; entry.expires = now() + (photos?.length ? 0 : 45000); return photos || []; }, error => { entry.pending = false; entry.expires = now() + 5000; throw error; });
    cache.set(id, entry);
    if (cache.size > 200) for (const [key, value] of cache) { if (!value.pending && key !== id) { cache.delete(key); break; } }
    return entry.promise;
  };
}

export async function resolvePlacePhoto(record, { width, lookup, load, fallback }) {
  async function tryPhotos(photos) {
    const tried = new Set();
    // Do not hedge a healthy image with another billable photo request.
    // Try the next photo only if the current image actually fails.
    for (const photo of (photos || []).slice(0, 10)) {
      try {
        const src = photo.getURI({ maxWidth: width });
        if (!src || tried.has(src)) continue;
        tried.add(src);
        return { src, image: await load(src), googlePhoto: photo };
      } catch { /* An expired or broken photo can try the next real image. */ }
    }
    return null;
  }
  const initial = [...new Set([...(record.photos || []), ...(record.photo ? [record.photo] : [])])];
  let result = await tryPhotos(initial);
  if (result) return result;
  if (initial.length || !record.photosLoaded) {
    try { result = await tryPhotos(await lookup(record.placeId, initial.length > 0, record)); } catch { /* Try a verified public photo below. */ }
  }
  if (result) return result;
  try {
    const source = await fallback(record, width);
    if (!source?.src) return null;
    return { ...source, image: await load(source.src) };
  } catch { return null; }
}


// Reuse already displayed images during this visit, never persist Google photo
// names or references. Each caller clones the loaded image before mounting it.
export function createPhotoDisplayCache(resolve, { now = Date.now, ttl = 5 * 60000, limit = 64 } = {}) {
  const cache = new Map();
  return (record, width, destination = false) => {
    const key = `${record.placeId}:${width}:${destination}`, existing = cache.get(key);
    if (existing && (existing.pending || existing.expires > now())) return existing.promise;
    const entry = { pending: true, expires: Infinity };
    entry.promise = Promise.resolve().then(() => resolve(record, width, destination)).then(source => {
      entry.pending = false; entry.expires = now() + (source ? ttl : 60000);
      if (!source) return null;
      const { googlePhoto, ...display } = source;
      // Only retain the attribution needed by the displayed asset, not the Photo object.
      return googlePhoto ? { ...display, googlePhoto: { authorAttributions: googlePhoto.authorAttributions, googleMapsURI: googlePhoto.googleMapsURI } } : display;
    }, error => { entry.pending = false; entry.expires = now() + 60000; throw error; });
    cache.set(key, entry);
    if (cache.size > limit) for (const [id, value] of cache) if (!value.pending && id !== key) { cache.delete(id); break; }
    return entry.promise;
  };
}
