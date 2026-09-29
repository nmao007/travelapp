# Review checkpoint — multi-city trips and nearby discovery

September 27, 2026. This is the next small, reviewable slice of the [Wanderlog/TripIt parity plan](WANDERLOG_TRIPIT_PARITY.md). It is an operational trip-planning foundation, not booking or full competitor parity.

## Traveler flow now implemented

1. Start a trip by selecting a real Photon destination. **Add stop** keeps the same trip open; choose more real cities, reorder or remove them, then select dates or decide later. The trip stores each OSM identity, coordinates and time zone alongside the route order.
2. Open **Trip details** later from the Trip, Plan or More controls. Add a sourced city, move/remove stops, edit name/dates/party/pace/budget, and save without discarding previously saved place identities. A date change that would put an existing day item outside the trip is rejected with an explanation.
3. **Delete trip** moves it to **Recently deleted**, where it can be restored. Permanent deletion requires a second explicit UI step. Guest changes persist in this browser; the account/cloud migration remains unapplied because Supabase administration is held elsewhere.
4. In **Explore → Nearby**, pick any resolved trip city. A bounded OpenStreetMap Overpass query returns actual named sights, museums, nature and food places with coordinates and source links. Category chips filter both cards and colored map pins; a selected pin opens concise details; one tap saves it as an idea or places it on the selected day. **Search places** remains available for a specific name. Provider errors show retry rather than fictional recommendations.
5. The Trip screen offers up to three real places near its first stop with one-tap save and a path to Explore. Empty Plan days also lead to Explore. This is proximity/category discovery, **not** a personalized ranking; opening hours, popularity, live availability and travel feasibility are unknown until sourced providers are integrated.

The interface uses a small Nearby/Search choice, map and cards on desktop, map-first browse on phone, restrained transitions and reduced-motion support. Stops belong to a single journey; the itinerary and saved ideas are still trip-level. A future stop/date assignment model will attach each day and booking to a particular city and coordinate intercity travel.

## Verification and limits

- 47 automated tests pass, including source validation, multi-city creation and edit invariants, date-boundary preservation, and provider failure without fabricated places. Type checking and production build pass.
- Live desktop and phone checks: Lisbon and Porto were selected from live suggestions; Lisbon/Porto/Madrid formed one trip; route/name edits and a real saved Lisbon museum survived reload; recoverable delete and restore worked. The Lisbon Explore map showed sourced POIs as selectable pins. The phone layout was checked at 390 × 844.
- A public Overpass call for Porto failed transiently. The UI offers retry and named search, and the query was narrowed to reduce cost. Production requires `POI_SERVICE_URL` pointing to a properly hosted/contracted Overpass-compatible service. Public Overpass is only a development fallback, consistent with its [usage guidance](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html).
- The map is OpenFreeMap/MapLibre. Provider records may be incomplete or outdated; absent addresses are labeled honestly. No ratings, hours or booking claims are synthesized. The guest workspace has no cloud sync, licensed inventory, payment flow, live flights, secure ticket storage, foreground GPS or native app build yet.

## Next slices after this review

1. Give every day a selected destination, assign saved places/bookings to that city, add intercity legs, and keep the route/day/map in sync. Then allow day reordering, moving ideas to days, and undo with one gesture.
2. Add provider-backed hours, accessibility, official links and route times. Rank candidates using opening status, travel time, stated preferences and the actual day gap; distinguish absent data from a bad recommendation. Add permission-gated foreground location with manual fallback.
3. Build confirmation import and live flight operations, then one genuine in-app booking lifecycle at a time under supplier agreements. Connect authenticated cross-device sync once the database owner applies and validates the migration. Native iPhone/Android shells should share domain contracts and be tested on devices before store submission.

Pause for user review here, as requested.
