# Sites rebuild: one complete feature at a time

## Decision and scope

Build a new, semantic HTML/CSS/JavaScript frontend with the Sites workflow in a separate `site/` project. Treat the current interface as disposable. Keep Supabase as the source of truth for accounts, trips, and itinerary data. Reuse the existing database rules and domain validation where they still fit; replace Next.js server actions with explicit browser-to-Supabase operations or small HTTP endpoints where an operation needs server-side authority. Do not create a second trip database or pretend that a locally saved draft is cloud synced.

The first target is a web product that works on desktop and phone. Native iOS/Android packaging comes after the web interactions and backend contract are stable. Source changes for this rebuild belong on the local `Banwasi` branch. Do not commit, push, or alter another branch until the user requests it.

## Product shape

One trip is the working context. The first screen opens the active trip, or starts a new one when none exists. The primary surface is a visual day timeline with a compact Google map nearby. The top-level navigation stays limited to **Trip** and **Explore**; booking details, people, and trip settings open in context. A traveler should be able to answer “What is next?”, “Where is it?”, and “What can we do with an open day?” without searching through pages.

Design from zero: no inherited colors, typography, cards, decorative circles, or page structure. Each screen gets one dominant action, useful map/itinerary information above the fold, legible type, clear focus states, and short labels. Use clicks/taps and suggestions rather than a long setup form. Desktop can show map and timeline together; phone shows one primary surface at a time with a quick switch and thumb-reachable actions. Honor reduced motion and keep animations brief and purposeful.

## Technical boundary to prove first

The present repository contains Supabase tables and RLS policies, but some application behavior is implemented as Next.js server actions. Plain HTML cannot call those server actions as a stable public API. Before replacing a feature, list its reads, writes, validation, authentication, and failure states. Move only the needed operation to a documented HTTP/RPC contract, or call Supabase directly with the public anon key under verified RLS. Never put a service-role key in browser code. Keep the old Next app available until the equivalent Sites flow is working, then retire it deliberately.

The current environment does not contain a configured Supabase URL/anon key or Google Maps key. Local schema tests can validate the data rules; live cross-device behavior requires a connected Supabase project and its migrations. This is an integration gate, not a reason to display fictional success states.

## Feature sequence and acceptance gates

Each numbered feature is a vertical slice: data contract, real operation, HTML interface, empty/loading/error/success states, keyboard/touch support, responsive check, and a short review with the user. Finish and revise one slice before starting the next. A checklist item is complete only when it works after reload on a second browser or device where applicable.

0. **Foundation and Google Maps proof.** Inventory the actual `Banwasi` baseline and reconcile approved backend changes before replacing the UI. Create the isolated Sites project and local preview; establish the new type, spacing, motion, and navigation primitives; connect the existing Supabase project without copying secrets into source. Render one real Google map, verify the demo key's enabled services, referrer restrictions, map ID/marker support, quotas, and failure state. Verify the app can read its own trip or show a genuinely empty state. Measure initial load and map interaction latency before adding features.
1. **Start and reopen a trip.** Destination suggestions appear as the traveler types; selecting a real place records its place ID, coordinates, name, and time zone. Choose dates with a few taps or leave them undecided. One action creates the trip; refresh and a second device reopen the same trip. No trip name is required unless the traveler wants to change the suggested name. Handle no results, unavailable search, and offline/retry cleanly.
2. **Timeline and day page.** Show all trip days, open days, and confirmed commitments in time order. Selecting a day opens a focused schedule. Add a free-time idea to a day in one tap; move flexible items within/between days by pointer, touch, and keyboard. A confirmed booking or transport item cannot be dragged. Persist order and position, with undo for removal.
3. **Transport and booking details.** Add a flight or train by service ID and local departure/arrival details, including both time zones. Show both local times in the overview and full details in a contextual sheet. Distinguish manually entered schedule from provider-verified status. Booking references, tickets, and confirmation state need honest labels and appropriate access control.
4. **Explore with Google Places.** The map and short suggestion list show real sights, activities, food, and stays near the selected trip city/day. Search updates while typing. A result opens useful details and can be saved as an idea or placed on a day with one tap. Keep Google place IDs and permitted data according to Places policy; do not invent prices, availability, or a reservation. Multi-city trips change the suggestion anchor with the selected day.
5. **Trip editing and collaboration.** Edit destinations, dates, and members without losing itinerary items. Add owner/editor/viewer access with invitations and enforced database rules; test each role with distinct accounts. Edits made by one traveler become visible to another, with a conflict path rather than silent overwrite.
6. **Production hardening.** Audit accessibility, phone/desktop layout, latency, map quotas, error recovery, privacy, and security. Replace the demo Maps key with a production key and billing controls before launch. Add commercial flight-status, hotel inventory, and in-app booking integrations only when provider contracts and credentials exist; each becomes its own reviewed feature slice.

## Google Maps implementation rule

Use the Maps JavaScript API for the browser map, Places Autocomplete (New) for destination/place search, and Places Nearby Search (New) for suggestions when enabled by the key. Use a browser key restricted to the preview and production domains and to the required APIs. Keep any server-side key separate. A Google Maps demo key is for prototyping only and has limited services/quotas; it is not the launch credential. Google requires a map ID for advanced markers, and Nearby Search fields affect billing. See the [demo-key limits](https://developers.google.com/maps/demo-key), [Maps JavaScript setup](https://developers.google.com/maps/documentation/javascript/get-api-key), [advanced markers](https://developers.google.com/maps/documentation/javascript/advanced-markers/add-marker), [Nearby Search](https://developers.google.com/maps/documentation/places/web-service/nearby-search), and [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies).

## Review cadence

At the end of each slice, show a working desktop and phone preview and report: what the traveler can now do, what real service supplied the data, what was tested, and the exact remaining limitation. Collect feedback on that feature, revise it, and only then proceed. Do not add speculative tabs or features to fill the interface. Do not commit or push during these review checkpoints unless asked.
