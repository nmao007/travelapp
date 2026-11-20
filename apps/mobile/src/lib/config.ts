import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Where the API (site/server.mjs) is. A deployed address in
// EXPO_PUBLIC_API_URL (apps/mobile/.env) wins. Without one, a development
// build or Expo Go uses the API on the computer running Expo: the same host
// Expo serves the app's code from, so a phone on the same Wi-Fi finds it.
function developmentApi() {
  if (Platform.OS === 'web') return 'http://localhost:3010';
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host || 'localhost'}:3010`;
}

// The app reads public settings from the same /api/config endpoint as the site.
export const apiUrl = (process.env.EXPO_PUBLIC_API_URL || developmentApi()).replace(/\/$/, '');

export type AppConfig = {
  mapsKey: string | null;
  mapId: string;
  flightLookup: boolean;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
};

let configPromise: Promise<AppConfig> | null = null;

export function loadConfig(): Promise<AppConfig> {
  configPromise ||= fetch(`${apiUrl}/api/config`, { cache: 'no-store' })
    .then(response => {
      if (!response.ok) throw new Error('Could not load Supabase settings.');
      return response.json() as Promise<AppConfig>;
    })
    .catch(error => { configPromise = null; throw error; });
  return configPromise;
}
