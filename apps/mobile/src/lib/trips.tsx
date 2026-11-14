import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { createCloudSync } from '@trippilot/core/cloud-sync';
import { loadConfig } from './config';

// The saved trip shape is defined by packages/core (trip-model.js); these are
// the fields the screens read so far.
export type Trip = {
  id: string;
  name: string;
  title?: string;
  placeId: string;
  latitude: number;
  longitude: number;
  startDate?: string | null;
  endDate?: string | null;
  stops: { placeId: string; name: string }[];
  [field: string]: unknown;
};
export type Account = { id: string; email: string };

type TripsContextValue = {
  ready: boolean;
  account: Account | null;
  trips: Trip[];
  homeStatus: string;
  showHomeStatus(message: string): void;
  signIn(email: string, password: string): Promise<void>;
  createAccount(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
};

const TripsContext = createContext<TripsContextValue | null>(null);

let clientPromise: Promise<SupabaseClient> | null = null;
function supabase(): Promise<SupabaseClient> {
  clientPromise ||= loadConfig().then(config => {
    if (!config.supabaseUrl || !config.supabaseAnonKey) throw new Error('Supabase is not configured for this prototype.');
    return createClient(config.supabaseUrl, config.supabaseAnonKey, {
      auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    });
  }).catch(error => { clientPromise = null; throw error; });
  return clientPromise;
}

const accountFrom = (session: Session | null): Account | null => session?.user ? { id: session.user.id, email: session.user.email || '' } : null;

// PostgREST requests for the signed-in user, in the shape cloud-sync expects.
async function restRequest(path: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) {
  const [client, config] = await Promise.all([supabase(), loadConfig()]);
  const { data } = await client.auth.getSession();
  if (!data.session) throw new Error('Your session expired. Sign in again to sync trips.');
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    method: init.method || 'GET',
    headers: { apikey: config.supabaseAnonKey!, authorization: `Bearer ${data.session.access_token}`, 'content-type': 'application/json', ...(init.headers || {}) },
    body: init.body,
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || result.hint || 'Supabase could not sync this trip. Check the planner_trips table and row-level security migration.');
  }
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export function TripsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [homeStatus, setHomeStatus] = useState('');
  const statusTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const sync = useMemo(() => createCloudSync({
    storage: AsyncStorage,
    request: restRequest,
    onConflict: () => showHomeStatus('This trip was changed on another device, so the latest version is shown.'),
  }), []);

  // Matches the site's home notice: shown for five seconds.
  const showHomeStatus = useCallback((message: string) => {
    clearTimeout(statusTimer.current);
    setHomeStatus(message);
    if (message) statusTimer.current = setTimeout(() => setHomeStatus(''), 5000);
  }, []);

  const refresh = useCallback(async (user: Account | null) => {
    setTrips(await sync.readTrips(user?.id ?? null));
  }, [sync]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let user: Account | null = null;
      try {
        const client = await supabase();
        const { data } = await client.auth.getSession();
        user = accountFrom(data.session);
        if (user) await sync.loadTrips(user.id);
      } catch {
        if (user) showHomeStatus('Could not load your Supabase trips. Your saved browser copy is still available.');
      }
      if (cancelled) return;
      setAccount(user);
      await refresh(user);
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [sync, refresh, showHomeStatus]);

  // Supabase recommends refreshing tokens only while the app is in the foreground.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      supabase().then(client => state === 'active' ? client.auth.startAutoRefresh() : client.auth.stopAutoRefresh()).catch(() => {});
    });
    return () => subscription.remove();
  }, []);

  const finishSignIn = useCallback(async (session: Session | null, missing: string) => {
    const user = accountFrom(session);
    if (!user) throw new Error(missing);
    await sync.adoptGuestTrips(user.id);
    let syncError = '';
    try { await sync.loadTrips(user.id); } catch (error) { syncError = (error as Error).message || 'Your trip list could not sync from Supabase.'; }
    setAccount(user);
    await refresh(user);
    if (syncError) showHomeStatus(syncError);
  }, [sync, refresh, showHomeStatus]);

  const value = useMemo<TripsContextValue>(() => ({
    ready, account, trips, homeStatus, showHomeStatus,
    async signIn(email, password) {
      const client = await supabase();
      const { data, error } = await client.auth.signInWithPassword({ email: String(email).trim().toLowerCase(), password: String(password) });
      if (error) throw new Error(error.message || 'Supabase could not complete that request.');
      await finishSignIn(data.session, 'Supabase did not return a signed-in session.');
    },
    async createAccount(email, password) {
      const client = await supabase();
      const { data, error } = await client.auth.signUp({ email: String(email).trim().toLowerCase(), password: String(password) });
      if (error) throw new Error(error.message || 'Supabase could not complete that request.');
      await finishSignIn(data.session, 'Supabase requires email confirmation for this project. Disable email confirmations in Supabase Auth settings to sign in immediately.');
    },
    async signOut() {
      if (account) await sync.flush(account.id).catch(() => {});
      try { await (await supabase()).auth.signOut({ scope: 'local' }); } catch { /* Clear the local session even if the network is unavailable. */ }
      setAccount(null);
      await refresh(null);
    },
  }), [ready, account, trips, homeStatus, showHomeStatus, finishSignIn, sync, refresh]);

  return <TripsContext.Provider value={value}>{children}</TripsContext.Provider>;
}

export function useTrips() {
  const value = useContext(TripsContext);
  if (!value) throw new Error('useTrips must be used inside TripsProvider.');
  return value;
}
