import AsyncStorage from '@react-native-async-storage/async-storage';
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
const CONFIG_KEY = 'elsewhere:config';

// The last settings that loaded are kept on the phone, so the app still finds
// the signed-in account and its trips when it starts offline.
export function loadConfig(): Promise<AppConfig> {
  configPromise ||= fetch(`${apiUrl}/api/config`, { cache: 'no-store' })
    .then(async response => {
      if (!response.ok) throw new Error('Could not load Supabase settings.');
      const config = await response.json() as AppConfig;
      AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config)).catch(() => {});
      return config;
    })
    .catch(async error => {
      configPromise = null;
      const saved = await AsyncStorage.getItem(CONFIG_KEY).catch(() => null);
      if (saved) return JSON.parse(saved) as AppConfig;
      throw error;
    });
  return configPromise;
}
