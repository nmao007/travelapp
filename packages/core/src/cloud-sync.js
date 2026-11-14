// Offline-first trip storage with conflict-checked Supabase sync.
// Platform-neutral: pass a key/value `storage` (sync or async, like
// localStorage or AsyncStorage) and a `request(path, init)` that sends a
// PostgREST request for the signed-in user and resolves to parsed JSON or null.
import { isTrip, normalizeTrip } from './trip-model.js';
import { TRIPS_QUERY, tripWriteRequest, tripWriteResult, cloudVersions } from './trip-sync.js';

export const TRIPS_KEY = 'trippilot-site-trips-v1';

export function createCloudSync({ storage, request, onConflict = () => {}, now = () => new Date(), uuid = () => crypto.randomUUID() }) {
  let writes = Promise.resolve();
  const tripsKey = userId => userId ? `${TRIPS_KEY}:user:${userId}` : TRIPS_KEY;
  const pendingKey = userId => `${TRIPS_KEY}:user:${userId}:pending`;
  const versionsKey = userId => `${TRIPS_KEY}:user:${userId}:versions`;

  async function readJSON(key, fallback) {
    try { const value = JSON.parse((await storage.getItem(key)) || 'null'); return value ?? fallback; }
    catch { return fallback; }
  }
  const writeJSON = (key, value) => storage.setItem(key, JSON.stringify(value));

  async function readTrips(userId) {
    const value = await readJSON(tripsKey(userId), []);
    return Array.isArray(value) ? value.filter(isTrip).map(normalizeTrip) : [];
  }

  async function storeTrip(userId, trip) {
    const trips = await readTrips(userId);
    await writeJSON(tripsKey(userId), [trip, ...trips.filter(item => item.id !== trip.id)]);
  }

  async function readVersions(userId) {
    const value = await readJSON(versionsKey(userId), {});
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }
  async function setVersion(userId, id, updatedAt) {
    const versions = await readVersions(userId);
    if (updatedAt) versions[id] = updatedAt; else delete versions[id];
    await writeJSON(versionsKey(userId), versions);
  }

  async function readPending(userId) {
    const value = await readJSON(pendingKey(userId), []);
    return Array.isArray(value) ? value : [];
  }
  async function enqueue(userId, entry) {
    await writeJSON(pendingKey(userId), [...(await readPending(userId)).filter(item => item.id !== entry.id), entry]);
  }
  async function clearIfCurrent(userId, entry) {
    const rest = (await readPending(userId)).filter(item => item.id !== entry.id || item.version !== entry.version);
    if (rest.length) await writeJSON(pendingKey(userId), rest); else await storage.removeItem(pendingKey(userId));
  }

  async function resolveConflict(userId, entry) {
    const rows = await request(`planner_trips?select=id,trip,updated_at&id=eq.${encodeURIComponent(entry.id)}&user_id=eq.${encodeURIComponent(userId)}`, { method: 'GET' });
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row || !isTrip(row.trip)) {
      // Deleted elsewhere while edited here: keep this device's edit.
      const write = tripWriteRequest(entry, userId, null);
      await setVersion(userId, entry.id, tripWriteResult(entry, await request(write.path, write)).updatedAt);
      return;
    }
    const trip = normalizeTrip(row.trip);
    await storeTrip(userId, trip);
    await setVersion(userId, entry.id, row.updated_at);
    onConflict(trip);
  }

  async function write(userId, entry) {
    const base = (await readVersions(userId))[entry.id] || null;
    const call = tripWriteRequest(entry, userId, base);
    const result = tripWriteResult(entry, await request(call.path, call));
    if (result.status === 'conflict') await resolveConflict(userId, entry);
    else await setVersion(userId, entry.id, result.updatedAt);
    await clearIfCurrent(userId, entry);
  }

  async function flush(userId) {
    for (const entry of await readPending(userId)) await write(userId, entry);
  }

  // Serialize cloud writes so each one sees the version the previous saved.
  function queue(operation) {
    const next = writes.catch(() => {}).then(operation);
    writes = next.catch(() => {});
    return next;
  }

  return {
    readTrips,
    pending: readPending,
    async saveTrip(userId, trip) {
      if (!isTrip(trip)) throw new Error('Choose a destination first.');
      const saved = normalizeTrip(trip);
      await storeTrip(userId, saved);
      if (!userId) return saved;
      await enqueue(userId, { type: 'upsert', id: saved.id, trip: saved, updated_at: now().toISOString(), version: uuid() });
      return queue(() => flush(userId)).then(() => saved);
    },
    async deleteTrip(userId, id) {
      await writeJSON(tripsKey(userId), (await readTrips(userId)).filter(trip => trip.id !== id));
      if (!userId) return;
      await enqueue(userId, { type: 'delete', id, version: uuid() });
      return queue(() => flush(userId));
    },
    // Upload queued changes first, then replace the local list with the cloud's.
    loadTrips(userId) {
      return queue(async () => {
        await flush(userId);
        const rows = await request(TRIPS_QUERY, { method: 'GET' });
        await writeJSON(versionsKey(userId), cloudVersions(rows));
        const trips = (Array.isArray(rows) ? rows : []).map(row => row.trip).filter(isTrip).map(normalizeTrip);
        await writeJSON(tripsKey(userId), trips);
        return trips;
      });
    },
    // Trips planned before signing in join the account (the account's copy
    // wins when ids collide) and are queued for upload.
    async adoptGuestTrips(userId) {
      const guest = await readTrips(null);
      await storage.removeItem(TRIPS_KEY);
      if (!userId || !guest.length) return [];
      const known = new Set((await readTrips(userId)).map(trip => trip.id));
      const adopted = guest.filter(trip => !known.has(trip.id));
      await writeJSON(tripsKey(userId), [...adopted, ...(await readTrips(userId))]);
      for (const trip of adopted) await enqueue(userId, { type: 'upsert', id: trip.id, trip, updated_at: now().toISOString(), version: uuid() });
      return adopted;
    },
    flush: userId => queue(() => flush(userId)),
  };
}
