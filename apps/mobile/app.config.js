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
module.exports = ({ config }) => {
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
