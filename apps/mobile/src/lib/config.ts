// The app reads public settings from the same /api/config endpoint as the site.
export const apiUrl = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3010').replace(/\/$/, '');

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
