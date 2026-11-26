// app.json holds the app's settings; this adds the parts that come from
// apps/mobile/.env, which app.json can't read.
//
// GOOGLE_MAPS_IOS_KEY: a Google Cloud key with "Maps SDK for iOS" enabled,
// restricted to iOS apps with this bundle ID. With it, iOS draws Google Maps
// like the site; without it, the map falls back to Apple Maps. Rebuild with
// `npx expo run:ios` after setting or changing it.
//
// SENTRY_ORG and SENTRY_PROJECT (with SENTRY_AUTH_TOKEN in the build's
// environment): add Sentry's build step, which uploads source maps and debug
// symbols so crash reports show readable stack traces. The app sends crash
// reports whenever EXPO_PUBLIC_SENTRY_DSN is set (src/lib/crash-reports.ts);
// this only makes them readable.
//
// EXPO_PUBLIC_API_URL: the deployed site's https address. EAS doesn't upload
// .env (it's gitignored), so EAS builds read it from the project's EAS
// environment variables (eas env:create, preview and production). A build
// without it would point the app at localhost and nothing would load on a
// phone, so it stops here instead.
module.exports = ({ config }) => {
  const api = process.env.EXPO_PUBLIC_API_URL || '';
  if (process.env.EAS_BUILD_PROFILE && !/^https:\/\//.test(api)) {
    throw new Error(`EXPO_PUBLIC_API_URL must be the deployed site's https:// address for EAS builds (got "${api}"). Add it with: npx eas-cli@latest env:create --name EXPO_PUBLIC_API_URL --environment production --environment preview --visibility plaintext`);
  }
  const iosKey = process.env.GOOGLE_MAPS_IOS_KEY || '';
  const androidKey = process.env.GOOGLE_MAPS_ANDROID_KEY || '';
  const sentry = process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
    ? [['@sentry/react-native', { organization: process.env.SENTRY_ORG, project: process.env.SENTRY_PROJECT }]]
    : [];
  return {
    ...config,
    plugins: [
      ...(config.plugins || []),
      ['react-native-maps', { ...(iosKey ? { iosGoogleMapsApiKey: iosKey } : {}), ...(androidKey ? { androidGoogleMapsApiKey: androidKey } : {}) }],
      ...sentry,
    ],
    extra: { ...config.extra, googleMapsIOS: Boolean(iosKey) },
  };
};
