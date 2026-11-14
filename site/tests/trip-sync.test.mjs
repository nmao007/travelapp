import test from 'node:test';
import assert from 'node:assert/strict';
import { TRIPS_QUERY, tripWriteRequest, tripWriteResult, cloudVersions } from '../dist/trip-sync.js';

const entry = { type: 'upsert', id: 'trip-1', trip: { id: 'trip-1', name: 'Kyoto' }, updated_at: '2026-11-14T10:00:00.000Z' };

test('a trip this device has seen is only updated if nobody changed it since', () => {
  const request = tripWriteRequest(entry, 'user-1', '2026-11-13T09:00:00.123456+00:00');
  assert.equal(request.method, 'PATCH');
  assert.match(request.path, /updated_at=eq\.2026-11-13T09%3A00%3A00\.123456%2B00%3A00/);
  assert.match(request.path, /id=eq\.trip-1&user_id=eq\.user-1/);
  assert.equal(request.headers.Prefer, 'return=representation');
  assert.deepEqual(JSON.parse(request.body), { trip: entry.trip, updated_at: entry.updated_at });
});

test('a new trip, or one queued before versions were tracked, is upserted', () => {
  const request = tripWriteRequest(entry, 'user-1');
  assert.equal(request.method, 'POST');
  assert.match(request.path, /^planner_trips\?on_conflict=user_id,id/);
  assert.equal(JSON.parse(request.body).user_id, 'user-1');
});

test('an update that matched no row is a conflict, otherwise the new version is kept', () => {
  assert.deepEqual(tripWriteResult(entry, []), { status: 'conflict' });
  assert.deepEqual(tripWriteResult(entry, [{ updated_at: '2026-11-14T10:00:00+00:00' }]), { status: 'saved', updatedAt: '2026-11-14T10:00:00+00:00' });
  const remove = { type: 'delete', id: 'trip-1' };
  assert.equal(tripWriteRequest(remove, 'user-1').method, 'DELETE');
  assert.deepEqual(tripWriteResult(remove, null), { status: 'saved', updatedAt: null });
});

test('cloud versions are read from the trip list', () => {
  assert.match(TRIPS_QUERY, /select=id,trip,updated_at/);
  assert.deepEqual(cloudVersions([{ id: 'a', updated_at: 't1' }, { id: 'b' }, null]), { a: 't1' });
});
