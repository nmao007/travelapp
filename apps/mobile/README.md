# Elsewhere native app

Expo (React Native) version of the `site/` app. Screens are converted one for one from the site's phone layout, with the same measurements, colors, copy and motion; see `src/lib/theme.ts`.

## Shared code

Trip rules come from `packages/core/src` (imported as `@trippilot/core/*`). The site gets copies of those files through `site/prepare-shared.mjs`, so edit the core files, never `site/dist/` copies. Sync is `packages/core/src/cloud-sync.js`: trips are saved on the device first, then uploaded to Supabase without overwriting newer edits from another device.

## Run it

1. Start the API in `site/`: `npm run dev` (port 3010). It listens on your network during development, like `next dev`.
2. In this folder (`apps/mobile`, not `site/`): `npm install`, then
   - `npx expo start` and scan the QR code with your phone's Camera to open it in Expo Go (same Wi-Fi as the computer), or
   - `npx expo run:ios` for the development build in the iOS Simulator (needs Xcode). Sharing into the app needs this build; Expo Go can't load share extensions.

The app finds the API on the computer running Expo by itself. Once the site is deployed, set `EXPO_PUBLIC_API_URL` to its address in `apps/mobile/.env` and the app uses the deployed API instead (see `.env.example`); use `.env.local` to point back at your computer while changing server code.

`npx expo start --web` renders the same screens in a browser for quick checks. The local API allows requests from other `localhost` ports so this preview can search places and sign in; deployed APIs don't.

## Status

Phase 0: home screen, sign-in and create-account sheet, signed-in header, trip list from the device and Supabase, adopting signed-out trips on sign-in.

Phase 1 (without the map):
- Home search (Google Places through the server's `/api/places-autocomplete` and `/api/place-details`) and creating a trip.
- Trip workspace: header, stop picker, trip menu (dates, rename, sign in/out, reorder stops, add destination, delete), tab bar.
- Plan tab: timeline, single-day view and calendar; adding, editing, moving, duplicating and removing plans (with undo); time, time zone, note, reservation, type and place; drag to reorder within or between days.
- Stops and dates: trip dates (move or change range), stop dates, add, edit, remove and reorder stops.

Phase 2 (sharing videos in, without an Apple Developer account):
- Server: `/api/social-preview` (`site/social-preview.mjs`) returns a shared link's caption, creator and cover (TikTok pages, YouTube oEmbed, a plain card for Instagram until a Meta app is set up, the generic preview otherwise) and suggests places named in the caption (location tag, 📍 lines, descriptive hashtags) through Google Places.
- iOS share extension (`targets/share`, added by `@bacons/apple-targets`, SwiftUI in DM Sans): preview, place and trip picker, Save. It saves to the `group.app.trippilot.mobile` app group inbox; the app writes the trip list and API address there (`shareContext`) and moves saved links into the chosen trip when it opens (`src/lib/share-inbox.tsx`). Links saved with "Decide later" wait under "Saved from other apps".
- Shared links become Inbox cards on the trip's Ideas board (`sharedLinkIdea` / `addSharedIdea` in `packages/core/src/board-model.js`), so they sync and also appear on the website's Ideas board.
- Ideas tab: cards with cover, caption, place and source; add to a day, open the link, remove.
- Android: `expo-share-intent` (Android only) opens `src/app/share.tsx`, the same steps as the iOS screen. Built and type-checked but not yet run on Android.

Share extensions need a development build: `npx expo run:ios` (Xcode, CocoaPods). Expo Go can't load them. With Xcode 26, `expo-modules-jsi` 58.0.23 fails to compile (`sending 'slot' risks causing data races`); `patches/expo-modules-jsi+58.0.23.patch` applies the package's own `UncheckedSendable` wrapper there, reapplied by `patch-package` on every install. Drop the patch once Expo ships the fix or Xcode is updated (patch-package warns if the version changes).

Needs the Apple Developer Program: running the share extension on a real iPhone (free provisioning can't use app groups) and TestFlight. Moving the sign-in to the keychain so the share screen can save straight to the account is left for then; until the app opens, shares wait on the device.

Not yet: the map (needs a development build with the Google Maps SDK), booked flights and trains in the Plan views and the Travel tab (phase 3), Explore and Ideas (later phases), and the menu's "Save offline itinerary" and "Export to calendar" (phase 3).
