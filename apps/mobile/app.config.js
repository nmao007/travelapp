// app.json holds the app's settings; this adds the parts that come from
// apps/mobile/.env, which app.json can't read.
//
// GOOGLE_MAPS_IOS_KEY: a Google Cloud key with "Maps SDK for iOS" enabled,
// restricted to iOS apps with this bundle ID. With it, iOS draws Google Maps
// like the site; without it, the map falls back to Apple Maps. Rebuild with
// `npx expo run:ios` after setting or changing it.
module.exports = ({ config }) => {
  const iosKey = process.env.GOOGLE_MAPS_IOS_KEY || '';
  const androidKey = process.env.GOOGLE_MAPS_ANDROID_KEY || '';
  return {
    ...config,
    plugins: [
      ...(config.plugins || []),
      ['react-native-maps', { ...(iosKey ? { iosGoogleMapsApiKey: iosKey } : {}), ...(androidKey ? { androidGoogleMapsApiKey: androidKey } : {}) }],
    ],
    extra: { ...config.extra, googleMapsIOS: Boolean(iosKey) },
  };
};
