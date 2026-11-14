import { isTrip, normalizeTrip } from './trip-model.js';
import { preferLocalBoard } from './board-model.js';
import { TRIPS_QUERY, tripWriteRequest, tripWriteResult, cloudVersions } from './trip-sync.js';
// Trip editing rules live in the shared core; this module adds browser storage and Supabase sync.
export * from './trip-model.js';
export const STORAGE_KEY = 'trippilot-site-trips-v1';
const SESSION_KEY = 'trippilot-site-supabase-session-v1';
const IDEA_LIBRARY_KEY = `${STORAGE_KEY}:personal-ideas`;
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
  const rows = await restRequest(TRIPS_QUERY);
  writeVersions(session.user.id, cloudVersions(rows));
  const localById = new Map(readTrips().map(trip => [trip.id, trip]));
  const trips = Array.isArray(rows) ? rows.map(row => row.trip).filter(isTrip).map(trip => {
    const merged = preferLocalBoard(localById.get(trip.id), trip);
    return normalizeTrip(merged);
  }) : [];
  localStorage.setItem(tripStorageKey(), JSON.stringify(trips));
  return trips;
}

function queueCloudWrite(operation) {
  cloudWrites = cloudWrites.catch(() => {}).then(operation).catch(() => {
    window.dispatchEvent(new CustomEvent('trippilot-cloud-save-error', { detail: 'Your change is saved on this device but could not sync to Supabase.' }));
  });
}

function versionsKey(userId) { return `${STORAGE_KEY}:user:${userId}:versions`; }
function readVersions(userId) {
  try { const value = JSON.parse(localStorage.getItem(versionsKey(userId)) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
  catch { return {}; }
}
function writeVersions(userId, versions) { localStorage.setItem(versionsKey(userId), JSON.stringify(versions)); }
function setVersion(userId, id, updatedAt) {
  const versions = readVersions(userId);
  if (updatedAt) versions[id] = updatedAt; else delete versions[id];
  writeVersions(userId, versions);
}

// Another device saved this trip after we last saw it. Keep their version
// rather than overwriting it, and tell the open workspace to show it.
async function resolveTripConflict(entry, userId) {
  const rows = await restRequest(`planner_trips?select=id,trip,updated_at&id=eq.${encodeURIComponent(entry.id)}&user_id=eq.${encodeURIComponent(userId)}`);
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row || !isTrip(row.trip)) {
    // Deleted elsewhere while edited here: keep this device's edit.
    setVersion(userId, entry.id, null);
    const request = tripWriteRequest(entry, userId, null);
    const result = tripWriteResult(entry, await restRequest(request.path, request));
    setVersion(userId, entry.id, result.updatedAt);
    return;
  }
  const trip = normalizeTrip(row.trip);
  localStorage.setItem(tripStorageKey(), JSON.stringify([trip, ...readTrips().filter(item => item.id !== trip.id)]));
  setVersion(userId, entry.id, row.updated_at);
  window.dispatchEvent(new CustomEvent('trippilot-cloud-conflict', { detail: { trip, message: 'This trip was changed on another device, so the latest version is shown.' } }));
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
  if (entry.type === 'idea-delete') {
    await restRequest(`planner_ideas?id=eq.${encodeURIComponent(entry.id)}&user_id=eq.${encodeURIComponent(userId)}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
  } else if (entry.type === 'idea-upsert') {
    await restRequest('planner_ideas?on_conflict=user_id,id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ user_id: userId, id: entry.id, idea: entry.idea, updated_at: entry.updated_at }) });
  } else {
    const request = tripWriteRequest(entry, userId, readVersions(userId)[entry.id] || null);
    const result = tripWriteResult(entry, await restRequest(request.path, request));
    if (result.status === 'conflict') await resolveTripConflict(entry, userId);
    else setVersion(userId, entry.id, result.updatedAt);
  }
  clearPendingIfCurrent(entry, userId);
  window.dispatchEvent(new CustomEvent('trippilot-cloud-save-ok', { detail: { id: entry.id } }));
}

function personalIdeaStorageKey() { const account=currentAccount(); return account?`${IDEA_LIBRARY_KEY}:user:${account.id}`:IDEA_LIBRARY_KEY; }
function readPersonalIdeas() { try { const value=JSON.parse(localStorage.getItem(personalIdeaStorageKey())||'[]');return Array.isArray(value)?value:[]; } catch { return []; } }
export async function loadPersonalIdeas() {
  const account=currentAccount();if(!account)return readPersonalIdeas();
  try { await flushPendingCloudChanges(account.id);const rows=await restRequest('planner_ideas?select=id,idea&order=updated_at.desc');const ideas=Array.isArray(rows)?rows.map(row=>row.idea).filter(idea=>idea&&typeof idea==='object'):[];localStorage.setItem(personalIdeaStorageKey(),JSON.stringify(ideas));return ideas; }
  catch { return readPersonalIdeas(); }
}
export function savePersonalIdea(idea) {
  if(!idea||typeof idea.id!=='string')return;
  const content=Object.fromEntries(['id','type','title','sticker','image','url','sourceUrl','preview','location','category','notes','color'].filter(key=>idea[key]!==undefined).map(key=>[key,idea[key]]));
  const ideas=[content,...readPersonalIdeas().filter(item=>item.id!==content.id)];localStorage.setItem(personalIdeaStorageKey(),JSON.stringify(ideas));
  const account=currentAccount();if(account){const entry={type:'idea-upsert',id:content.id,idea:content,updated_at:new Date().toISOString(),version:crypto.randomUUID()};enqueuePending(entry,account.id);queueCloudWrite(()=>writeCloudChange(entry,account.id));}
}
export function deletePersonalIdea(id) {
  localStorage.setItem(personalIdeaStorageKey(),JSON.stringify(readPersonalIdeas().filter(idea=>idea.id!==id)));
  const account=currentAccount();if(account){const entry={type:'idea-delete',id,version:crypto.randomUUID()};enqueuePending(entry,account.id);queueCloudWrite(()=>writeCloudChange(entry,account.id));}
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

export function readTrips(storage = localStorage) {
  try {
    const key = typeof localStorage !== 'undefined' && storage === localStorage ? tripStorageKey() : STORAGE_KEY;
    const value = JSON.parse(storage.getItem(key) || '[]');
    return Array.isArray(value) ? value.filter(isTrip).map(trip => normalizeTrip(trip)) : [];
  } catch { return []; }
}

export function saveTrip(trip, storage = localStorage) {
  if (!isTrip(trip)) throw new Error('Choose a destination first.');
  const trips = readTrips(storage);
  const saved = normalizeTrip(trip);
  const next = [saved, ...trips.filter(item => item.id !== trip.id)];
  const isBrowserStorage = typeof localStorage !== 'undefined' && storage === localStorage;
  storage.setItem(isBrowserStorage ? tripStorageKey() : STORAGE_KEY, JSON.stringify(next));
  if (isBrowserStorage) saveTripToCloud(saved);
  return next;
}

// Trips planned before signing in live under the guest key. Move them into the
// account (keeping the account's copy when ids collide) so they are not hidden
// by the switch to account-scoped storage, and queue them for cloud sync.
export function adoptGuestTrips(storage = localStorage, account = currentAccount()) {
  if (!account?.id) return [];
  let guest;
  try { guest = JSON.parse(storage.getItem(STORAGE_KEY) || '[]'); } catch { guest = []; }
  const guestTrips = Array.isArray(guest) ? guest.filter(isTrip) : [];
  if (!guestTrips.length) { storage.removeItem?.(STORAGE_KEY); return []; }
  const accountKey = `${STORAGE_KEY}:user:${account.id}`;
  let existing;
  try { existing = JSON.parse(storage.getItem(accountKey) || '[]'); } catch { existing = []; }
  const accountTrips = Array.isArray(existing) ? existing.filter(isTrip) : [];
  const known = new Set(accountTrips.map(trip => trip.id));
  const adopted = guestTrips.filter(trip => !known.has(trip.id))
    .map(trip => normalizeTrip(trip));
  storage.setItem(accountKey, JSON.stringify([...adopted, ...accountTrips]));
  storage.removeItem?.(STORAGE_KEY);
  if (typeof localStorage !== 'undefined' && storage === localStorage) {
    for (const trip of adopted) {
      const entry = { type: 'upsert', id: trip.id, trip, updated_at: new Date().toISOString(), version: crypto.randomUUID() };
      enqueuePending(entry, account.id);
    }
  }
  return adopted;
}

export function deleteTrip(id, storage = localStorage) {
  const next = readTrips(storage).filter(trip => trip.id !== id);
  const isBrowserStorage = typeof localStorage !== 'undefined' && storage === localStorage;
  storage.setItem(isBrowserStorage ? tripStorageKey() : STORAGE_KEY, JSON.stringify(next));
  if (isBrowserStorage) deleteTripFromCloud(id);
  return next;
}
