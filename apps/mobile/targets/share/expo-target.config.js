// iOS share extension: "Elsewhere" in the share sheet of TikTok, Instagram,
// Safari and other apps. It saves the shared link into the app group inbox,
// which the app reads with ExtensionStorage (src/lib/share-inbox.ts).
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'share',
  name: 'TripPilotShare',
  displayName: 'Elsewhere',
  bundleIdentifier: '.share',
  deploymentTarget: '17.0',
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
});
