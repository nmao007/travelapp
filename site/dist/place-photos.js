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
    const tried = new Set(), candidates = (photos || []).slice(0, 10);
    if (!candidates.length) return null;
    // Usually one image is enough. Hedge only a slow first image instead of
    // issuing two billable photo requests for every card immediately.
    return new Promise(resolve => {
      let index = 0, active = 0, settled = false, hedge;
      function next() {
        if (settled) return;
        if (index >= candidates.length) { if (!active) { clearTimeout(hedge); resolve(null); } return; }
        const photo = candidates[index++]; active++;
        Promise.resolve().then(async () => {
          const src = photo.getURI({ maxWidth: width });
          if (!src || tried.has(src)) throw new Error('Duplicate photo');
          tried.add(src);
          return { src, image: await load(src), googlePhoto: photo };
        }).then(result => { if (!settled) { settled = true; clearTimeout(hedge); resolve(result); } }, () => { active--; next(); });
      }
      next();
      hedge = setTimeout(() => { if (!settled && active < 2) next(); }, 250);
    });
  }
  const initial = [...new Set([...(record.photos || []), ...(record.photo ? [record.photo] : [])])];
  let result = await tryPhotos(initial);
  if (result) return result;
  try { result = await tryPhotos(await lookup(record.placeId, initial.length > 0, record)); } catch { /* Try a verified public photo below. */ }
  if (result) return result;
  try {
    const source = await fallback(record, width);
    if (!source?.src) return null;
    return { ...source, image: await load(source.src) };
  } catch { return null; }
}
