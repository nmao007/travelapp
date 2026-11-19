# TripPilot native app

Expo (React Native) version of the `site/` app. Screens are converted one for one from the site's phone layout, with the same measurements, colors, copy and motion; see `src/lib/theme.ts`.

## Shared code

Trip rules come from `packages/core/src` (imported as `@trippilot/core/*`). The site gets copies of those files through `site/prepare-shared.mjs`, so edit the core files, never `site/dist/` copies. Sync is `packages/core/src/cloud-sync.js`: trips are saved on the device first, then uploaded to Supabase without overwriting newer edits from another device.

## Run it

1. Start the API the app reads its settings from: `npm run dev` in `site/` (port 3010). To use another server, copy `.env.example` to `.env.local` and set `EXPO_PUBLIC_API_URL`.
2. In this folder: `npm install`, then `npx expo start --ios` (needs Xcode and an iOS Simulator) or scan the QR code with Expo Go on a phone. On a real phone, set `EXPO_PUBLIC_API_URL` to your computer's LAN address.

`npx expo start --web` renders the same screens in a browser for quick checks. The local API allows requests from other `localhost` ports so this preview can search places and sign in; deployed APIs don't.

## Status

Phase 0: home screen, sign-in and create-account sheet, signed-in header, trip list from the device and Supabase, adopting signed-out trips on sign-in.

Phase 1 (without the map):
- Home search (Google Places through the server's `/api/places-autocomplete` and `/api/place-details`) and creating a trip.
- Trip workspace: header, stop picker, trip menu (dates, rename, sign in/out, reorder stops, add destination, delete), tab bar.
- Plan tab: timeline, single-day view and calendar; adding, editing, moving, duplicating and removing plans (with undo); time, time zone, note, reservation, type and place; drag to reorder within or between days.
- Stops and dates: trip dates (move or change range), stop dates, add, edit, remove and reorder stops.

Not yet: the map (needs a development build with the Google Maps SDK), booked flights and trains in the Plan views and the Travel tab (phase 3), Explore and Ideas (later phases), and the menu's "Save offline itinerary" and "Export to calendar" (phase 3).
