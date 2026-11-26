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
- [x] Home: an "Unsorted ideas" page and "See all trips"
- [x] Milestone 3, polish: offline start, keyboard, larger text, haptics, small iPhones
- [x] Adding to a day: the Plan tab's + and an empty day open "Add to" (`add-sheet.tsx`): search real places ranked around that day's destination, or put in one of the trip's saved ideas; writing a plan without a place is the fallback. The map opens framed on the trip's pins.
- [x] Ideas tab: "Add an idea" saves a real place (searched around the trip), pastes a link, or writes a note, without putting it on a day (`idea-sheet.tsx`)
- [x] Redesign (Claude Design canvas "Elsewhere — maximalist redesign"): new look everywhere, including the iOS share extension. Tokens in `src/lib/design.ts`, building blocks in `src/components/ui`. New features the canvas shows (Today view, Someday shelf, first-open screen, cover photos, Google sign-in, account settings, booking status) are not built.

## Milestone 2: Booked flights in the plan

- [x] **Add a flight by number and date**: the app looks it up and puts it on the right day in the timeline and calendar, showing local departure and arrival times. Edit and remove it too. Convert the site's code: `/api/flights`, `flight-model.js`, `flight-window.js`, `itinerary-model.js`.
- [x] "Add flight" goes under the Plan tab's +, not a Travel tab.

For now flights are entered by hand (tested in the iOS Simulator). Lookup turns on by itself once the server has an AeroDataBox key (`AERODATABOX_API_KEY`); the free plan doesn't allow commercial use, so a public launch needs a paid plan (Starter, $19/month, when checked) or stays with manual entry.

## Milestone 3: Polish the loop

- [x] Loading, empty and error states on every screen. The trip screen shows a spinner while trips load and "This trip isn't here" for a missing trip. Offline: the app keeps the last server settings on the phone, so it stays signed in with its trips when the server can't be reached, and changes made offline are sent when the app comes back to the foreground.
- [x] Keyboard handling in every sheet (sheets shrink above the keyboard and stay below the status bar; dragging a list closes the keyboard), VoiceOver labels (plans read their time and booked state), larger text sizes (text grows with the phone's setting up to 1.4×; brand marks and tab labels less, see `src/components/text.tsx`).
- [x] Haptics (`src/lib/haptics.ts`: tabs, dragging plans, adding an idea to a day or trip, deleting a trip) and motion (Reanimated already skips animations when Reduce Motion is on).
- [x] Small iPhones: checked on the iPhone SE (3rd generation) simulator. iPad support is off (`supportsTablet: false`).

## Milestone 4: Required before submitting to Apple

- [x] **Delete account** inside the app: the home screen's account menu (your initial, top right) has Sign out, Delete account, and links to the privacy and support pages. Deleting calls `delete_account()` (`supabase/migrations/202611250001_delete_account.sql`), which removes the Supabase user; their trips and ideas go with it.
- [x] **Rename `trippilot` to Elsewhere**: bundle ID `app.elsewhere.mobile` (share extension `app.elsewhere.mobile.share`), Android package, scheme `elsewhere`, slug, and app group `group.app.elsewhere.mobile`. Store IDs can't change after the first upload. Internal names (`@trippilot/core`, storage keys) stay.
- [x] Privacy policy and support pages on the site: `/privacy` and `/support` (`site/dist/privacy.html`, `support.html`). Fill in the support email before publishing.
- [x] Crash reporting with Sentry (`src/lib/crash-reports.ts`): off until `EXPO_PUBLIC_SENTRY_DSN` is set, and never in development builds. See `.env.example`.

## Milestone 5: Real people, real trips

1. **Server**: apply the Supabase migrations (`delete_account`); fix the Vercel deploy so the live site runs current code; a server Google key with Places API (New); restrict the keys; set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env`; check Supabase row-level security.
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
