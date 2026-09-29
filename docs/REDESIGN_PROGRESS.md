# Redesign progress — review milestone 1

**Historical milestone.** The latest UI/data changes are in [MINIMAL_UI_AND_REAL_DATA.md](MINIMAL_UI_AND_REAL_DATA.md). The sample is no longer inserted/opened automatically, trip creation is now one form, and Explore now performs real place lookup.

September 27, 2026. The user approved implementation and requested regular pauses for review. **Pause after delivering this foundation; continue after their check-in.** The [master plan](MASTER_PLAN.md) remains the full product specification.

## What to review

- `http://localhost:3000/preview`: development-only review with **Desktop** and **iPhone layout** controls. A fictional Tokyo fixture is clearly labeled. The switch previews the responsive web layout, not a native iOS app.
- `http://localhost:3000/workspace`: the normal guest workspace. Starts with your trip list, not invented reservations. Sample content is opt-in.
- Start a trip → destinations/dates → optional preferences → fresh trip. Try several destinations or undecided dates.
- Plan → select a day → add a manual reservation or flexible activity. Reservation details also appear in Essentials → Reservations, using the same record.
- Essentials → Readiness/Packing/Money: check tasks, add packing items, record spending, and compare it with the budget.
- Practical notes are available under Tickets & documents, Language & connectivity, and Destination basics.
- Search finds plan items, booking references, notes, packing, tasks, and expenses. Reload preserves saved records and the selected day URL.

## Implemented foundation

A new neutral/blue interface replaces the green prototype on the guest entry and review routes. Desktop uses a stable sidebar and contextual trip outline; phone uses four bottom navigation choices, single-column content, scrollable days, 16px form inputs, and native modal focus containment. There is no floating add control obscuring navigation, pretend map, or booking-provider status fabricated from fixture data.

Trip creation supports up to 20 destination names, exact or undecided dates, optional name/budget, currency, traveler count, pace, and destination time zone. A small city-name mapping suggests familiar time zones; this is not geocoding. Unknown destinations retain the browser zone and need review. Stop-specific nights, place IDs, structured interests/accessibility preferences, and robust destination resolution remain future work.

Plan items support a specific day or unscheduled status; optional local time, time zone, kind, address, notes, reference, and confirmed flag. Editing a reservation edits the same record shown in both Plan and Reservations. Date shortening cannot strand scheduled items outside the new range. Simultaneous starts in the same zone show a warning; this is not full travel-time/duration conflict detection. Explore has a clearly identified Tokyo starter catalog with save/filter/detail/add-to-explicit-day behavior; other destinations allow manual place capture until provider search is integrated.

Guest records are saved asynchronously in IndexedDB. Saving failures are visible; a readable JSON backup can be exported. A second tab’s save requests a reload before further editing. This is a conservative warning, not transactional multi-device synchronization. Guest storage is not encrypted, and the app shell is not available offline yet. Existing prototype data is preserved in its separate storage; no automatic import occurs. Document screens accept practical notes/reminders, not identity scans or payment data.

## Performance work and evidence

The previous middleware attempted `Supabase.auth.getUser()` for public guest/review routes. Public `/`, `/workspace`, and `/preview` now avoid that remote lookup. Protected account routes retain cookie refresh; server ownership/authentication and RLS checks remain in place. The protected legacy account interface has not yet been migrated to this design.

Section/day changes run inside a persistent client workspace and update browser history; they do not invoke router-driven server navigation. Storage avoids synchronous localStorage JSON serialization for the new workspace. The production `/workspace` shell is statically rendered. Build output reports **122 kB first-load JavaScript**, including **103 kB shared**; these are build estimates, not measured transfer bytes or interaction latency.

No field Core Web Vitals or production p75 latency has been established. Real-device/slow-network profiling, cold-load traces, long-trip workloads, and user usability sessions remain mandatory gates. Development compilation timing and browser-tool execution duration are not reported as app performance measurements.

## Validation

- TypeScript check and production build passed. **27 automated tests passed.**
- Automated domain/database tests, including new fresh/flexible/multi-stop trip, date-range, decimal-precision, reservation deduplication, daylight-saving, and cross-zone next-item cases.
- Browser review at desktop width, 390 × 852 and 320px phone viewports, and the built-in iPhone canvas. Phone document width equals viewport width; scrolling days remains inside its strip.
- Browser flow: create a fresh Lisbon/Porto trip, select day 3, add a confirmed stay, reload, find the reference in Reservations and Search, and record €25.10 against a €1,500 budget (remaining €1,474.90). Review fixture records are labeled as such.

These checks cover this local foundation, not real bookings, cloud sync, native apps, regulatory advice, provider correctness, or user acceptance.

## Next review milestone

After user review, refine the first-trip and day-planning flows: destination/time-zone selection, stop dates and nights, clear arrival/return legs, item durations, flexible windows, edit/reorder/undo, richer empty and error states, and performance instrumentation. Verify the user's feedback before expanding the feature surface.

Then implement the approved React Native/Expo iPhone and Android clients around shared TypeScript domain/contracts, with device-specific UI. Native SQLite, secure session storage, offline restart/edit/reconnect, notifications, maps/documents, and TestFlight/Play testing are separate gates in the master plan. Responsive phone preview does not replace those builds.

Supabase administration remains unavailable. Prepare contracts/adapters locally; applying production migrations and proving web-to-phone sync require the project administrator. Live place/maps/transport/weather/translation/booking services, encrypted documents, imports, group sharing, settlement, disruptions, support, and store release continue through their specified milestones rather than appearing as unimplemented generic tabs.

## Review screenshots

- [Desktop day plan](/Users/adityabanwasi/.codex/visualizations/2026/09/27/01a0e3b2-3bc8-7091-bb8f-0db9ceb46f53/redesign-milestone-1-desktop.png)
- [Phone day plan](/Users/adityabanwasi/.codex/visualizations/2026/09/27/01a0e3b2-3bc8-7091-bb8f-0db9ceb46f53/redesign-milestone-1-phone.png)
