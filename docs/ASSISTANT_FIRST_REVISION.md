# Product correction: a travel assistant, not a record-entry tool

September 27, 2026. This revision records the user's latest direction. It supersedes conflicting interaction, home-screen, commerce fallback, and delivery-order choices in MASTER_PLAN.md. Existing security, privacy, offline, accessibility, and home-to-home coverage requirements still apply. This is a review milestone; the flows below are specifications, not implemented capability claims.

## 1. The correction

Keep the neutral visual direction and typography. Replace form-led trip creation, generic resource dashboards, and manual itinerary assembly as the primary experience. A traveler should select real options, import existing reservations, and accept useful proposals. They should not need to name a trip, type addresses, assign time zones, or research every stop themselves.

Manual entry remains an accessible fallback for missing supplier coverage and corrections. Passenger identity, accessibility needs, and purchase consent cannot safely be guessed. Collect necessary information only at the action that requires it; reuse authorized saved information and clearly show what will be submitted.

Comprehensive means completing traveler jobs through usable integrations. More tabs, hardcoded attraction catalogs, generated travel facts, and disabled purchase buttons do not establish coverage. Match competitor traveler outcomes through our own design and authorized services; do not copy proprietary interfaces or scrape their private data.

## 2. Research baseline and parity register

Official product descriptions establish the following baseline, not proof that those companies expose their internal integrations to us.

| Reference | Documented behavior | Our required outcome | Current state |
| --- | --- | --- | --- |
| [Wanderlog](https://wanderlog.com/) | Linked itinerary/map, guides, reservation import, collaboration, budget splitting, route optimization, offline access and flight updates | Select a real place on a map, insert it into a feasible day; import bookings; plan together; retain useful offline context | Only local scheduling and one real place lookup exist; map, routing, sync, import and flight feed are missing |
| [TripIt import](https://www.tripit.com/web/free/how-it-works) | Forwarded confirmations become organized trips | Share/upload/forward a confirmation; review uncertain parsing only; reuse dates, legs and stay location | Not implemented |
| [TripIt/Pro](https://tripit.freshdesk.com/en/support/solutions/articles/103000063396-tripit-or-tripit-pro-) | Flight disruption/connection/gate/baggage alerts, alternative flights, airport maps, departure guidance and travel documents | Operational flight card, sourced changes, connection risk, ticket retrieval, airport context and reviewed alternatives | Not implemented; airport-map coverage must be separately licensed |
| [AllTrails navigation](https://support.alltrails.com/hc/en-gb/articles/37228358315668-Using-the-Navigate-feature) | Trail route navigation and downloaded maps for eligible plans | Trail geometry, elevation/distance/difficulty, trailhead access, route following and offline coverage | Not implemented; ordinary walking directions are insufficient for trail parity |

The remaining TripIt parity backlog includes calendar sharing, selected trusted travelers, document retrieval, renewal reminders, fare/seat monitoring and loyalty tracking where authorized data access exists. Each needs a coverage gate rather than an unlabeled imitation. Competitor plan tiers do not dictate our pricing or imply universal coverage.

## 3. Navigation and screen composition

Four phone destinations: **Today · Explore · Trip · You**. Today is the operational home, Explore is discovery and purchasing, Trip is the complete journey and bookings, You holds preferences, travelers, connections and downloads. Help is reachable from the current screen's menu; urgent operational issues also appear in Today. Search is contextual, not a fifth destination. Desktop uses a narrow navigation rail with the same concepts.

### Today: default during a trip

Select the active trip using local destination dates and explicit user selection. If overlapping trips exist, preserve the selected one and expose a compact switcher. Before departure, show preparation and the next travel commitment. After return, show receipts, refunds, unresolved bookings and archive actions. A browser time zone alone must not determine destination dates.

Phone first viewport:

1. Small location/date header with a location-state indicator; no greeting paragraph or statistics wall.
2. One priority card: changed flight, leave time, next ticket, or a useful next action. Choose in that order only when evidence supports it. Its primary action opens the ticket, route, flight details or proposed activity directly.
3. Real map showing current/selected location, the next stop and today's route. Attribution stays visible. Route estimates have freshness and mode; no decorative fake map.
4. Compact day strip and graphical schedule; gaps offer a single “Find something nearby” action. A short trip can show a few photo cards rather than a dense timeline.
5. At most three relevant suggestion cards initially, with progressive loading. Other widgets are below the fold or accessible through their related action.

Desktop: left rail, today's schedule in a readable column, large synchronized map beside it, selected item details in a dismissible inspector. Clicking a marker focuses the matching schedule item; selecting a schedule item focuses its marker. No duplicate sidebars of explanatory text. Tomorrow and the full trip remain one selection away. Phones use a map/detail bottom sheet rather than shrinking this layout.

| Widget | Eligibility and real input | Primary action | Missing/stale behavior |
| --- | --- | --- | --- |
| Flight | Imported or purchased operating leg, status feed, source time | View leg/ticket; review changes | Saved schedule labeled; no invented gate or “on time” |
| Leave time | Fixed commitment, sourced route estimate, user-adjustable arrival buffer | Start route | Ask for origin if absent; never present distance as live travel time |
| Next ticket | Confirmed supplier order or clearly labeled imported ticket | Open barcode/meeting point | Locally downloaded copy; disclose if unavailable offline |
| Free time | Gap between fixed commitments, current/selected area, interests, route matrix | Preview a short plan | Do not invent hours, available slots or transit coverage |
| Nearby food | Authorized POI/details data, walking reach, available opening data | Details/reserve if supported | “Hours unknown” is not “open now”; external listing is not bookable inventory |
| Weather | Destination coordinates, forecast timestamp | View effect on proposed day | Stale label; no asserted forecast without data |
| Hotel | Imported/confirmed stay, address, check-in conditions | Route/contact/check-in details | Never imply supplier check-in has been completed |
| Return home | Confirmed return leg, transfer and stored home-to-home tasks | Ticket/transfer/resolve task | Private address is not shared or geocoded automatically |

Use provider-licensed venue photography and map imagery when useful; preserve credit and image rights. Omit a photo when unavailable instead of substituting an unrelated stock location. Icons, route geometry and elevation charts remain useful graphics without photos. Every visual has an accessible textual equivalent; respect reduced motion.

## 4. Select-first traveler flows

The interaction counts below are design targets, excluding scrolling, authentication, mandatory supplier questions and typing a search query. They must be measured with actual users; they are not achieved metrics.

### Start without an existing booking

- Home asks “Where to?” with one destination search. Real suggestions come from a licensed autocomplete service; the current public Nominatim adapter cannot power autocomplete.
- Choose a result, tap dates on a calendar or choose “Dates later,” then Continue. Derive title, coordinates and time zone from a verified destination record. No required trip-name, currency, budget or address fields.
- The useful destination workspace opens immediately. Show real candidate stays, experiences and saved/imported commitments. Ask interests or pace only when refining a proposal, through optional chips; no onboarding questionnaire.
- Existing traveler preferences can be reused transparently. Price searches need an explicit guest/room/passenger selector; do not hide a default behind an apparently personalized price.
- Target: one short destination query and three selections to reach a useful draft. Multiple stops are added through another destination selection, not a multiline address form.

### Start with a booking

- Phone share sheet / web upload / verified forwarding address receives the confirmation.
- Parser identifies provider, booking reference, traveler, dates, operating legs, stay coordinates and attachments. Show a concise review only for ambiguous or changed fields.
- Suggest an existing matching trip or derive a new one; one acceptance links the commitment, timeline, map and ticket.
- Detect duplicates and cancellations using supplier identity and revisions. Keep the original document. Never silently turn a quoted offer into a confirmed reservation.
- Optional mailbox connection comes later with scoped authorization; it is not required for ordinary planning.

### Arrive with a vague idea

- Today offers “Explore nearby” or “Plan my afternoon.” Location permission is requested only when the traveler chooses nearby; selecting the hotel or a map area also works.
- Optional chips specify food, museums, outdoors, kids, low walking, available time and budget. Default results use explicit trip context, not guessed personal characteristics.
- Retrieve actual POIs/products, opening windows when known, travel times and bookable slots. Rank feasible options by reach, preferences and fit; diversity prevents three identical recommendations.
- Present two or three short proposals with map, total walking/time and known cost. Explain one main reason if requested, rather than a paragraph on every card.
- Accept a proposal in one action; preview any changed existing plans. Fixed bookings stay locked. An unavailable activity gets real alternatives, not a fabricated slot.
- “Surprise me” can choose a feasible free activity; it never purchases, moves a paid booking or claims unknown accessibility.

### Add something without typing a record

- Tap a photo or marker → view compact details → Add. Default to the currently selected day's feasible free window; if ambiguous, choose Today, Tomorrow or Ideas.
- Name, address, provider identity, coordinates and appropriate time zone come from the source. Duration and suggested placement are estimates with their origin, not confirmed venue facts.
- Drag/reorder on desktop; phone uses Move and a day/time chip selector. Both offer Undo and accessible alternatives.
- Editing a title/address lives behind More; manual entry is available when search/import cannot resolve the item.

### Buy within the app

- Select real offer → choose date/slot and party → review live total, terms and traveler details → explicitly confirm purchase → supplier order/ticket appears in Today and Trip.
- Reuse saved traveler data only with consent and per-order review. Show the seller/service contact, taxes, fees, currency, payment timing and cancellation deadline before confirmation.
- Reprice expired offers; require acceptance of changed terms. Payment authentication may require a bank-controlled challenge; return to the same order context afterward.
- No confirmation screen until supplier success is reconciled. A timeout means “Checking booking,” not an invitation to purchase again.
- Cancellation is a quoted provider operation with refund amount and confirmation; refund pending and completed are distinct. Importing a reservation does not give us permission or capability to change it.

## 5. Location, maps and assistant implementation

1. Introduce a canonical Destination and Place model: provider identity, coordinates, IANA zone, localized labels, provenance/freshness and per-field storage rights. Remove city-name heuristics from primary creation.
2. Add explicit foreground location states: not requested, locating, coarse/accurate, denied, stale, unavailable. Expose “Use this area” and map/hotel selection. No mandatory permission, continuous background tracking or precise history by default.
3. Use the master plan's Mapbox map/routing direction with a compatible POI provider, initially Geoapify subject to product/license verification. [Geoapify Places](https://apidocs.geoapify.com/docs/places/) documents category and geographic filters; [details](https://www.geoapify.com/place-details-api/) supplies available attributes. Availability is incomplete and cannot be inferred from missing fields.
4. Wrap map, geocoding, discovery, photos and routes behind separate server adapters with capability flags, schema validation, cache rules, quotas and source times. [Mapbox Directions](https://docs.mapbox.com/api/navigation/directions/) includes walking routes; this does not establish transit or verified hiking-route coverage.
5. A deterministic planner first checks fixed reservations, hours, dates/zones, slot inventory, duration, travel, arrival buffers and user constraints. Rank valid candidates, then generate a human-readable proposal. Optional language-model interpretation cannot manufacture facts or authorize a transaction.
6. Today receives a small view model assembled from trip state and sourced events. Load saved commitments immediately; load map/discovery/weather independently. A slow provider must not freeze navigation or make tickets inaccessible.
7. Replanning compares old/new commitments, impacted legs and refundable/nonrefundable purchases. User approves changes; the assistant cannot silently modify paid services.

The existing OpenStreetMap lookup remains a limited real proof, not the discovery engine. The [public Nominatim policy](https://operations.osmfoundation.org/policies/nominatim/) imposes a one-request-per-second application limit, caching/identification/attribution requirements, prohibits autocomplete and systematic POI extraction, and requires avoiding personal/confidential submissions. Keep its existing production gate; do not expand it into automatic nearby discovery.

## 6. Provider decisions and genuine completion gates

These are selected implementation routes, not connected accounts. Never promote sandbox results as production inventory. Credentials remain server-side; provider activation, contracts and charges require an authorized business owner.

| Job | Route | Required complete flow / gate |
| --- | --- | --- |
| Flight search and sales | Duffel | Search offers, reprice, passenger/ancillary selection, payment, supplier order, ticket and supported changes/cancel/refund. [Live mode](https://duffel.com/guides/getting-started) needs account activation and verification; a test token alone cannot sell flights. Verify launch-country and airline coverage. |
| Flight operations, including externally booked flights | FlightAware AeroAPI | Resolve operating leg by date/route, retain scheduled/estimated/actual times separately, gate/terminal when supplied, webhook/poll reconciliation, freshness, alerts and affected-plan review. [AeroAPI](https://www.flightaware.com/commercial/aeroapi/) is a separate data service; commerce is not a flight-status feed. |
| Lodging, then supported rentals | Booking.com Demand, Search/look/book access | [Prerequisites](https://developers.booking.com/demand/docs/getting-started/prerequisites): managed affiliate contract and credentials. [Orders](https://developers.booking.com/demand/docs/orders-api/overview) supports in-app orders for supported services; implement live preview/create/details/cancellation and payment conditions. Validate service/version scope rather than assume every listed category supports identical checkout. |
| Tours, local guides and attraction tickets | Viator transactional access | Search real products, provider photos, availability/party/language/meeting point, mandatory booking questions, live hold/reprice, order/voucher, cancellation and supplier contact. [Access models](https://partnerresources.viator.com/travel-commerce/) distinguish referral from merchant transactions; [technical guide](https://partnerresources.viator.com/travel-commerce/technical-guide/) describes different endpoint access tiers. Obtain the appropriate approved transactional tier and support model. A generic venue marker is not a bookable guide. |
| Dining, transfers, rail, ferries, cruises, car hire, rides | Service-specific approved suppliers | Register search/transaction/manage capabilities individually; test real inventory and fulfillment. No universal endpoint is assumed. A link does not satisfy integrated booking. Add providers by proven coverage rather than exposing dead categories. |
| Hiking | Licensed trail dataset and route service selected after access/coverage review | Verified geometry/source, elevation, difficulty basis, season/closures when available, trailhead route, offline download and route following. Do not scrape AllTrails or label arbitrary walking routes as verified trails. |
| Reservation ingestion | Our verified forwarding/upload/share pipeline | Quarantine attachments, parse isolated content, duplicate/revision detection, review uncertainty, private originals, trip linking. No inference of live status from a confirmation email. |
| Weather, currency, entry guidance, eSIM, translation | Master-plan providers with individual contracts | Connect actual services and retain source/freshness/coverage. Utility purchases require the same order/support discipline. These are not completed by generic links or fabricated widgets. |

**In-app purchasing is the acceptance goal for supported launch services.** A supplier redirect is a clearly labeled interim limitation and does not count as that milestone passing. Supplier login, bank authentication and unsupported operators may still require an external surface. We cannot honestly promise every travel service worldwide is bookable without exceptions. Publish a precise coverage matrix; prioritize replacing handoffs with transactional providers where access exists.

## 7. Data and operation contracts

- `Destination`: identity, coordinates, zone, labels and provenance. `Trip`: selected destinations, flexible/exact dates, travelers and preferences; name generated and optionally editable.
- `Commitment`: linked flight/stay/activity/transport order or imported record, fixedness, local times plus zones, source, status and revision. `Idea`: a saved place/product, distinct from paid inventory.
- `Offer`: supplier product IDs, travelers/party, live price breakdown, currency, slot, terms, expiry and quote version. Never reuse a display price as a final purchase price.
- `Order`: internal idempotency key, supplier reference, consented terms/version, authorized traveler snapshot, payment reference and reconciliation status. Never store raw card data in ordinary app records.
- `OperationalEvent`: resolved leg/order, source event ID/version, observed/source times, old/new values. Deduplicate webhook/poll repeats and avoid regressing newer states.
- `Proposal`: constraint inputs, route/availability snapshots, estimates, expiry, affected commitments and explicit acceptance. A saved proposal is not a purchased itinerary.
- `TodayView`: priority action, map features, compact timeline, contextual widgets and per-section stale/loading/error state. It is derived, not an independent hardcoded catalog.
- Server jobs handle ingestion, provider updates, orders, alerts and reconciliation. Authenticated ownership, row-level permissions, secrets, signed-file access and sync precede sensitive storage and cross-device operational claims.

## 8. Revised small milestones and stop points

This replaces the previous tendency to finish a manual organizer before real discovery. Perform authorized local work autonomously; stop for a visual/function review after each bounded slice. Do not create all these screens at once.

| Slice | Deliverable | Evidence needed before review |
| --- | --- | --- |
| **R0 — this correction** | Written flows, comparator baseline, supplier/access register, screen composition and acceptance rules | Review this document; no new claim that booking is functional |
| **R1 — destination and location** | Real selectable destination search; canonical coordinates/zone; click-calendar/dates-later creation; map with selected area; optional foreground nearby; generated trip name | Empty storage has no seeded trip; select actual destination without naming it; location denial works; valid map attribution; real lookup persists on reload. Autocomplete needs a suitable provider rather than expanding public Nominatim. |
| **R2 — useful Today and Explore** | Active trip opens Today; real map/places/photos where licensed; category chips; one-action add; nearby and feasible short-day proposal | Real destination query → sourced options → accepted feasible day → reopen. Fixed item not moved, stale hours disclosed, no fictional photo/catalog; phone and desktop reviewed separately. |
| **R3 — imported trip and flight** | Share/upload/forward import; matching/duplicate review; resolved real flight leg; status and flight widget | Actual authorized confirmation imports with little correction; real tracked leg updates; delayed/cancelled/stale events affect correct commitments; ticket opens offline if downloaded. |
| **R4 — first complete purchase** | One transactional tour/activity provider; live slot → review → purchase → voucher → cancel/refund/support | Supplier sandbox full lifecycle plus authorized production validation; timeout cannot duplicate purchase. Requires provider access, backend ownership and business support readiness. |
| **R5 — flights and stays commerce** | Duffel and approved Demand integrations, traveler reuse, itinerary order reconciliation | One real supported flight/stay end to end; fees, expired price, payment challenge, cancellation and order-sync tested. No “all inventory” claim. |
| **R6 — native and sync parity** | Expo iOS/Android, share/location/push/download UX, authenticated web/native trip sync | Real devices, offline restart/reconnect, revoked membership, same bookings and no duplicate writes. Native work starts once API contracts stabilize; it need not wait for all supplier categories. |
| **R7 — broaden home-to-home coverage** | Transfers/dining/trails/transit/essentials/group coordination and remaining comparator features | Each category passes its real-data, fulfillment, offline/failure and support gates in the master coverage register. |
| **R8 — launch readiness** | Real-trip beta, performance/a11y/privacy audits, store builds, monitoring/support/rollback | Task success on supported trips, no critical data-loss/security defects, accurate coverage, authorized publication. |

Access work happens alongside implementation. No production place-provider credentials were configured during the latest inspection; Supabase administration remains unavailable; no booking or flight feed has been demonstrated. We can build/test adapters locally, but production provider access and authenticated backend setup are concrete prerequisites to passing the affected gates. Do not obscure these gaps with attractive simulated screens.

## 9. Acceptance and visual restraint

- No required trip naming or typed addresses in primary flows. Import and selection supply metadata. Mandatory supplier questions remain visible and reusable where allowed.
- A known ticket is reachable in one action from Today; a nearby place can be added in one action from its card; proposals take one acceptance after review. Measure these targets, not just count fewer form fields.
- Initial Today view has one dominant action and a useful map; do not display every capability as a widget. Widgets are time/context eligible, capped and dismissed when irrelevant.
- No synthetic gate, forecast, rating, availability, price, flight status or source image. Hardcoded navigation labels, category taxonomy, validation messages and stable instructions are legitimate UI; hardcoded destination/business facts are not a substitute for integration.
- Provider failures preserve saved plans/tickets. Unknown is explicit; empty content is not populated with fake suggestions. Expensive data work stays out of navigation's critical path.
- Validate keyboard/screen-reader behavior, one-handed phone use, loading/stale/permission-denied/empty states and separate desktop task flows. Measure first load, later navigation and actual provider latency before claiming speed fixes.
- The present web build remains an incomplete local foundation. This revision sets the direction toward a functional assistant and marketplace; it does not reclassify missing integrations as finished features.
