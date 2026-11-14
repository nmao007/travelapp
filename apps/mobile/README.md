# TripPilot native app

Expo (React Native) version of the `site/` app. Screens are converted one for one from the site's phone layout, with the same measurements, colors, copy and motion; see `src/lib/theme.ts`.

## Shared code

Trip rules come from `packages/core/src` (imported as `@trippilot/core/*`). The site gets copies of those files through `site/prepare-shared.mjs`, so edit the core files, never `site/dist/` copies. Sync is `packages/core/src/cloud-sync.js`: trips are saved on the device first, then uploaded to Supabase without overwriting newer edits from another device.

## Run it

1. Start the API the app reads its settings from: `npm run dev` in `site/` (port 3010). To use another server, copy `.env.example` to `.env.local` and set `EXPO_PUBLIC_API_URL`.
2. In this folder: `npm install`, then `npx expo start --ios` (needs Xcode and an iOS Simulator) or scan the QR code with Expo Go on a phone. On a real phone, set `EXPO_PUBLIC_API_URL` to your computer's LAN address.

`npx expo start --web` renders the same screens in a browser for quick layout checks. Supabase calls fail there because the local API doesn't send CORS headers, so it's for layout only.

## Status (phase 0)

Done: home screen, sign-in and create-account sheet, signed-in header, trip list from the device and Supabase, adopting signed-out trips on sign-in.

Not yet: place search on the home screen and opening a trip (phase 1, with the trip workspace).
