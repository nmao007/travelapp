# Elsewhere native app roadmap

**The app in one line:** save the places you see in videos, see them on a map, put them into your days, and keep your booked flights in the same plan.

**Rule:** the native app leads. When a feature stays, convert the site's code for it (`site/dist`), so it keeps the same look and logic from `packages/core/src`. Features that aren't on this roadmap don't get ported. The site stays as it is.

Each milestone ends with something you can try in the iOS Simulator (`npx expo run:ios`, see README). Tick items off here as they land.

## Done

- [x] Home, sign-in and create account, trip list, Supabase sync
- [x] Trip header, stops and dates, trip menu
- [x] Plan tab: timeline, single day, calendar; add, edit, move, duplicate and remove plans; drag between days
- [x] Sharing in: iOS share extension, Android share screen, `/api/social-preview`
- [x] Ideas tab as a list, and Paste link with the same preview and place chips as sharing in
- [x] Map with numbered plan pins and the tapped pin's card, on Apple Maps (`src/components/workspace/trip-map.tsx`)
- [x] Milestone 1, Ideas at the center: three tabs (Plan · Map · Ideas); saved videos with a place as cover pins on the map, whose card adds them to a day or opens the video; an empty Ideas tab that explains how to share a video in
- [x] Milestone 2, booked flights in the plan: the Plan tab's + offers "Add flight"; flights show in the timeline, single day and calendar, and open for editing or removal with undo
- [x] Saved videos on the home screen (add to a trip or start a new one) and "New trip" in the share sheets

## Milestone 2: Booked flights in the plan

- [x] **Add a flight by number and date**: the app looks it up and puts it on the right day in the timeline and calendar, showing local departure and arrival times. Edit and remove it too. Convert the site's code: `/api/flights`, `flight-model.js`, `flight-window.js`, `itinerary-model.js`.
- [x] "Add flight" goes under the Plan tab's +, not a Travel tab.

For now flights are entered by hand (tested in the iOS Simulator). Lookup turns on by itself once the server has an AeroDataBox key (`AERODATABOX_API_KEY`); the free plan doesn't allow commercial use, so a public launch needs a paid plan (Starter, $19/month, when checked) or stays with manual entry.

## Milestone 3: Polish the loop

- [ ] Loading, empty and error states on every screen. Trips already save on the phone first; check everything still works offline.
- [ ] Keyboard handling in every sheet, VoiceOver labels, larger text sizes.
- [ ] Haptics and motion.
- [ ] Small iPhones (SE). Turn iPad support off for now.

## Milestone 4: Required before submitting to Apple

- [ ] **Delete account** inside the app (Apple requires it for apps with sign-up).
- [ ] **Rename `trippilot` to Elsewhere**: bundle ID `app.trippilot.mobile`, Android package, `scheme`, `slug`, the app group `group.app.trippilot.mobile` and the share target bundle. Store IDs can't change after the first upload.
- [ ] Privacy policy and support pages on the site.
- [ ] Crash reporting (for example Sentry).

## Milestone 5: Real people, real trips

1. **Server**: fix the Vercel deploy so the live site runs current code; a server Google key with Places API (New); restrict the keys; set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env`; check Supabase row-level security.
2. **Apple Developer Program ($99/year)**: `eas build`; move the sign-in to the shared keychain so the share extension saves straight to the account.
3. **Test sharing** from the real TikTok and Instagram apps on an iPhone.
4. **TestFlight** with friends planning real trips. Write down what they ask for.
5. **Store listing and submission**: name (plain "Elsewhere" is likely taken; e.g. "Elsewhere: Trip Planner"), screenshots, description, privacy answers, `eas submit`.

## Android: after iOS ships

- [ ] Install Android Studio and run everything on the emulator, sharing in included (`src/app/share.tsx`).
- [ ] Google Play ($25 once): new personal accounts need a closed test with 12 testers for 14 days before going public, so start it early.

## Later, only if testers ask

- Sharing a trip with travel companions: invites, roles, editing together. Likely the first request for group trips, and a big piece of work.
- Travel times between plans and the "won't make it in time" warning (`day-route-model.js`, site `day-routes.js`, `/api/route`).
- Destination photo in the trip header (site `loadDestinationPhoto`, `/api/place-image`).
- Google Maps instead of Apple Maps: an iOS-restricted key as `GOOGLE_MAPS_IOS_KEY` (README).
- Tours (`tour-model.js`), calendar export (site `calendar-export.js`).

## Dropped

Not ported to the app:

- Wallet: budget, expenses, splitting, CSV export.
- Weather and the currency converter.
- Explore: nearby suggestions, "Search this area", place cards.
- The Ideas canvas: zoom, frames, connections.
- Offline itinerary export, route optimization, and everything else from the old Wanderlog/TripIt comparison (removed with the old planning docs; see git history).
