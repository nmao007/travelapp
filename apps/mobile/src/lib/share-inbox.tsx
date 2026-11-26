import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExtensionStorage } from '@bacons/apple-targets';
import { addSharedIdea, sharedLinkIdea } from '@trippilot/core/board-model';
import { tripTitle } from '@trippilot/core/trip-model';
import { tripDateLabel } from '@/components/recent-trip';
import { apiUrl } from './config';
import { newSession, placeDetails } from './places';
import { useTrips, type Trip } from './trips';

// Links shared into the app. The iOS share extension (targets/share) appends
// them to the app group inbox; Android's share screen (src/app/share.tsx)
// calls saveShared directly. Shares with a trip become Inbox cards on that
// trip's Ideas board; the rest wait here until they're added to a trip.
const APP_GROUP = 'group.app.elsewhere.mobile';
const INBOX_KEY = 'importInbox';
const CONTEXT_KEY = 'shareContext';
const UNASSIGNED_KEY = 'trippilot-shared-inbox';

export type SharedPlace = { placeId: string; name: string; detail?: string };
export type SharedPreview = { provider: string; url: string; title: string; author: string; handle: string; image: string; places: SharedPlace[] };
export type SharedLink = {
  id: string;
  url: string;
  savedAt: string;
  tripId?: string;
  provider?: string;
  title?: string;
  author?: string;
  handle?: string;
  image?: string;
  place?: SharedPlace | null;
  places?: SharedPlace[];
  // Chosen "New trip" in the share sheet: the app asks for the destination.
  newTrip?: boolean;
};

// A destination to suggest for a new trip from a shared place: its city and
// country from the address ("Jinnan, Shibuya City, Tokyo, Japan" -> "Tokyo,
// Japan"; "Shattuck Ave, Berkeley, CA, USA" -> "Berkeley, CA, USA").
export function destinationGuess(place?: SharedPlace | null) {
  const parts = (place?.detail || '').split(',').map(part => part.trim()).filter(part => part && !/\d/.test(part));
  if (parts.length < 2) return place?.detail || place?.name || '';
  const country = parts[parts.length - 1], region = parts[parts.length - 2];
  if (/^[A-Z]{2}$/.test(region) && parts.length >= 3) return `${parts[parts.length - 3]}, ${region}, ${country}`;
  return `${region}, ${country}`;
}

const storage = () => (Platform.OS === 'ios' ? new ExtensionStorage(APP_GROUP) : null);

function readInbox(): SharedLink[] {
  const raw = storage()?.get(INBOX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(entry => typeof entry?.url === 'string').map(entry => ({ ...entry, id: entry.id || `${entry.url}|${entry.savedAt}` })) : [];
  } catch { return []; }
}

export async function fetchSharedPreview(url: string, signal?: AbortSignal): Promise<SharedPreview> {
  const response = await fetch(`${apiUrl}/api/social-preview?url=${encodeURIComponent(url)}`, { signal });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'This link could not be previewed.');
  return body.preview;
}

// The shared link as an Ideas card for a trip, with the chosen place located.
async function ideaFor(link: SharedLink) {
  let details = link;
  if (!link.provider) {
    try { const preview = await fetchSharedPreview(link.url); details = { ...link, ...preview, place: link.place ?? preview.places[0] ?? null }; } catch { /* Saved as a plain link card. */ }
  }
  let place: Record<string, unknown> | null = details.place ? { ...details.place } : null;
  if (details.place?.placeId) {
    try { place = await placeDetails(details.place.placeId, newSession()); } catch { /* Keep the name without a map location. */ }
  }
  return sharedLinkIdea({ ...details, place }, {});
}

type Inbox = {
  unassigned: SharedLink[];
  saveShared(link: SharedLink): Promise<'trip' | 'inbox'>;
  addToTrip(link: SharedLink, trip: Trip): Promise<Trip>;
  dismiss(link: SharedLink): void;
  // Keeps a "New trip" share in the inbox without asking again.
  postpone(link: SharedLink): void;
};

const InboxContext = createContext<Inbox | null>(null);

export function SharedInboxProvider({ children }: { children: ReactNode }) {
  const { ready, trips, saveTrip } = useTrips();
  const [unassigned, setUnassigned] = useState<SharedLink[]>([]);
  const tripsRef = useRef(trips);
  tripsRef.current = trips;

  const writeUnassigned = useCallback((update: (list: SharedLink[]) => SharedLink[]) => {
    setUnassigned(current => {
      const next = update(current);
      AsyncStorage.setItem(UNASSIGNED_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const addToTrip = useCallback(async (link: SharedLink, trip: Trip) => {
    const latest = tripsRef.current.find(entry => entry.id === trip.id) || trip;
    const saved = saveTrip(addSharedIdea(latest, await ideaFor(link)) as Trip);
    writeUnassigned(list => list.filter(entry => entry.id !== link.id));
    return saved;
  }, [saveTrip, writeUnassigned]);

  const saveShared = useCallback(async (link: SharedLink) => {
    const trip = link.tripId ? tripsRef.current.find(entry => entry.id === link.tripId) : null;
    if (trip) { await addToTrip(link, trip); return 'trip' as const; }
    writeUnassigned(list => list.some(entry => entry.url === link.url) ? list : [...list, link]);
    return 'inbox' as const;
  }, [addToTrip, writeUnassigned]);

  const dismiss = useCallback((link: SharedLink) => writeUnassigned(list => list.filter(entry => entry.id !== link.id)), [writeUnassigned]);
  const postpone = useCallback((link: SharedLink) => writeUnassigned(list => list.map(entry => entry.id === link.id ? { ...entry, newTrip: false } : entry)), [writeUnassigned]);

  useEffect(() => {
    AsyncStorage.getItem(UNASSIGNED_KEY).then(raw => { try { const list = JSON.parse(raw || '[]'); if (Array.isArray(list)) setUnassigned(list); } catch { /* Start empty. */ } });
  }, []);

  // Moves what the share extension saved, once trips have loaded. Each entry
  // is removed from the app group only after it's saved, so a failure retries.
  const collecting = useRef(false);
  const collect = useCallback(async () => {
    if (!ready || collecting.current) return;
    collecting.current = true;
    try {
      for (const link of readInbox()) {
        try { await saveShared(link); } catch { continue; }
        const remaining = readInbox().filter(entry => entry.id !== link.id);
        if (remaining.length) storage()?.set(INBOX_KEY, JSON.stringify(remaining)); else storage()?.remove(INBOX_KEY);
      }
    } finally { collecting.current = false; }
  }, [ready, saveShared]);

  useEffect(() => {
    collect();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') collect(); });
    return () => subscription.remove();
  }, [collect]);

  // What the share extension needs: where the API is and which trips to offer.
  useEffect(() => {
    if (!ready) return;
    storage()?.set(CONTEXT_KEY, JSON.stringify({ apiUrl, trips: trips.map(trip => ({ id: trip.id, name: tripTitle(trip), dates: trip.startDate ? tripDateLabel(trip) : '' })) }));
  }, [ready, trips]);

  const value = useMemo(() => ({ unassigned, saveShared, addToTrip, dismiss, postpone }), [unassigned, saveShared, addToTrip, dismiss, postpone]);
  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

export function useSharedInbox() {
  const inbox = useContext(InboxContext);
  if (!inbox) throw new Error('useSharedInbox needs SharedInboxProvider');
  return inbox;
}
