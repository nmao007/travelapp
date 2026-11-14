import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudSync, TRIPS_KEY } from '../dist/cloud-sync.js';

// An in-memory planner_trips table that answers the PostgREST requests trip-sync builds.
function fakeSupabase() {
  const rows = new Map(); let clock = 0;
  const stamp = () => `2026-11-14T10:00:${String(++clock).padStart(2, '0')}+00:00`;
  const param = (path, name) => { const match = new RegExp(`[?&]${name}=eq\\.([^&]+)`).exec(path); return match ? decodeURIComponent(match[1]) : null; };
  async function request(path, init = {}) {
    const method = init.method || 'GET', id = param(path, 'id');
    if (method === 'GET') return [...rows.values()].filter(row => !id || row.id === id).map(row => ({ ...row }));
    if (method === 'DELETE') { rows.delete(id); return null; }
    const body = JSON.parse(init.body);
    if (method === 'PATCH') {
      const row = rows.get(id);
      if (!row || row.updated_at !== param(path, 'updated_at')) return [];
      Object.assign(row, { trip: body.trip, updated_at: stamp() }); return [{ updated_at: row.updated_at }];
    }
    const row = { id: body.id, trip: body.trip, updated_at: stamp() }; rows.set(body.id, row); return [{ updated_at: row.updated_at }];
  }
  return { rows, request };
}
function memoryStorage() {
  const values = new Map();
  return { values, getItem: async key => values.get(key) ?? null, setItem: async (key, value) => { values.set(key, value); }, removeItem: async key => { values.delete(key); } };
}
let n = 0;
const kyoto = { id: 'k', placeId: 'place-kyoto', name: 'Kyoto', latitude: 35.01, longitude: 135.77 };

test('signed-out trips stay on the device; signing in adopts and uploads them', async () => {
  const db = fakeSupabase(), storage = memoryStorage();
  const sync = createCloudSync({ storage, request: db.request, uuid: () => `v${++n}` });
  await sync.saveTrip(null, kyoto);
  assert.equal(db.rows.size, 0);
  assert.deepEqual((await sync.adoptGuestTrips('u1')).map(trip => trip.id), ['k']);
  assert.equal(storage.values.has(TRIPS_KEY), false);
  const trips = await sync.loadTrips('u1');
  assert.deepEqual(trips.map(trip => trip.name), ['Kyoto']);
  assert.equal(db.rows.get('k').trip.name, 'Kyoto');
  assert.deepEqual(await sync.pending('u1'), []);
});

test('an edit from a device with an out-of-date copy does not overwrite the newer cloud trip', async () => {
  const db = fakeSupabase();
  const conflicts = [];
  const phone = createCloudSync({ storage: memoryStorage(), request: db.request, uuid: () => `v${++n}`, onConflict: trip => conflicts.push(trip) });
  const laptop = createCloudSync({ storage: memoryStorage(), request: db.request, uuid: () => `v${++n}` });
  await phone.saveTrip('u1', kyoto);
  await phone.loadTrips('u1'); await laptop.loadTrips('u1');
  await laptop.saveTrip('u1', { ...kyoto, title: 'Laptop title' });
  await phone.saveTrip('u1', { ...kyoto, title: 'Phone title' });
  assert.equal(db.rows.get('k').trip.title, 'Laptop title');
  assert.equal(conflicts.at(-1).title, 'Laptop title');
  assert.equal((await phone.readTrips('u1'))[0].title, 'Laptop title');
  // Once caught up, the phone's next edit saves normally.
  await phone.saveTrip('u1', { ...kyoto, title: 'Phone again' });
  assert.equal(db.rows.get('k').trip.title, 'Phone again');
});

test('a failed upload stays queued and is sent on the next sync', async () => {
  const db = fakeSupabase(); let offline = true;
  const request = (path, init) => offline ? Promise.reject(new Error('offline')) : db.request(path, init);
  const sync = createCloudSync({ storage: memoryStorage(), request, uuid: () => `v${++n}` });
  await assert.rejects(sync.saveTrip('u1', kyoto));
  assert.equal((await sync.pending('u1')).length, 1);
  assert.equal((await sync.readTrips('u1'))[0].name, 'Kyoto');
  offline = false;
  await sync.loadTrips('u1');
  assert.equal(db.rows.get('k').trip.name, 'Kyoto');
  assert.deepEqual(await sync.pending('u1'), []);
});
