import { fixedItem, datesForTrip } from './itinerary-model.js';
import { isDate } from './domain.js';
export const STORAGE_KEY = 'trippilot-site-trips-v1';
const SESSION_KEY = 'trippilot-site-supabase-session-v1';
let configPromise;
let cloudWrites = Promise.resolve();

function getSupabaseConfig() {
  configPromise ||= fetch('/api/config', { cache: 'no-store' }).then(async response => {
    if (!response.ok) throw new Error('Could not load Supabase settings.');
    const config = await response.json();
    if (!config.supabaseUrl || !config.supabaseAnonKey) throw new Error('Supabase is not configured for this prototype.');
    return config;
  });
  return configPromise;
}

function readSession() {
  try { const value = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); return value?.access_token && value?.refresh_token && value?.user?.id ? value : null; }
  catch { return null; }
}

function saveSession(session) {
  const saved = { access_token: session.access_token, refresh_token: session.refresh_token, expires_at: session.expires_at || Math.floor(Date.now() / 1000) + Number(session.expires_in || 3600), user: session.user };
  localStorage.setItem(SESSION_KEY, JSON.stringify(saved));
  return saved;
}

async function authRequest(path, body, accessToken = null) {
  const config = await getSupabaseConfig();
  const headers = { apikey: config.supabaseAnonKey, 'content-type': 'application/json' };
  if (accessToken) headers.authorization = `Bearer ${accessToken}`;
  const response = await fetch(`${config.supabaseUrl}/auth/v1/${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.msg || result.message || result.error_description || result.error || 'Supabase could not complete that request.');
  return result;
}

async function ensureSession() {
  let session = readSession();
  if (!session) return null;
  if (session.expires_at <= Math.floor(Date.now() / 1000) + 45) {
    try { session = saveSession(await authRequest('token?grant_type=refresh_token', { refresh_token: session.refresh_token })); }
    catch { localStorage.removeItem(SESSION_KEY); return null; }
  }
  return session;
}

export function currentAccount() {
  const session = readSession();
  return session?.user ? { id: session.user.id, email: session.user.email || '' } : null;
}

function tripStorageKey() {
  const account = currentAccount();
  return account ? `${STORAGE_KEY}:user:${account.id}` : STORAGE_KEY;
}

export async function createAccount(email, password) {
  const result = await authRequest('signup', { email: String(email).trim().toLowerCase(), password: String(password) });
  if (!result.access_token || !result.refresh_token || !result.user?.id) throw new Error('Supabase requires email confirmation for this project. Disable email confirmations in Supabase Auth settings to sign in immediately.');
  saveSession(result);
  return currentAccount();
}

export async function signIn(email, password) {
  const result = await authRequest('token?grant_type=password', { email: String(email).trim().toLowerCase(), password: String(password) });
  if (!result.access_token || !result.refresh_token || !result.user?.id) throw new Error('Supabase did not return a signed-in session.');
  saveSession(result);
  return currentAccount();
}

export async function signOut() {
  await cloudWrites;
  const session = await ensureSession();
  if (session) { try { await authRequest('logout?scope=local', {}, session.access_token); } catch { /* Clear the local session even if the network is unavailable. */ } }
  localStorage.removeItem(SESSION_KEY);
}

export async function restoreSession() { return ensureSession(); }

async function restRequest(path, options = {}) {
  const config = await getSupabaseConfig();
  const session = await ensureSession();
  if (!session) throw new Error('Your session expired. Sign in again to sync trips.');
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: { apikey: config.supabaseAnonKey, authorization: `Bearer ${session.access_token}`, 'content-type': 'application/json', ...(options.headers || {}) },
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || result.hint || 'Supabase could not sync this trip. Check the planner_trips table and row-level security migration.');
  }
  return response.status === 204 ? null : response.json().catch(() => null);
}

export async function loadCloudTrips() {
  const session = await ensureSession();
  if (!session) return [];
  await flushPendingCloudChanges(session.user.id);
  const rows = await restRequest('planner_trips?select=id,trip&order=updated_at.desc');
  const trips = Array.isArray(rows) ? rows.map(row => row.trip).filter(isTrip).map(trip => ({ ...trip, stops: tripStops(trip), items: Array.isArray(trip.items) ? trip.items : [] })) : [];
  localStorage.setItem(tripStorageKey(), JSON.stringify(trips));
  return trips;
}

function queueCloudWrite(operation) {
  cloudWrites = cloudWrites.catch(() => {}).then(operation).catch(() => {
    window.dispatchEvent(new CustomEvent('trippilot-cloud-save-error', { detail: 'Your change is saved on this device but could not sync to Supabase.' }));
  });
}

function pendingKey(userId) { return `${STORAGE_KEY}:user:${userId}:pending`; }

function readPending(userId) {
  try { const value = JSON.parse(localStorage.getItem(pendingKey(userId)) || '[]'); return Array.isArray(value) ? value : []; }
  catch { return []; }
}

function enqueuePending(entry, userId) {
  const values = readPending(userId).filter(item => item.id !== entry.id);
  values.push(entry);
  localStorage.setItem(pendingKey(userId), JSON.stringify(values));
}

function clearPendingIfCurrent(entry, userId) {
  const values = readPending(userId).filter(item => item.id !== entry.id || item.version !== entry.version);
  if (values.length) localStorage.setItem(pendingKey(userId), JSON.stringify(values));
  else localStorage.removeItem(pendingKey(userId));
}

async function writeCloudChange(entry, userId) {
  const session = await ensureSession();
  if (!session || session.user.id !== userId) throw new Error('Your session changed before this trip could sync.');
  if (entry.type === 'delete') {
    await restRequest(`planner_trips?id=eq.${encodeURIComponent(entry.id)}&user_id=eq.${encodeURIComponent(userId)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  } else {
    await restRequest('planner_trips?on_conflict=user_id,id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ user_id: userId, id: entry.id, trip: entry.trip, updated_at: entry.updated_at }) });
  }
  clearPendingIfCurrent(entry, userId);
}

async function flushPendingCloudChanges(userId) {
  for (const entry of readPending(userId)) await writeCloudChange(entry, userId);
}

function saveTripToCloud(trip) {
  const account = currentAccount();
  if (!account) return;
  const entry = { type: 'upsert', id: trip.id, trip, updated_at: new Date().toISOString(), version: crypto.randomUUID() };
  enqueuePending(entry, account.id);
  queueCloudWrite(() => writeCloudChange(entry, account.id));
}

function deleteTripFromCloud(id) {
  const account = currentAccount();
  if (!account) return;
  const entry = { type: 'delete', id, version: crypto.randomUUID() };
  enqueuePending(entry, account.id);
  queueCloudWrite(() => writeCloudChange(entry, account.id));
}

export function isTrip(value) {
  return Boolean(value && typeof value === 'object' && typeof value.id === 'string' &&
    typeof value.placeId === 'string' && typeof value.name === 'string' &&
    Number.isFinite(value.latitude) && Number.isFinite(value.longitude));
}

export function tripStops(trip) {
  const primary = { placeId: trip.placeId, name: trip.name, address: trip.address || '', latitude: trip.latitude, longitude: trip.longitude, ...(trip.timeZone ? { timeZone: trip.timeZone } : {}) };
  const stops = Array.isArray(trip.stops) ? trip.stops.filter(stop => stop?.placeId && stop?.name && Number.isFinite(stop.latitude) && Number.isFinite(stop.longitude)) : [];
  const unique = [...new Map([primary, ...stops].map(stop => [stop.placeId, stop])).values()];
  return unique.length ? unique : [primary];
}

// Departure can share a day with the next arrival; that day belongs to the
// arriving stop in the itinerary, while both stays retain their travel date.
export function stopSchedule(trip, stops = tripStops(trip)) {
  return stops.map((stop, index) => {
    const start = isDate(stop.date) ? stop.date : index === 0 && isDate(trip.startDate) ? trip.startDate : null;
    const next = stops.slice(index + 1).find(item => isDate(item.date));
    const end = start ? (isDate(stop.endDate) ? stop.endDate : next?.date || (isDate(trip.endDate) ? trip.endDate : start)) : null;
    return { stop, index, start, end };
  });
}

export function stopForDay(trip, day, stops = tripStops(trip)) {
  if (!isDate(day)) return null;
  return stopSchedule(trip, stops).filter(entry => entry.start && entry.start <= day && entry.end >= day)
    .sort((a, b) => b.start.localeCompare(a.start) || b.index - a.index)[0]?.stop || null;
}

export function datesForStop(trip, placeId) {
  const entry = stopSchedule(trip).find(entry => entry.stop.placeId === placeId);
  return entry?.start ? datesForTrip(trip).filter(day => day >= entry.start && day <= entry.end) : [];
}

export function setStopDates(trip, placeId, start, end) {
  const days = datesForTrip(trip), stops = tripStops(trip), index = stops.findIndex(stop => stop.placeId === placeId);
  if (index < 0) throw new Error('Choose a stop on this trip.');
  if (!days.includes(start) || !days.includes(end)) throw new Error('Keep stop dates within the trip dates.');
  if (end < start) throw new Error('Departure must be on or after arrival.');
  const previous = stops.slice(0, index).map((stop, position) => ({ ...stop, date: stop.date || (position === 0 ? trip.startDate : null) })).filter(stop => stop.date).at(-1), next = stops.slice(index + 1).find(stop => stop.date);
  if ((previous?.date || (index === 1 ? trip.startDate : null)) > start || previous?.endDate > start) throw new Error('Arrival must be on or after the previous stop’s departure.');
  if (next?.date && end > next.date) throw new Error('Departure must be on or before the next stop’s arrival.');
  return { ...trip, stops: stops.map((stop, position) => position === index ? { ...stop, date: start, endDate: end } : stop) };
}

function withStops(trip, stops) {
  const [first] = stops;
  return { ...trip, placeId: first.placeId, name: first.name, address: first.address || '', latitude: first.latitude, longitude: first.longitude, ...(first.timeZone ? { timeZone: first.timeZone } : {}), stops };
}

export function addStop(trip, stop) {
  if (!isTrip(trip) || !stop?.placeId || !stop?.name || !Number.isFinite(stop.latitude) || !Number.isFinite(stop.longitude)) throw new Error('Choose a destination.');
  const stops = tripStops(trip);
  if (stops.some(item => item.placeId === stop.placeId)) return trip;
  if (stops.length >= 20) throw new Error('A trip can have up to 20 destinations.');
  return withStops(trip, [...stops, stop]);
}

export function moveStop(trip, index, direction) {
  const stops = tripStops(trip);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= stops.length) return trip;
  const slots = stops.map(stop => ({ date: stop.date, endDate: stop.endDate }));
  [stops[index], stops[target]] = [stops[target], stops[index]];
  return withStops(trip, stops.map((stop, position) => ({ ...stop, ...slots[position] })));
}

export function removeStop(trip, placeId) {
  const stops = tripStops(trip);
  if (stops.length === 1) throw new Error('A trip needs at least one destination.');
  const next = stops.filter(stop => stop.placeId !== placeId);
  if (next.length === stops.length) return trip;
  return withStops(trip, next);
}

export function readTrips(storage = localStorage) {
  try {
    const key = typeof localStorage !== 'undefined' && storage === localStorage ? tripStorageKey() : STORAGE_KEY;
    const value = JSON.parse(storage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter(isTrip).map(trip => ({ ...trip, stops: tripStops(trip), items: Array.isArray(trip.items) ? trip.items : [] })) : [];
  } catch { return []; }
}

export function saveTrip(trip, storage = localStorage) {
  if (!isTrip(trip)) throw new Error('Choose a destination first.');
  const trips = readTrips(storage);
  const next = [{ ...trip, stops: tripStops(trip), items: Array.isArray(trip.items) ? trip.items : [] }, ...trips.filter(item => item.id !== trip.id)];
  const isBrowserStorage = typeof localStorage !== 'undefined' && storage === localStorage;
  storage.setItem(isBrowserStorage ? tripStorageKey() : STORAGE_KEY, JSON.stringify(next));
  if (isBrowserStorage) saveTripToCloud(trip);
  return next;
}

export function deleteTrip(id, storage = localStorage) {
  const next = readTrips(storage).filter(trip => trip.id !== id);
  const isBrowserStorage = typeof localStorage !== 'undefined' && storage === localStorage;
  storage.setItem(isBrowserStorage ? tripStorageKey() : STORAGE_KEY, JSON.stringify(next));
  if (isBrowserStorage) deleteTripFromCloud(id);
  return next;
}

export function addPlace(trip, place) {
  if (!isTrip(trip) || !place?.placeId || !place?.name) throw new Error('Choose a place.');
  if (trip.items?.some(item => item.placeId === place.placeId && item.day === place.day)) return trip;
  return { ...trip, items: [...(trip.items || []), { id: crypto.randomUUID(), ...place }] };
}

export function removePlace(trip, itemId) {
  return { ...trip, items: (trip.items || []).filter(item => item.id !== itemId) };
}

export function movePlace(trip, itemId, day) {
  if (trip.items?.some(item => item.id === itemId && fixedItem(item))) return trip;
  return { ...trip, items: (trip.items || []).map(item => item.id === itemId ? { ...item, day } : item) };
}

export const tripTitle = trip => trip.title?.trim() || tripStops(trip).map(stop => stop.name).join(' → ');
export function renameTrip(trip, title) {
  const value = String(title || '').trim();
  if (!value || value.length > 120) throw new Error('Use a trip title between 1 and 120 characters.');
  return { ...trip, title: value };
}
