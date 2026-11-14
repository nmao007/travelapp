// Supabase (PostgREST) requests for saving trips without silently overwriting
// edits made on another device. Platform-neutral: callers send the requests
// with their own fetch and session, and keep the cloud versions they last saw.

export const TRIPS_QUERY = 'planner_trips?select=id,trip,updated_at&order=updated_at.desc';

const eq = value => `eq.${encodeURIComponent(value)}`;

// `base` is the updated_at this device last read or wrote for the trip. With a
// base, only update the row if nobody changed it since; without one (a new trip,
// or a change queued before versions were tracked), fall back to an upsert.
export function tripWriteRequest(entry, userId, base = null) {
  if (entry.type === 'delete') {
    return { path: `planner_trips?id=${eq(entry.id)}&user_id=${eq(userId)}`, method: 'DELETE', headers: { Prefer: 'return=minimal' } };
  }
  const select = 'select=updated_at';
  if (base) {
    return {
      path: `planner_trips?id=${eq(entry.id)}&user_id=${eq(userId)}&updated_at=${eq(base)}&${select}`,
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ trip: entry.trip, updated_at: entry.updated_at }),
    };
  }
  return {
    path: `planner_trips?on_conflict=user_id,id&${select}`,
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify({ user_id: userId, id: entry.id, trip: entry.trip, updated_at: entry.updated_at }),
  };
}

// A conditional update that matched no row means the trip changed (or was
// deleted) elsewhere since this device last saw it.
export function tripWriteResult(entry, rows) {
  if (entry.type === 'delete') return { status: 'saved', updatedAt: null };
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return { status: 'conflict' };
  return { status: 'saved', updatedAt: row.updated_at || entry.updated_at };
}

export function cloudVersions(rows) {
  return Object.fromEntries((Array.isArray(rows) ? rows : []).filter(row => row?.id && row.updated_at).map(row => [row.id, row.updated_at]));
}
