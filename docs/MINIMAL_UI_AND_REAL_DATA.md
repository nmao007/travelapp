# Review milestone 2 — less interface, real place lookup

**Historical implementation checkpoint.** The user's subsequent feedback rejects form-led creation and a list-led home as the primary product experience. [ASSISTANT_FIRST_REVISION.md](ASSISTANT_FIRST_REVISION.md) now governs the next flows and milestones. The implementation recorded here remains an incomplete foundation.

September 27, 2026. This milestone responds to the user's feedback about clutter, excessive interaction, fictional content, typography, and platform differences. Pause after delivery for review.

## What changed

- My trips replaces the promotional entry screen. No sample trip is inserted, selected, or listed automatically. Existing guest drafts are preserved. Old sample deep links require an explicit development fixture marker; the normal workspace does not open the sample.
- Creating a trip uses one form: destination and dates, or dates later. Travelers, budget, currency, name, pace, and zone are optional disclosure fields. Creation opens the plan directly.
- Trip presents the next plan item and a small practical-resource list. The dashboard stages, prominent statistics, navigation subtitles, and introductory copy have been removed.
- Plan uses compact day controls and plain itinerary rows. Addresses are abbreviated in the list; complete details remain in editing/source views. Phone puts the day's items first, while desktop can show the stop outline alongside. Phone preparation and resource summaries use a smaller layout rather than duplicating the desktop sidebar.
- Essentials is a resource list. Practical guidance is available on demand rather than appearing as several paragraphs immediately.
- Edit forms reveal address/notes/time zone when requested. Reservation references appear when relevant. Removal is available inside editing on phone, with Undo until another mutation occurs. Undo is a session convenience, not durable revision history.
- DM Sans is the interface font; Manrope is used for headings. Latin variable WOFF2 files are served locally (about 62 kB combined) with their SIL Open Font Licenses in `public/fonts`. Other writing systems use system fallback fonts; this is not a complete multilingual typography validation.

## Real integration implemented

Explore calls `/api/places` on explicit Search submission. The server queries a Nominatim-compatible provider and returns actual OpenStreetMap names, addresses, coordinates, object IDs, source URLs, and retrieval timestamps. Provider strings are rendered as text; coordinates and source identifiers are validated. It does not fabricate results, photos, opening hours, tickets, reviews, prices, or booking availability.

A result can be saved to unscheduled ideas with one action, or opened and assigned to a specific trip day. The source record travels with the itinerary entry, survives local reload, and is retained when the item is edited. Duplicate source/day combinations are rejected by the add flow. Search does not run automatically while typing or merely opening a screen.

**Live browser verification:** `Museu Calouste Gulbenkian` in `Lisbon, Portugal` returned **Calouste Gulbenkian Museum**, with address and [OpenStreetMap relation 17036063](https://www.openstreetmap.org/relation/17036063). It was assigned to November 4 in an explicitly labeled local review draft, then reopened from the day plan after reload. Phone remove/Undo restored the same place. This proves one real provider lookup and persistence flow, not every venue/destination/provider or live travel operations.

The previous milestone's Tokyo fixture and starter catalog are no longer the normal Explore experience. Test drafts explicitly created during browser verification can remain in that browser's local storage; they are not shipped as default trips or injected into other users' browsers.

## Provider policy and production boundary

The public Nominatim service has strict capacity restrictions: **maximum one request/second for the entire application**, no autocomplete, no systematic POI extraction, identifying User-Agent, attribution, and caching. See the [official usage policy](https://operations.osmfoundation.org/policies/nominatim/) and [search API](https://nominatim.org/release-docs/latest/api/Search/).

The local single-server adapter spaces outgoing requests by at least 1.1 seconds, serializes requests, deduplicates concurrent identical queries, maintains a bounded 24-hour cache, limits the pending queue, and uses an eight-second provider timeout. It accepts public place searches; personal or confidential material must not be sent to this provider.

**Public Nominatim is disabled by default in production.** Before hosting, either configure `PLACES_SERVICE_URL` with a reviewed HTTPS Nominatim-compatible hosted service or explicitly approve/operate a moderate single-server deployment using `PLACES_SINGLE_SERVER=true`. That flag is unsuitable for multiple processes, replicas, serverless instances, or scaled commercial traffic: the in-memory rate limiter is not shared. Provider URL/configuration changes require restarting the server, without changing mobile/web client software. A licensed production service with shared caching/rate controls and observability is the recommended deployment path.

No commercial Google/Mapbox/Geoapify/Foursquare place credentials were configured during inspection. These providers are not silently integrated by this adapter: each needs its own contract, authorization, API adapter, data-storage/attribution rules, billing controls, and tests. No paid plan was purchased and no account security was bypassed.

## How polished web and phone products are made

Web interfaces use HTML, CSS, and JavaScript; this project uses React/Next.js to compose them. Native mobile clients can use platform-native UI or React Native/Expo, as chosen in the master plan. A shared API, domain model, and design tokens connect clients; each client still needs suitable screens, navigation, gestures, keyboard handling, and performance work.

Visual quality comes from a small consistent design system, carefully edited content, a clear main action, whitespace, typography, motion, complete loading/error/empty states, and testing actual tasks. It does not come from replacing HTML with another technology. Uber documents its foundations through [Base](https://base.uber.com/) and its web component implementation through [Base Web](https://github.com/uber/baseweb).

This milestone improves the web UI and one real-data path. It does **not** claim a finished commercial product, native iPhone/Android builds, cross-device sync, secure document storage, live routing, flight alerts, import, group coordination, or integrated purchasing. Those remain explicit master-plan gates. Supabase administration is still controlled by another person.

## Validation and next check-in

Automated tests cover provider normalization, hostile/malformed source data, query bounds, deduplication/cache reuse, request spacing, and real failure handling without fabricated fallback. Browser checks cover the actual provider response, day assignment, source visibility, reload, phone editing/Undo, and responsive layout. Build/type checks and the domain/database suite remain required.

At this check-in, review visual density, one-form creation, phone day planning, and Explore's real search. Once the user responds, continue with the production provider connection and destination resolution, explicit stop nights/door-to-door legs, and authenticated persistence before expanding into more provider-dependent features. Keep the platform/native work separate from responsive web preview claims.
