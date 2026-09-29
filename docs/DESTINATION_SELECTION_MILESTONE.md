# R1a — choose a real destination, then tap dates

**Historical implementation checkpoint:** [VECTOR_MAPS_AND_AUTOCOMPLETE.md](VECTOR_MAPS_AND_AUTOCOMPLETE.md) now supersedes the raster map and explicit destination submission described below.

September 27, 2026. A bounded implementation checkpoint under [the assistant-first revision](ASSISTANT_FIRST_REVISION.md). Stop for review here; this completes part of R1, not the full location/discovery/dashboard milestone.

## Delivered

- New trip opens one destination search, rather than a trip-details form. Submit a short query, select a real city/settlement result, tap departure and return on the calendar, then Continue. Dates can also remain undecided.
- The selected result supplies a generated trip title, destination label, source identity, coordinates and a geographic time-zone lookup. No required name, typed address, budget, currency, traveler questionnaire or manual time-zone field in this flow.
- A genuine map preview marks the selected destination. Desktop places map and calendar beside each other; phone uses a shorter map above the calendar. Attribution is visible. The failed external embedded-map attempt was replaced with a direct Leaflet renderer.
- The calendar handles month navigation, selected endpoints, range highlighting and earlier-date reselection. Existing date validation rejects invalid/reversed/overlong ranges. Multiple possible time zones require explicit selection rather than silently choosing one.
- Canonical destination metadata is stored with the guest trip. Existing trips still open without that optional field. Editing the textual stops or zone clears geographic metadata that would otherwise become inconsistent; it does not silently pretend to geocode edited text.
- The hardcoded familiar-city time-zone mapping has been removed. No catalog of fictional destinations or automatic trip insertion was added. Existing browser drafts are preserved. Browser verification intentionally created a Lisbon draft; it is not a shipped default.

## Real data and operating boundaries

Destination lookup extends the existing server-side Nominatim-compatible adapter with city filtering and structured address details. It shares the application's queue and rate limit with general place lookup; the two query types use separate cache keys. It runs only after explicit search submission, never as autocomplete or background discovery.

The [Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/) requires attribution, identification, caching and an application-wide maximum of one request per second; it prohibits autocomplete and systematic extraction and excludes personal/confidential queries. The adapter retains its 1.1-second request spacing, bounded cache/queue, timeouts and honest errors. Production remains disabled without a reviewed provider configuration. A distributed deployment still needs shared rate controls. This city/settlement search does not promise every region, airport, trail or address as a destination.

[geo-tz](https://github.com/evansiroky/node-geo-tz) 8.1.9 supplies geographic time-zone boundaries on the server, using its comprehensive dataset. The zone comes from the selected result's coordinates, not a typed city-name heuristic or browser zone. This is a boundary-derived result, not an official guarantee for disputed boundaries or future timekeeping changes; maintain the dataset and runtime time-zone rules. Package/data attribution and maintenance are part of the production review. Next.js keeps the library external to the client and includes its runtime data in server tracing.

The development map uses [Leaflet](https://leafletjs.com/examples/quick-start/) with actual OpenStreetMap raster tiles. The [tile policy](https://operations.osmfoundation.org/policies/tiles/) requires visible attribution, browser identification/referrer and normal HTTP caching; bulk downloading, prefetching and offline tile downloads are prohibited. This is online viewport rendering only, with no offline/prefetch feature. Public tiles have no availability guarantee. Production map configuration is required rather than enabling public tiles by default.

`/api/map-config` reads `MAP_TILE_URL` (HTTPS raster template with `{z}`, `{x}`, `{y}`) and `MAP_TILE_ATTRIBUTION`. Only a public/browser credential belongs in that URL, never a secret server key. Provider terms and supported zoom levels must be reviewed before deployment. Runtime configuration can change after server restart. A loading/error state keeps calendar creation usable during map failures; receiving some tiles does not establish complete regional coverage.

This does not use the Open-Meteo free service for a commercial-product integration. No commercial geocoding, booking, maps, weather or flight-status account was provisioned. No production purchases or deployment occurred.

## Validation

- 35 automated tests pass, including real geographic time-zone lookup independent of destination text, canonical metadata serialization, ambiguous/invalid destination handling, date-range validation, leap-year/month/calendar alignment, city-query filtering and cache separation, shared search behavior, and existing domain/database authorization tests.
- Type checking and the production build pass. The build's traced destination route includes the boundary data files. Leaflet loads only when a destination map is displayed; no field-performance or native-device claim is made.
- Live browser: `Lisbon, Portugal` returned an actual OpenStreetMap destination. Selected October 5–9; Continue created the generated Lisbon trip; reload retained its day range. A fresh creation view rendered real Lisbon map tiles, center marker and attribution.
- Desktop 1280×900 and phone 390×852 were visually checked. DOM width equals viewport width at 390px and 320px. Temporary viewport overrides were reset. Calendar and map accessibility labels were inspected; this is not a complete accessibility audit.
- [Desktop proof](../../../.codex/visualizations/2026/09/27/01a0e3b2-3bc8-7091-bb8f-0db9ceb46f53/destination-selection-desktop.png) and [phone proof](../../../.codex/visualizations/2026/09/27/01a0e3b2-3bc8-7091-bb8f-0db9ceb46f53/destination-selection-phone.png) are local review artifacts, not production screens with a booked itinerary.

## Next bounded slice

Finish R1's foreground/manual-area location and persistent map context, then R2's contextual Today/Explore flow. Acquire a suitable production search/discovery/maps provider before adding autocomplete or nearby category searches. Replace the remaining organizer navigation/home as that integrated slice ships, rather than renaming existing manual screens and calling them an assistant.

Current limitations: one selected destination in the new creation flow, no GPS/nearby discovery yet, no routes or live operational flight card, no reservation import or in-app booking, no cross-device sync/native build. The created trip currently opens the existing day plan. Guest IndexedDB is local persistence, not a secure document vault. Supabase administration remains unavailable; account authorization is unchanged.
