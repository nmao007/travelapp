# Review checkpoint — destination discovery and parity register

September 27, 2026. The user's Wanderlog/TripIt scope is now tracked, feature by feature, in [WANDERLOG_TRIPIT_PARITY.md](WANDERLOG_TRIPIT_PARITY.md). This checkpoint implements the first part of its traveler flow; it does **not** mark the whole comparison list complete. Pause for user review here as requested.

## What works

- The “Where to?” field is visually simpler: compact result rows with place name and geographic context, keyboard selection, live Photon suggestions while typing, and cycling example placeholders. The example strings are UI hints, not a fabricated destination feed.
- A labeled **Explore** icon button opens a real MapLibre globe using the OpenFreeMap vector style. Drag/zoom/tap a geographic area, or use the keyboard-accessible **Use center** button. The globe starts over a known geographic camera position so Use center works immediately, but no trip is prefilled or created.
- A globe selection calls Photon's `/reverse` endpoint with the actual clicked coordinates, accepts only validated OSM-identified nearby places within 150 km, resolves their time zones on the server, and offers up to three places. Selecting one enters the existing map/date flow without a new naming form. Taps on the background outside the rendered globe are ignored. Empty, provider-error and no-WebGL paths show honest messages; the user can still search by name.
- Search and reverse requests share the same per-process rate controls, serialization, response validation and cache. The public Photon service is for development, with `PHOTON_SERVICE_URL` required in production. The server never substitutes fake results. OpenFreeMap source credits remain visible on phone and desktop.
- The phone globe begins at a smaller zoom so the sphere is recognizable within its frame. After a selection, it contracts and reveals the actual nearby choices automatically. Desktop retains a larger globe. Accessibility labels, focusable search/map actions and reduced-motion scrolling behavior are included.

## Verification

40 automated tests pass, including reverse request parameters, OSM identity, faraway-result exclusion and invalid coordinates. Type checking and production build pass. In the live browser, tapping Spain returned actual sourced matches (for example Cubelles/Cunit/Sitges); choosing another Spanish match opened the destination map/calendar. The phone review frame returned real Paris-area matches through **Use center**. Blank background taps did not create a selection, while land taps still did. Desktop and iPhone-layout views were visually checked. This is responsive web preview, not an installed iPhone build or a performance benchmark.

- [Desktop globe and actual choices](/Users/adityabanwasi/.codex/visualizations/2026/09/27/01a0e3b2-3bc8-7091-bb8f-0db9ceb46f53/globe-desktop-destinations.png)
- [iPhone-layout globe and actual choices](/Users/adityabanwasi/.codex/visualizations/2026/09/27/01a0e3b2-3bc8-7091-bb8f-0db9ceb46f53/globe-phone-destinations.png)

## Next approved implementation slice

Unify real place, destination, day, Saved and reservation identities; allow multi-city trips and one-action add/reorder across day and Saved; project those same objects into map layers. This is the core Wanderlog-like organizer milestone. The parity register spells out later imports, live flight operations, collaboration, offline/native and booking lifecycles. Supabase administration and commercial supplier access remain separate prerequisites; neither was bypassed or silently simulated.
