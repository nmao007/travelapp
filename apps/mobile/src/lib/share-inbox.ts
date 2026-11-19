import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExtensionStorage } from '@bacons/apple-targets';

// The iOS share extension (targets/share) appends shared links to this app
// group inbox. The app moves them into the device's saved imports whenever it
// becomes active; the Ideas tab will show them as cards.
const APP_GROUP = 'group.app.trippilot.mobile';
const INBOX_KEY = 'importInbox';
export const IMPORTS_KEY = 'trippilot-imports';

export type SharedImport = { url: string; text?: string; savedAt: string };

function readInbox(): SharedImport[] {
  const raw = new ExtensionStorage(APP_GROUP).get(INBOX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(entry => typeof entry?.url === 'string') : [];
  } catch { return []; }
}

export async function loadImports(): Promise<SharedImport[]> {
  try { return JSON.parse((await AsyncStorage.getItem(IMPORTS_KEY)) || '[]'); } catch { return []; }
}

// Saves before clearing the inbox, so a failed save leaves the links to retry.
export async function collectSharedImports(): Promise<SharedImport[]> {
  if (Platform.OS !== 'ios') return [];
  const incoming = readInbox();
  if (!incoming.length) return [];
  const saved = await loadImports();
  const known = new Set(saved.map(entry => `${entry.url}|${entry.savedAt}`));
  const fresh = incoming.filter(entry => !known.has(`${entry.url}|${entry.savedAt}`));
  await AsyncStorage.setItem(IMPORTS_KEY, JSON.stringify([...saved, ...fresh]));
  new ExtensionStorage(APP_GROUP).remove(INBOX_KEY);
  return fresh;
}

export function useShareInbox() {
  useEffect(() => {
    const collect = () => collectSharedImports()
      .then(fresh => { if (fresh.length) console.log('[share-inbox] imported', JSON.stringify(fresh)); })
      .catch(error => console.warn('[share-inbox] failed', error));
    collect();
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') collect(); });
    return () => subscription.remove();
  }, []);
}
