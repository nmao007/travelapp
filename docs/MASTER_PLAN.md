# TripPilot — complete tourism travel product and implementation plan

**Latest steering:** [ASSISTANT_FIRST_REVISION.md](ASSISTANT_FIRST_REVISION.md) supersedes conflicting interaction, navigation, dashboard, commerce fallback and milestone-order choices below. The product now prioritizes selection/import, an active-trip Today dashboard, location-driven discovery and actual in-app purchasing for supported services. This document remains the comprehensive home-to-home coverage register; its original implementation order is historical where revised.

**Status: approved by the user September 27, 2026; redesign implementation authorized.**  
**Prepared: September 27, 2026.** Research links were checked on this date.  
**Authority:** This proposal replaces the earlier product/layout blueprint. Existing screens, colors, navigation, and prototypes are disposable. Dependable domain logic may be reused only after checking it against these requirements.

## Contents

1. [What we are building](#1-what-we-are-building)
2. [Research and its consequences](#2-research-and-its-consequences)
3. [People, trip types, and scope](#3-people-trip-types-and-scope)
4. [New information architecture](#4-new-information-architecture)
5. [First trip: exact flow](#5-first-trip-exact-flow)
6. [Screen-by-screen layouts](#6-screen-by-screen-layouts)
7. [Detailed capability specifications](#7-detailed-capability-specifications)
8. [A complete example journey](#8-a-complete-example-journey)
9. [Visual and interaction redesign](#9-visual-and-interaction-redesign)
10. [Performance diagnosis and targets](#10-performance-diagnosis-and-targets)
11. [Architecture and data model](#11-architecture-and-data-model)
12. [Offline, synchronization, and notifications](#12-offline-synchronization-and-notifications)
13. [Provider and commercial implementation](#13-provider-and-commercial-implementation)
14. [Security, privacy, and reliability](#14-security-privacy-and-reliability)
15. [Build sequence and completion gates](#15-build-sequence-and-completion-gates)
16. [Testing and real-trip validation](#16-testing-and-real-trip-validation)
17. [Release, support, and ongoing operation](#17-release-support-and-ongoing-operation)
18. [Previewing phone and desktop](#18-previewing-phone-and-desktop)
19. [Approval boundary and next work](#19-approval-boundary-and-next-work)

## 1. What we are building

A traveler should be able to organize a tourism trip, understand the day ahead, retrieve what they need immediately, handle a change, and get home using one connected trip workspace. The same trip must work on an iPhone, Android phone, tablet, and desktop. A laptop is optional for every essential task.

The product is centered on **places, days, travel legs, and commitments**. A reservation, ticket, route, cost, preparation task, and reminder connect to the relevant part of the trip. They do not become unrelated feature islands.

The defining benefits we will test are:

- Create a useful initial plan without filling out a lengthy profile.
- Know which commitments are booked, which ideas are tentative, and what still needs attention.
- Make realistic days that account for travel, opening hours, meal breaks, rest, and personal constraints.
- Retrieve a booking reference, ticket, address in the local language, or return-to-hotel route quickly, including with poor connectivity.
- Bring discovery into the actual itinerary without copying between apps.
- Cover preparation at home, travel days, destination days, disruptions, and the return home.
- Keep the original plan, important documents, and travel companions synchronized without silent data loss.

**Definition of comprehensive:** every identified traveler job below has a specific screen, data contract, implementation route, failure behavior, delivery milestone, and completion test. A catalog of disabled buttons is not delivery. Third-party transactions can remain provider-operated where needed, but the app must preserve context and bring the result back into the trip.

This is a broad product specification, not a claim that literally every possible destination, operator, or personal circumstance can be supported immediately. New needs enter a coverage register with the same specification requirements. Coverage will be published accurately by destination and provider.

## 2. Research and its consequences

### 2.1 Existing product baseline

[Wanderlog's own product page](https://wanderlog.com/) describes itinerary/map planning, reservation imports, route optimization, collaboration, budgeting, packing, and offline access. [TripIt Pro](https://www.tripit.com/web/pro) emphasizes operational flight alerts, reminders, airport information, alternatives, and documents. These establish a baseline to meet; adding similarly named tabs would not differentiate this product.

**Our proposed differentiation, still to validate:** connect planning quality, preparation, practical on-the-ground needs, and disruption/return workflows to the same trip objects; optimize for a traveler who relies only on a phone. Compare task completion and reliability rather than claiming superiority from a feature list.

### 2.2 Preparation requires personal context

The [U.S. State Department checklist](https://travel.state.gov/en/international-travel/planning/checklist.html) covers entry/document readiness, traveler-specific needs, and unexpected problems. The [CDC preparation guide](https://wwwnc.cdc.gov/travel/page/before-travel) supports advance health preparation and consultation. These are examples of authoritative sources, not universal instructions for travelers of every nationality.

**Product consequence:** requirements depend on passport nationality, residence when relevant, transit points, destination, dates, and activities. A generic checked “passport” item cannot mean a traveler is eligible to enter. We will distinguish a reminder from a verified source result and avoid generating medical eligibility advice.

### 2.3 Data integration is a product constraint

[Google Places policies](https://developers.google.com/maps/documentation/places/web-service/policies) constrain caching, display, and attribution. [Mapbox documents native offline regions](https://docs.mapbox.com/help/dive-deeper/mobile-offline/). This means online place discovery and downloaded travel essentials need explicit licensing and separate storage policies; one provider response cannot simply be copied into an unlimited offline database.

[Booking.com Demand API prerequisites](https://developers.booking.com/demand/docs/getting-started/prerequisites) require managed affiliate participation and credentials. [Duffel's documentation](https://duffel.com/docs) describes flight/stay integration and post-booking operations. API existence does not establish that we have commercial access or comprehensive inventory.

**Product consequence:** plan provider acquisition, inventory coverage, cancellation/refund support, and reconciliation before advertising integrated booking. Manual capture/import must work independently of any marketplace deal.

### 2.4 Usability and speed are acceptance criteria

The user's [Figma UI principles reference](https://www.figma.com/resource-library/ui-design-principles/) informs hierarchy, progressive disclosure, consistency, contrast, accessibility, proximity, and alignment. [WCAG 2.2](https://www.w3.org/TR/WCAG22/) supplies the accessibility baseline. Our touch targets will generally be larger than WCAG's [24 CSS pixel minimum criterion and exceptions](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).

[Web Vitals](https://web.dev/articles/vitals) defines good thresholds of LCP at most 2.5 seconds, INP at most 200 milliseconds, and CLS at most 0.1, evaluated at the 75th percentile. We will measure these and task-specific latency. Attractive screenshots do not establish that the app is quick or usable.

### 2.5 Research still required after approval

Desk research defines a proposal; it does not substitute for travelers. Recruit solo travelers, couples, a group organizer, a parent, an older traveler, and someone with mobility or sensory access needs. Include travelers with limited data and different passport nationalities. Observe an actual recent itinerary, tools used, lost context, preparation, and changes. Do not require disclosure of passport numbers or medical records. Run prototype tasks before production code. Record task success, time, hesitation, and misunderstood labels; revise navigation if the evidence contradicts this proposal.

## 3. People, trip types, and scope

### 3.1 Supported contexts

| Context | Concrete differences the app must handle |
| --- | --- |
| Solo tourist | Private itinerary, personal safety contacts, solo dining choices, easy share of selected plans with someone at home |
| Couple/family | Different ticket ages, rooms/bed needs, child breaks, custody-document reminders where applicable, stroller access, each person's packing |
| Group | Organizer/editor/viewer roles, proposals/voting, attendance per activity, different flights, expense shares and partial settlements |
| Domestic trip | Hide irrelevant border readiness; keep transport, weather, packing, lodging, driving, and return-home tasks |
| International/multi-country | Per-stop rules, transit requirements, zones/currencies, languages, connectivity, plugs, customs/return checks |
| Road trip | Vehicle/rental details, driver eligibility reminders, fuel/charging stops, parking, tolls, luggage/storage, one-way rental conditions |
| Rail/bus/ferry travel | Stations/ports, platforms if available, seat/carriage, check-in/boarding conditions, tickets, transfers, timetable versus live status |
| Cruise | Port days, ship and meeting point, ship time versus local time, tender availability when sourced, all-aboard deadline, documents and excursion buffers |
| Outdoor/adventure | Weather sensitivity, equipment, route download, permits, physical demands, daylight, limited coverage; no promise of rescue or verified trail safety |
| Access/dietary needs | Traveler-entered limits, evidence-labeled place suitability, step-free routing where supported, menu/contact checks, rest and toilet stops |
| Long trip | Laundry, refills/reminders, multiple bookings/currencies, itinerary pagination, storage management, flexible dates |

### 3.2 Explicit service boundaries

We will organize travel and integrate authorized services. We will not pretend to be an airline, embassy, clinician, bank, emergency dispatcher, or every local transport operator. The app will identify who sells/services a booking. A manual record remains “saved manually”; an imported confirmation remains “imported,” with its source; only a provider-verified transaction receives a confirmed status.

Payments, cancellations, sending invitations, sharing precise location, and sensitive uploads remain deliberate user actions with clear recipients and consequences. AI is optional assistance, not the authority for entry rules, prices, opening hours, safety, or purchases.

## 4. New information architecture

### 4.1 Account-level entry

The signed-out product explains the actual value and offers **Start a trip** and **Sign in**. No oversized promotion blocks the task. A new person can create a private local draft; require an account when saving to the cloud, sharing, or synchronizing. The guest draft and account trip need an explicit, recoverable migration flow.

The signed-in home is **My trips**: active trip first, upcoming trips, drafts, past trips, and Create trip. Global discovery exists for someone who has not chosen a destination, but is not forced on someone with a flight already booked. Profile/settings live in the account control, outside a travel day's main content.

### 4.2 Inside a trip: four stable destinations

This proposal replaces the previous five-tab dashboard.

| Destination | Its specific purpose and contents |
| --- | --- |
| **Trip** | Contextual overview: next commitment or next preparation action, essential alerts, booking/ticket shortcuts, today/next travel day, readiness, offline state, return-home wrap-up |
| **Plan** | Multi-stop trip outline; daily timeline; travel between stops; unscheduled ideas; linked reservations; route/time checks; compare and apply proposed changes |
| **Explore** | Search around a destination, current day, or chosen map area; attractions, food, neighborhoods, practical places; evidence-based filters; details; save or insert into a day |
| **Essentials** | Explicit index of Reservations, Tickets & documents, Readiness, Packing, Money, Language & connectivity, and Destination basics. Each opens a specified full screen below; no generic “coming later” utility grid. |

Help is a consistently labeled control in the trip header and Essentials, and urgent relevant help appears in Trip. Search is global. Trip switching is in the title control. Small contextual actions—Add stop in Plan, Add expense in Money, Show ticket on a reservation—take precedence over an omnipresent floating Add button.

Why four? Keep the stable destinations few and meaningful, while placing less frequent resources under an explicit, searchable index. “Trip” adapts its contents without renaming navigation. This is a proposal to test, not an assumption that four labels alone solve usability.

### 4.3 Desktop arrangement

- Left: 216–240px navigation and trip switcher; the four main destinations; expanded Essentials links; Help at the bottom. Account control stays separate.
- Top: compact trip title, dates/stops, search, sharing state, and offline/sync indicator. No repeated marketing slogan.
- Plan center: day selector above the timeline; trip outline accessible without losing the selected day.
- Plan right: a real route map. Selecting a stop opens its inspector in the right pane; map/list toggles remain available. Do not squeeze timeline, map, and inspector into unreadably narrow columns.
- Explore: results alongside the map; selecting a result opens details without losing the query, scroll position, or itinerary context.
- Essentials: labeled resource navigation and the selected resource screen. Tables are used for reservations/expenses where rows compare more clearly than cards.

### 4.4 Phone arrangement

- Compact trip header, back/trip-switch control, Search, and Help; four labeled bottom destinations.
- Trip opens with the next usable action within the first screen. No large greeting, hero, decorative illustration, or sample-map space above essentials.
- Plan uses one timeline column; a list/map segmented control changes the content area. The day/date stays visible. A place inspector is a bottom sheet or full detail screen depending on length.
- Explore preserves the search/filter row and result context. Result details offer Save and Add to day near the thumb; adding requires a destination day, not a hidden default.
- Essentials shows an ordered list with labels and useful state: “Tickets: 4 saved,” “Packing: 12 left,” “Offline: 2 files missing.” These are actual computed states.
- Short capture uses a sheet; long booking/passenger/document workflows use a full screen with progress and Back. Keyboard-safe forms keep Save visible without covering the edited field.

Tablet uses two panes when both remain readable. Landscape phone keeps essential access and does not require desktop precision.

## 5. First trip: exact flow

### 5.1 Three starting paths

**I know where I am going:** Start a trip → destination(s) → dates or flexible range → private draft → organizer workspace.  
**I already booked something:** Start a trip → Import booking/manual capture → review parsed place/dates/travelers → create a trip or attach to an existing one → linked commitment.  
**Help me choose:** destination brief (departure area, date range/month, duration, approximate budget, interests) → small comparable shortlist → destination detail → choose → trip draft. Seasonal averages must be labeled historical, not forecasts.

### 5.2 Required information

First step: searchable destination; “Add another stop”; date range with “Dates not decided”; trip title generated from destination but editable. If the traveler does not know dates, store duration or month as a constraint, not fabricated exact dates.

Second step is optional: traveler count, rough budget and display currency, pace (relaxed/balanced/busy), and three interest choices. Provide Skip. Constraints such as step-free access or food restrictions are optional, editable, and never inferred from age or identity. Ask nationality/residence only when opening personalized entry readiness; do not ask for passport numbers during general trip creation.

Persist the draft after each meaningful step. Back does not lose work. No mandatory account/profile tutorial before a useful draft appears. Account creation/sign-in returns to the exact draft without duplicates.

### 5.3 The first workspace

For an empty dated trip, show the outline with arrival and departure **unplanned**, not fake reservations. Offer three precise next actions: Import a booking, Choose where to stay, and Add a place. Show a compact budget estimate only if assumptions are available and labeled. Keep unscheduled ideas visible.

For an imported trip, show booked legs/stays in order, highlight ambiguous dates/locations, and offer Fill the gaps. Create arrival/departure/check-in timeline entries from reviewed records; distinguish a check-in window from an appointment.

### 5.4 Building the first useful day

1. Search a place or choose an idea. Show why it fits the requested interests/location.
2. Open details: where it is, duration estimate, hours/source, cost/source, booking need, suitability evidence, and transport from the preceding stop.
3. Save to ideas or choose Add to day. Day picker shows destination/date and remaining flexible time. Time defaults to flexible unless the traveler selects a ticketed slot.
4. Preview the placement and conflicts. A fixed reservation is not moved by the app. Offer a better slot or another day with an explanation.
5. Confirm insertion. Preserve the search context and show the destination day with an Undo action.
6. Add a meal/rest stop and return-to-stay leg if desired. The itinerary always allows unscheduled space.

### 5.5 Before departure

The Trip overview gradually surfaces upcoming deadlines and unresolved essentials. Offer Download trip for offline use with a manifest. Show exactly what succeeded: plans, addresses, reservation references, selected documents, phrase pack, and native map region. Preparation progress is based only on applicable tasks; unknowns remain unknown.

### 5.6 Travel and return

Lifecycle suggestions come from trip dates/commitments, but the user can override them. Do not replace the travel day on a device simply because its home zone crossed midnight. Arrival and return flows connect the final transport to the stay/home address. After the trip, offer settle expenses, claims/reminders, archive/export, and private memories; do not auto-post.

## 6. Screen-by-screen layouts

Every screen below needs loading, empty, validation, success, offline, stale-data, and permission-denied states where applicable. App-only destructive actions support soft deletion and Undo; a booking cancellation has a separate reviewed provider transaction.

| Screen | Content order and exact actions |
| --- | --- |
| My trips | Active/upcoming/draft/past groups; Create; search; trip summary with dates/destinations; open/archive/duplicate/export; guest migration state |
| Trip creation | Starting path; destination and dates; optional traveler brief; draft confirmation; reviewed import alternative; step count and Back |
| Destination comparison | Up to a few saved candidates; season/history, transit effort, sourced cost assumptions, major constraints, interests; compare/select/remove |
| Trip overview — preparing | Closest real deadline; booked-versus-missing travel/stay summary; three priority tasks; outline; offline readiness; direct reservation access |
| Trip overview — traveling | Date/location/zone; important alert; next commitment with address and ticket; travel-to-next; subsequent plans; find food/toilet/return-to-stay; quick expense |
| Trip overview — returned | Outstanding balances/tasks, claims deadlines from saved terms, trip records, export/archive; no urgent travel alert noise |
| Trip outline | Stops with nights and travel legs between them; arrival/departure; missing nights or overlaps; add/reorder stop; change dates with impact review |
| Day plan | Date/day picker; fixed commitments; flexible items; transport connectors; breaks; unscheduled ideas; add/move/reorder; map switch; conflicts with alternatives |
| Place detail | Name/native name, real photo where licensed, map/address, hours and exceptions, duration/cost evidence, tickets, suitability, nearby practical options; Save/Add/Route |
| Explore results | Location context, query, category and selected filters, sortable results/map; distance/travel time distinction; empty/no-coverage alternatives |
| Reservation list | Upcoming first; category/date/status filters; provider/manual source; unpaid/cancellation deadlines; import/manual add; search reference |
| Flight/rail/coach/ferry detail | Per-leg origin/destination/local dates/zones, operator, reference, traveler/seat, baggage, station/terminal/platform if sourced; ticket, check-in handoff, live status, service/change actions |
| Stay detail | Address/native address, phone, dates, check-in/out windows, room/occupancy, instructions, deposit/taxes, cancellation deadline, accessibility evidence; route/call/document |
| Activity/meal booking detail | Slot and arrival buffer, meeting point, attendees, ticket, conditions, dress/equipment notes, contact; route, reschedule/cancel supported-provider flow |
| Tickets & documents | Search/type/traveler/reservation filters; expiration/download state; private vs shared; import/upload; unlocked viewer; share/export/delete with scope |
| Readiness | Due soon first; grouped destination/traveler/home/return tasks; applicable/unknown/complete/not applicable states; source link, deadline, assignee, reminder |
| Packing | Person and bag views; item quantities/category; packed/needed-to-buy; conditions/context; reusable templates; repack for return; quick check without opening an editor |
| Money | Budget, paid/committed/estimated totals separately; original/base currency; expenses, splits, balances; receipt; add/edit; review rates; export; record settlement |
| Language | Two languages, saved phrase categories, text input/output, large “show someone” card, audio availability, camera translation workflow, favorite/download |
| Connectivity | Device compatibility checklist, package terms, destination coverage, data/voice/SMS distinctions, purchase handoff/integration, installation instructions, usage/support |
| Destination basics | Currency/payment practices, plugs, time/weather, etiquette, laws/customs links, practical contacts, source dates; no undated universal advice |
| Help | Current location manual override; emergency numbers verified by jurisdiction; insurer/embassy/provider/emergency contacts; issue-specific guided next steps; offline limitations |
| Offline manager | Download manifest, map region/size, file protection, progress/resume, freshness, queued edits, storage use, remove downloaded copies |
| Group | Members/roles, invite scope/expiry, traveler attendance, comments/proposals/votes, change history, leave/remove; private documents excluded by default |
| Notifications | Actionable grouped events, changed detail before/after, source/time, read state, settings; duplicate suppression; no simulated “live” state |
| Preferences/account | Language/units/currency, needs, notification/location permissions, privacy/export/deletion, devices/sessions, provider connections, subscription and support |

**Trip overview priority rule:** operational alert affecting a commitment → current/next travel action → near deadline → planned next activity → optional discovery. At most one prominent alert and one primary next action. An unread marketing item never outranks a ticket or disruption.

**Reservation detail navigation:** open from timeline, search, overview, or Essentials to the same object. Back returns to the source context. A booking reference is copyable; a ticket opens directly, not after a provider promotional page.

## 7. Detailed capability specifications

### Reading the specification

Each requirement is identified, located, assigned an implementation method and milestone, and given a completion check. Milestones M0–M9 are defined in section 15. “Provider” always includes commercial rights, coverage tests, stale/error handling, and attribution; it is not a placeholder promise. Custom forms handle missing inventory without inventing facts.

### 7.1 Choosing and organizing a trip

| ID | Traveler need and exact behavior | Implementation and completion test |
| --- | --- | --- |
| C01 | Start with exact, flexible, or unknown dates; multiple places; a rough duration; notes about what the trip is for | M2: TripBrief stores constraints separately from dated Stop records. Test switching from flexible to exact dates without losing ideas or inventing flights. |
| C02 | Compare destinations by effort, interests, seasonal conditions, and rough cost; save a shortlist | M7: evidence cards combine licensed geographic data, historical climate, transport availability and sourced cost ranges; expose assumptions. Test different departure areas and missing pricing; unknown must not become cheap/free. |
| C03 | Define traveler count, pace, interests, daily start/end preferences, budget, mobility/food needs, and must-see places | M2/M4: optional structured Preferences with trip overrides and visibility controls. Test one traveler choosing a slower pace and group activities with different attendance. |
| C04 | Multi-city outline with nights, stop order, travel days, and arrival/departure; split or extend a stay | M2: Stop and TravelLeg model, date-range impact preview. Test overlapping lodging, a missing night, overnight trains, and extending one stop without silently shifting booked legs. |
| C05 | Make a list of ideas without scheduling everything | M2: SavedIdea links to Place or free-text concept, tags, priority and optional destination. Test no-date idea later assigned to a real day. |
| C06 | Shared plans, private trips, selectively shared read-only access for someone at home | M3: membership roles, expiring links, invitation acceptance, audit events. Test revocation, viewer write denial, and private files never exposed by a trip link. |

### 7.2 Getting there and getting home

| ID | Traveler need and exact behavior | Implementation and completion test |
| --- | --- | --- |
| T01 | Door-to-door travel: home → airport/station → legs/transfers → stay, and the reverse journey | M2/M4: Journey chain with address, transport choice, luggage/buffer assumptions and fallback. Test an itinerary that ends at the home pickup destination rather than at baggage claim. |
| T02 | Save flight details: carrier/operating carrier, flight/date, airports, terminals, references, seats, baggage, fare conditions, check-in link | M4: normalized AirReservation and legs; reviewed import/manual entry. Test codeshare, multiple passengers/references, overnight arrival, and absent terminal info. |
| T03 | See scheduled/estimated/actual flight times, cancellations, gate changes, and source freshness | M6: FlightAware commercial adapter with leg matching, event IDs, webhook/poll reconciliation. Test gate unknown, delayed feed, duplicate event, cancellation, and loss of provider access. |
| T04 | Know when to leave, including ground travel, chosen buffer, baggage/check-in deadlines, and uncertainty | M6: backward scheduling from saved/sourced deadlines plus route estimate and traveler-selected buffer; explanation shown. Test traffic increase and unavailable route; never guarantee gate arrival. |
| T05 | Connections: terminal/platform, transfer walking/transit time, border/security uncertainty, separate-ticket baggage implications | M4/M6: connection record and evidence-based warnings; airport maps only where licensed. Test separate tickets, self-transfer, overnight airport, change in arrival terminal, and incomplete airport data. |
| T06 | Rail, intercity coach, ferry: station/port, entrance, service number, carriage/seat, boarding rules, ticket and connections | M4: mode-specific ReservationLeg fields; M5 agency schedule/routing; M6 live feeds where available. Test reused service numbers, overnight service, canceled timetable entry, unknown platform. |
| T07 | Rental/road trip: pickup/drop-off, vehicle type, drivers, deposit, fuel/charge policy, mileage, toll/parking, charging stop constraints | M4/M7: RentalReservation; route waypoints and EV-range inputs; sourced charging info when available. Test one-way fees, closed pickup desk, charger availability unknown, and range estimate uncertainty. |
| T08 | Cruise/port days: embarkation, ship/local time distinction, port transfer, excursion, all-aboard deadline | M4: cruise legs and per-event zone/deadline. Test destination and ship time mismatch; never infer return deadline from a generic sailing schedule. |
| T09 | Airport/station practical needs: food, toilets, lounges, charging, lockers, meeting points, luggage storage | M5/M7: practical POI categories plus curated/operator-sourced terminal resources. Test pre-/post-security distinction where known; missing data labeled rather than guessing a usable route. |
| T10 | Check-in, mobile boarding pass, identity check, baggage claim and bag problem records | M4/M6: link operator app/web where unavoidable, import ticket, save bag claim/reference/photo as private record, attach contacts/claim deadlines. Test operator check-in handoff and manual return-to-trip capture. |

### 7.3 Staying and making realistic days

| ID | Traveler need and exact behavior | Implementation and completion test |
| --- | --- | --- |
| S01 | Compare stays by location in the plan, total price, occupancy/rooms, cancellation, access needs and transport | M7: Booking.com/Duffel approved inventory adapter, quote freshness and room conditions; map/day travel comparisons. Test per-night versus total taxes/fees and unavailable accessible-room evidence. |
| S02 | Retrieve stay address in local script, directions, phone, arrival instructions, check-in/out, luggage storage and deposit | M4: StayReservation with separate public/private instructions and timezone windows. Test late arrival, multiple rooms, checkout travel day, and no internet outside the hotel. |
| S03 | Schedule a attraction visit, timed ticket, tour, meal, event or appointment with realistic duration and meeting/arrival time | M2/M4: ItineraryItem has fixed/flexible/window time, duration source, attendees, reservation/document links. Test a timed ticket that route optimization cannot move. |
| S04 | Detect overlaps, impossible transport gaps, closed dates, reservation deadlines and unrealistic density | M5: deterministic constraint checker with sourced hours and route estimates; show severity/evidence and proposed repair. Test holiday closure, missing hours, a lunch break, and cross-zone arrival; no “valid” claim when inputs are unknown. |
| S05 | Optimize a day while respecting must-sees, fixed bookings, weather preferences, walking limit, breaks and stay start/end | M5: route matrix plus constrained heuristic; bounded worker/server job; before/after preview and Undo. Test preserving all locks; reject infeasible proposals and explain what constraint needs changing. |
| S06 | Move/reorder/copy items, alternate plans for rain, mark visited/skipped, record a change without losing booking data | M2/M5: fractional ordering, PlanRevision, variant days, soft-deletion/history. Test keyboard reordering, two editors, restore, and moving an activity across a trip stop boundary. |
| S07 | Find meals by cuisines, opening time, price level, reservation requirement, party size, dietary/accessibility evidence | M5/M7: supported POI fields and official menu/contact links; food suitability remains evidence, not certification. Test “vegetarian option unknown” and a restaurant whose kitchen closes before the building. |
| S08 | Build rest, breakfast, toilets, water, laundry, groceries, pharmacy and luggage storage into the day | M5: practical POI filters, personal notes and optional break rules. Test a traveler finding a toilet near the current route without first browsing sightseeing attractions. |
| S09 | Book experiences with slot, language, meeting point, inclusions/exclusions, cancellation cutoff, ticket and supplier contact | M7: approved GetYourGuide/Booking.com attraction integration; reprice and user review before purchase; transaction state machine. Test sold-out slot and retrieving ticket offline after provider webhook confirmation. |
| S10 | Special interests: beaches, museums, festivals, nightlife, parks, child activities, shopping, scenic stops | M5/M7: extensible taxonomy and editorial collections with dated sources and suitability facets. Test category results at different times without claiming every venue has live event inventory. |

### 7.4 Preparation at home and travel readiness

These are task-organizing specifications, not medical/legal instructions. Source results must be individualized and timestamped.

| ID | Traveler need and exact behavior | Implementation and completion test |
| --- | --- | --- |
| P01 | Passport validity, nationality/residence, entry/exit/transit visa or authorization, processing deadlines, required proof | M4: requirements query model and IATA Timatic commercial evaluation; official embassy/border sources when contract/coverage is unavailable. Test different nationalities, transit-only stop, and unresolved result; no universal six-month rule. |
| P02 | Dependents: child consent/custody reminders, each person's documents/tickets, age-specific ticket/room needs | M4: dependent profile with guardian-managed private fields and per-traveler readiness. Test two adults with different document readiness and no child account requirement. |
| P03 | Health preparations: clinician consultation task, official destination health guidance, medicine legality/source links, prescriptions, allergies card, supplies | M4: user-entered reminders and private assistance card; official health/embassy sources. Test share scope and offline viewing; no generated dosage, diagnosis or “safe to take” conclusion. |
| P04 | Insurance: policy reference, covered dates, insurer assistance contacts, declared exclusions/terms, claim evidence checklist | M4: policy document/metadata and user-reviewed terms. Test phone assistance offline and attaching receipts to a claim record; no invented coverage guarantee. |
| P05 | Connectivity: destination service plan, roaming choice, compatible unlocked/eSIM device checks, activation trigger, Wi-Fi alternative | M4/M7: readiness tasks plus connectivity package model and partner service. Test data-only package clearly lacking calls/SMS; installation may require system controls. |
| P06 | Money readiness: display/local currency, user reminders for cards/cash/fees, emergency funds, payment practices from sources | M4: sourced destination basics and user checklist; no bank passwords/card-number vault. Test currency changes and a cash-only venue label whose evidence is stale. |
| P07 | Packing matched to length, weather scenario, laundry, activities, plugs, baggage and traveler/bag | M4: transparent packing rules, quantities, reusable lists, purchase/packed states; baggage terms linked to booking. Test warm/cold stops, carry-on constraints, multiple people and return repacking. |
| P08 | Home preparation: pet/plant care, deliveries, keys, appliance/lock check, house sitter, home transport and calendar reminders | M4: opt-in templates with assignee/deadline/private notes. Test household tasks hidden from a read-only trip audience and preparation reminders in home timezone. |
| P09 | Reservations/permits to secure in advance, opening-booking windows, cancellation deadlines, accessibility confirmation | M4/M5: deadline Task linked to reservation/place, source and trigger. Test ticket-sale timezone, configurable reminder, and expired deadline retained in history. |
| P10 | Download and verify trip before leaving: itinerary, references, addresses, tickets, contacts, phrase packs, native map region | M3/M4/M5: offline manifest and verification screen. Test with network disabled, revoked file, incomplete download and insufficient storage; never label partial content fully ready. |

### 7.5 Practical destination use

| ID | Traveler need and exact behavior | Implementation and completion test |
| --- | --- | --- |
| D01 | Walking/driving/cycling/transit routes, duration, transfers, steps, cost when sourced, last service and fallback | M5: provider adapters with mode capabilities; use transit feeds/routing engine where coverage exists. Test step-free request with unsupported data and last-train warning from an actual timetable. |
| D02 | Local transport: ticket types, pass validity/coverage, airport exceptions, pickup points, transit payment rules, rideshare/taxi booking | M5/M7: operator-sourced fare/pass resources and supported checkout/deep links with saved return context. Test estimated versus actual fare; no universal in-app dispatch without operator integration. |
| D03 | Get back to stay; show a driver the native address; call accommodation; share a meeting location selectively | M4/M5: pinned stay and local-language address card; route/call/share actions. Test no location permission (manual origin), offline address, and consent before precise location transmission. |
| D04 | Translation: typed text, saved phrases, audio, “show someone” mode, camera text review, offline phrase pack | M7: Cloud Translation online, OCR pipeline, platform speech; downloadable curated phrases; evaluate per-platform offline translation separately. Test no network and unsupported voice/language; never label phrase pack full offline translation. |
| D05 | Weather now/hourly for imminent days; weather-sensitive itinerary alternatives; historical seasonal context for distant trips | M6: Open-Meteo commercial adapter, forecast range validation, source/update times. Test future date outside forecast horizon, rain fallback and stale/offline result. |
| D06 | Etiquette, plugs/voltage, tipping, business customs, holidays, local laws, emergency/transport contacts | M4/M7: editorial DestinationGuide with jurisdiction/source/review date, corrections workflow. Test location-specific applicability and no fabricated universal customs guidance. |
| D07 | Accessibility: step-free entrances/routes, lifts, surfaces, toilet access, hearing/vision details, service animals where sourced | M5/M7: structured source-specific evidence; unknown facet distinct from no; direct confirm-with-venue action. Test conflicting sources and a failed elevator live feed. |
| D08 | Manage luggage, late checkout, lockers, lost items, venue dress rules, attraction queues and ticket windows | M4/M5/M7: notes, POI resources, supported supplier data; queue estimates only if a real source exists. Test a locker result with size/hour info missing. |
| D09 | Offline useful view when lost/no signal: current downloaded area, stay, nearby saved places, contacts, plan and known route notes | M3/M5: last location with age/accuracy, downloaded region, own saved waypoints; explicit offline capability labels. Test outside downloaded region and no GPS fix. |

### 7.6 Money and group coordination

| ID | Traveler need and exact behavior | Implementation and completion test |
| --- | --- | --- |
| F01 | Planned budget versus committed bookings versus paid expenses; categories and per-day estimates | M2/M4: integer minor units, separate estimates/commitments/payments, linkage avoids double-counting a paid booking. Test deposits, partial refunds, changed booking quote and zero-decimal currency. |
| F02 | Fast expense: amount, currency, purpose/date; optional payer, shares, receipt, linked reservation and notes | M4: last-used defaults, append mutation, offline queue; OCR proposed extraction with review. Test entry in a few fields and retry without duplicates. |
| F03 | Multiple currencies with original amount, conversion rate/date/source, base amount and manual override | M4: rate snapshot per expense, exact decimal math and deterministic rounding; provider evaluation or entered rate. Test changing display currency without rewriting original transactions. |
| F04 | Group splits: equal/custom amounts/percentages, different participants, paid-by, partial settlements and disputes | M4: balanced ledger; immutable settlement entries with corrections. Test sum of shares, rounding residual, member departure and two people paying different portions. |
| F05 | Receipts, refund/claim records, export, travel spending archive | M4/M8: private files, expense linkage, CSV/PDF exports and claim tasks. Test redacted group export and policy-limited file sharing. |
| G01 | Plan together: suggestions/votes/comments, owner/editor/viewer rights, changed-item notification and history | M3/M4: proposal objects and membership checks; comments attached to items, not a new general chat app. Test accepting a proposal into the plan once and a simultaneous conflicting edit. |
| G02 | Members on separate flights/days, shared only part of trip, meet-up point/time and attendance | M4: itinerary scope/attendees and traveler-specific legs. Test group next-action card not showing another member's irrelevant flight. |
| G03 | Optional temporary live location and check-in status with clear expiry, audience and stop button | M8: separate location service, consent and retention/accuracy state. Test revoked member, expired share, poor GPS, killed app and manual check-in; never imply constant tracking or emergency rescue. |

### 7.7 Disruptions and return home

| ID | Traveler need and exact behavior | Implementation and completion test |
| --- | --- | --- |
| H01 | Delay/cancellation impacts: downstream connection, stay arrival, booked attraction, ground pickup | M6: dependency graph calculates affected items; explain changes and offer a reviewed alternate plan. Test no silent cancellation/move and preserving original commitments. |
| H02 | Alternatives: earlier/later transport, different route, overnight stay, contact operator or insurer | M6/M7: sourced options with availability/price timestamp; provider support contacts and specific handoff. Test stale quote and separate-ticket case; no guaranteed compensation. |
| H03 | Lost passport/wallet/phone/ticket: retrieve contacts/copies, mark records lost, find official assistance and record issue | M4/M8: issue checklists by jurisdiction, private document recovery, session revocation/support. Test help from another device and no access to another member's private identity copy. |
| H04 | Illness/injury/emergency: local verified number, insurer assistance, local language address and user medical contact card | M4/M8: curated verification process and offline subset; nearby facilities show evidence/unknown availability. Test manual location selection; no emergency button silently calling or dispatching. |
| H05 | Theft/scam/lost baggage/unsafe weather: source-specific assistance, report references, evidence, reminders and alternatives | M6/M8: issue records, operator/authority resources and alert provenance. Test false/stale alert correction and low-connectivity retrieval. |
| R01 | Checkout/packing, airport transfer, departure deadlines, unused passes, baggage and final tickets | M4/M6: return readiness linked to final legs, reminders and packing-reset review. Test return path surfaced before the last day rather than only after arrival. |
| R02 | Transit and home-entry/customs reminders, declarations/duty/tax-refund information from applicable authorities | M4/M7: traveler/itinerary-specific task and source links; receipt checklist for VAT where applicable. Test returning to a residence different from passport nationality; no generated customs eligibility advice. |
| R03 | Arrival home: final transport, home arrangements, balances, cancellations/refunds, insurance claims and receipts | M4/M8: return chain plus outstanding-item summary and user-owned deadlines. Test past trip still exposes pending claim and settlement. |
| R04 | Preserve memories and useful knowledge; duplicate itinerary, private journal/photos, visited places, export/archive | M8: private journal/storage, selective export, reusable template removing expired bookings. Test duplication excludes ticket/barcode/identity and old live status. |

### 7.8 Search, capture and assistance

| ID | Traveler need and exact behavior | Implementation and completion test |
| --- | --- | --- |
| U01 | Search references, names, addresses, notes, dates, expenses, tickets and member-visible resources | M2/M4: local index plus scoped server search; grouping by object; direct result opens details. Test accents/local script, offline query and authorization filtering before returning snippets. |
| U02 | Import via forwarded email, file upload, screenshot/PDF, share sheet or manual capture; review before applying | M4: ingestion queue, parse/OCR, duplicate fingerprint, confidence by field, traveler/date reconciliation. Test ambiguous date, changed confirmation, ticket QR image, malicious attachment and retry. |
| U03 | Optional connected mailbox import; unlink/revoke; never ask for broad email access just to start planning | M8: least-scope OAuth, provider verification and deletion policy; manual forwarding remains supported. Test revoked refresh token and importing only user-authorized travel content. |
| U04 | Calendar and reminders: fixed commitments in local times, exports, task deadlines, no duplicate events | M4/M6: opt-in calendar integration, stable event IDs and update policy; downloaded local reminders. Test DST/zone changes and calendar permission refusal. |
| U05 | Optional assistant: propose day changes, answer from trip records, summarize terms with source links | M8: read-first tool orchestration, scoped retrieval, constrained outputs and human review before mutations. Test invented availability, prompt injection in email, secret data exposure, and deterministic alternative when AI is unavailable. |
| U06 | Import/export existing trip data and account portability; accessible print/PDF backup | M2/M8: versioned export schema and reviewed importer; text itinerary with contacts/references; private info redacted by default. Test large trip and another device opening the backup offline. |

## 8. A complete example journey

**Scenario:** two adults travel from home to Tokyo and Kyoto, then return; one prefers limited walking; they use different payment currencies. Times/prices in the prototype will be illustrative, not live facts.

1. Start with Tokyo/Kyoto and date range. A two-stop outline appears. Set balanced pace and a walking constraint; no profile questionnaire blocks creation.
2. Import flights and both stays. Review outbound/return local dates, addresses and travelers. The outline reveals the intercity journey is missing.
3. Add the rail leg. Each stay anchors its day start/end. A connection buffer appears with its basis, not an unexplained warning.
4. Save several interests. Build an arrival day with hotel/luggage logistics, one nearby outing, dinner and rest. The planner respects the fixed arrival and timed ticket.
5. Open a day proposal. See added travel and walking totals and explicit unknown opening hours. Accept a subset; the original plan is available to restore.
6. Readiness requests nationality/residence only for relevant entry queries; records source/results as tasks. Home care, insurance contacts, connectivity and packing have assignees/dates.
7. Before leaving, download the trip. A missing ticket file prevents a fully-ready badge. Download/resume and run an offline retrieval test.
8. Departure morning, Trip shows home pickup and the outbound ticket. Check-in goes to the operator if necessary, then returns to the saved flight record. Delays update affected plans only with clear source timestamps.
9. At arrival with weak data, show the stay's local-language address and downloaded instructions; live transit updates say unavailable. The user can still retrieve booked references.
10. Explore nearby lunch and a toilet using the day's area, not an arbitrary city-wide popularity list. A restaurant's allergy suitability is unknown until confirmed.
11. Log an expense in yen, paid by one adult, split across both. Keep original amount and saved rate; no exchange-rate change rewrites the debt.
12. Rain affects a walking plan. Preview an indoor alternative; keep the timed ticket unchanged. If it cannot fit, show the conflict and relevant supplier contact.
13. Transfer day shows rail ticket, station entrance, platform if sourced, Kyoto address and check-in information together.
14. The final day includes checkout, baggage/storage, airport transport and return readiness. After landing, retrieve home transport and home arrangements.
15. At home, reconcile outstanding costs, save a claim deadline/receipt, archive the itinerary and create a reusable trip template without expired tickets.

Additional test narratives: domestic weekend with no account; family with a child and private documents; group with staggered flights; EV road trip; traveler in a wheelchair with incomplete route data; missed self-transfer; cruise ship/local timezone mismatch; lost phone; provider outage; storage exhausted before download.

## 9. Visual and interaction redesign

### 9.1 New direction

Use an understated travel workspace: neutral surfaces, strong typography, clear timeline structure, real contextual maps, and restrained destination photography where it helps recognize a place. Discard the current green dashboard styling, decorative route sketch, repeated slogans, small metadata, nested cards, and feature-preview banners as product language.

Proposed foundation: white and cool-neutral light surfaces; near-black text; one deep blue interactive accent; amber for attention and red for destructive/error states. Colors are proposals and must pass contrast checks in actual states. Dark mode uses its own contrast-checked tokens. Brand expression belongs in destination imagery and typography; operational screens prioritize clarity.

### 9.2 Concrete layout rules

- Desktop page titles 24–28px; phone titles 22–26px; body/input text 16px; secondary text 14px; compact metadata normally at least 12px. No 8–10px text for useful information.
- One system/native font stack for operational UI; no blocking font dependency. Normal line heights and adequate weight/contrast for outdoor use.
- 4px base spacing; commonly 8/12/16/24/32px. Related fields grouped by meaning, with clear section boundaries.
- Controls generally at least 44px touch targets on iOS/web touch and 48dp on Android; sufficiently separated. Native scale units stay platform-specific.
- Native-safe bottom navigation and forms. No floating button overlaps a ticket, timeline entry, keyboard, or focus target.
- Controls 8–12px radius; panels 12–16px; restrained borders; shadows only to communicate elevation. Avoid a card around every line.
- Desktop tables for comparisons and expenses; timeline rows for plans; phone detail hierarchy instead of compressing tables.
- Use one outline icon system with labels for unfamiliar actions. Color/icon alone never conveys status.
- Decorative photos absent from urgent/operational views; licensed place photos load lazily with sizes reserved.
- Main pane/inspector widths governed by content, not a hard rule of three columns. At narrow desktop sizes, reduce panes instead of shrinking type.

### 9.3 Interaction rules

Primary button says what will happen: Add to Tuesday, Save reservation, Review purchase, Download 6 files. Local action feedback is immediate; network status remains honest. Inline validation describes the fix and preserves input. Undo for reversible edits; a cancellation/deletion review names the exact consequence.

Search retains filters and scroll. Back returns to the prior context. Moving an item offers drag plus accessible Move controls. Date pickers include destination and timezone where ambiguity matters. Money shows currency codes when symbols could be confused. A reminder says which local clock it uses.

Request notifications/location/camera/document access only in the flow that needs it. Manual entry and manual location selection remain functional. Failure states offer a next action, not an indefinite spinner.

### 9.4 Accessibility and usability gate

WCAG 2.2 AA for web; VoiceOver and TalkBack tasks on native. Keyboard-only create trip, add/reorder a plan, retrieve ticket, enter expense, and dismiss dialogs. Test visible focus not hidden by sticky bars, screen-reader names, reduced motion, 200% text scaling, 320px web reflow and larger native accessibility text. Confirm both dark/light contrast; no hover-only action or mandatory gesture.

Prototype task targets: create a useful draft in about two minutes without help; retrieve a known booking reference in two actions from Trip; add a simple expense in under 15 seconds; discover and insert a stop without leaving the app. These are proposed success targets to test, not achieved claims.

## 10. Performance diagnosis and targets

### 10.1 Findings from read-only source inspection

The current `middleware.ts` awaits `supabase.auth.getUser()` and its matcher includes almost every app page, including `/preview`. A page navigation can therefore incur a remote auth request even though the sample workspace uses no real account. This is a plausible latency contributor, not a measured root cause.

The preview is a dynamic route that mounts one large client workspace, waits for browser-storage hydration, and writes the complete state to localStorage after changes. Navigation may remount/reload state. The current dev server also incurs development costs. [Next.js navigation documentation](https://nextjs.org/docs/app/getting-started/linking-and-navigating) describes production prefetch/streaming behavior; development timing should not be treated as production proof.

No performance changes or new benchmark runs were made for this planning request. “Slow” needs decomposition into first load, first visit to a route, subsequent navigation, input response, save response, provider search, and rendering large trips.

### 10.2 Diagnostic sequence after approval

1. Record cold/warm loads and navigation for a small and a large trip in a production-like review environment; separately record development compilation time.
2. Capture network waterfall and server timing: auth middleware, database query, server rendering, client chunks, hydration and provider waits.
3. Profile main-thread work, long tasks, component rerenders, storage parse/serialize and map initialization.
4. Repeat on real desktop Safari/Chrome, an older iPhone/Android, throttled network, and offline. No “fast” claim based only on a developer laptop.
5. Identify the largest cause; make one targeted change; retain before/after traces and run the same task again. Track regressions in CI and field monitoring.

### 10.3 Planned fixes, subject to measured confirmation

- Limit remote auth middleware to relevant protected/session routes while preserving verified authorization at server/data boundaries. Public and sample paths should not wait on unnecessary auth. Do not cache a user's authorization globally or weaken protected operations.
- Keep a persistent authenticated trip shell/store; changing sections should not reload the entire trip. Save selected day/filter/scroll in scoped view state.
- Serve useful initial shell/content without a full-client blank gate; authenticate/data-load once per relevant request boundary; stream secondary content.
- Use normalized indexed state and incremental IndexedDB/SQLite persistence, not full synchronous localStorage serialization.
- Split heavy sections and load maps, OCR viewers and assistant code on demand. Keep provider work out of the critical navigation path.
- Parallelize independent API/database reads; eliminate duplicate requests; index queries; use paged data for long trips.
- Debounce remote searches, cancel obsolete requests, cache only where permitted, request only fields needed by the current screen, and show results progressively.
- Virtualize long lists only when profiling warrants it and preserve accessible navigation. Avoid recreating large trees on a packing checkbox change.
- Reserve image/map sizes; compress/correctly size images; use lazy loading outside the initial viewport; avoid unnecessary animation/layout work.
- Use bounded retries/timeouts and useful cached/offline content; a provider outage must not block opening an existing itinerary.

### 10.4 Performance release budget

| Measurement | Proposed gate |
| --- | --- |
| Field web performance | p75 LCP ≤2.5s, INP ≤200ms, CLS ≤0.1, separately mobile/desktop |
| Cached section/day change | p95 useful content within 300ms on agreed test devices; no server dependency for downloaded data |
| Local capture/check action | visible response within 100ms target; explicit queued/saved state |
| Search | local results within 150ms target; remote loading state immediate; p95 first useful result ≤2s under agreed network/coverage |
| Native launch | downloaded trip usable within 2s target on agreed older devices; no network required |
| Downloaded reference/ticket | open within 500ms target after unlock; test realistic file sizes |
| Bundle/network | initial trip route application JS target ≤200KB compressed excluding lazy map/OCR/assistant; derive final budgets from measured baseline |
| Large dataset | 60-day, 500-item, 500-expense trip remains interactive; no full-screen wait on a small update |

These internal targets supplement Web Vitals; they are budgets to implement and validate, not existing measurements. Provider latency and file size are recorded separately from local UI latency.

## 11. Architecture and data model

### 11.1 Chosen direction

Next.js web client for desktop and responsive web; React Native/Expo clients for iOS/Android. Shared TypeScript domain/schema logic and tokens, separate platform view components. Use development builds when native SDKs are required; do not assume Expo Go validates the complete native product. [Expo's documentation](https://docs.expo.dev/) and [store-build guide](https://docs.expo.dev/deploy/build-project/) describe the native build path.

Supabase identity/PostgreSQL remains the proposed backend; add PostGIS if supported/configured for geographic queries, object storage, a versioned service API and background jobs. The UI redesign does not depend on preserving current implementation. Database ownership must be resolved before live deployment; local fixtures can validate contracts while administration is unavailable.

Proposed repository boundaries: `apps/web`, `apps/mobile`, `packages/domain`, `packages/contracts`, `packages/design-tokens`, `packages/sync`, `services/api`, and `services/workers`. Do not migrate directories merely to simulate progress; validate domain/contracts first, then move with working build gates.

### 11.2 Entity contracts

All mutable records: UUID, trip/scope ownership, created/updated timestamps, revision, soft-deletion tombstone, actor and synchronization status. Nullable values are unknown, not empty strings that imply a fact.

| Entity | Key fields and relations |
| --- | --- |
| User/Traveler | account identity separate from traveler/dependent record; locale, needs/preferences, visibility; private identity metadata in protected vault |
| Trip/Brief | title, lifecycle override, home/origin reference, date constraints/exact range, base currency, budget, membership, preferences, archive state |
| Stop | destination/place reference, sequence, local arrival/departure, nights, default zone, linked stays and travel legs |
| Day | destination/local calendar date, boundaries/pace, plan variant, notes; generated from stops without fabricating commitments |
| Place/ProviderFact | native/local names, coordinates, source IDs, addresses, category, field-level evidence, source/fetched/valid-until, attribution/license policy |
| SavedIdea | place/free-text link, notes, tags, priority, destination/day intent, saved-by |
| ItineraryItem | type, fixed/flexible/window timing, local zone and resolved instant where applicable, duration source, order, attendees, place/reservation links, completion status |
| TravelLeg/Connection | mode, origin/destination, schedule/actual estimates, operator/service IDs, timezone per endpoint, seat/baggage, linked reservation, buffers and separate-ticket flags |
| Reservation/Offer/Order | type, seller/servicer, confirmation source/status, participants, references, quote total/currency/expiry, cancellation terms/deadline, payment/refund status, files and itinerary links |
| Task/Reminder | template origin, applies-to traveler/stop/item, state including unknown/not-applicable, deadline zone, owner, evidence, reminder preference |
| PackingItem/Bag | traveler, bag, quantity, packed/needed-to-buy, category, rule rationale, reusable template link |
| Document/Attachment | type, private owner, sharing grants, object storage ID, integrity hash, encrypted metadata policy, expiration, reservation link, downloaded state, quarantine status |
| Expense/Share/Settlement | original minor amount/currency, rate snapshot/base amount, date/zone, payer/participants, booking/payment link, receipt, refund/correction history |
| Comment/Proposal/Vote | target object and revision, author/membership scope, proposed change, resolution and applied revision |
| Alert/Issue | source event, severity/time, affected objects, acknowledgement, proposed repair, contact/evidence/claim details |
| SyncOperation/ChangeEvent | operation ID, entity/revision, payload diff, actor/device, causal base, delivery/retry state; per-trip change cursor |
| DownloadManifest | object/file/region revisions, bytes, rights/expiry, verification state, failure reason and last-success time |
| ProviderConnection | account/consent scopes, secure token references, coverage/configuration, access state, webhook registration; no secret client payloads |

### 11.3 Time, money, and constraints

Store travel legs as endpoint-local dates/zones plus resolved instants when known. Overnight/international-date-line journeys can have different local dates. Timed reservations with ambiguous DST need explicit offset/fold selection. Flexible days can exist without instants. Deadline zones belong to the supplier's policy, not automatically to the device.

Store money as exact integer minor units with ISO currency and safe bounds; rates use decimal precision and an immutable snapshot. Record refunds/deposits separately; do not count a saved booking total and its payment expense twice. A budget estimate is not a paid cost.

Plan validation reports hard conflicts, warnings and unknown checks separately. Accessibility/dietary suitability is field-level evidence, not a yes/no generated by an assistant. Route optimization respects fixed commitments and explicitly defined constraints; if impossible, return a reason, not an attractive impossible itinerary.

### 11.4 API and worker responsibilities

- Trip APIs: create/brief/update/stop management, memberships/invites, paged itinerary/expenses, proposals and audit history.
- Sync APIs: bootstrap snapshot, cursor-based changes, batch operations with operation IDs/base revisions, conflict results and revocation handling.
- Discovery APIs: scoped place search/details and route requests; enforce provider permissions, quota and attribution contracts.
- Import APIs: upload receipt, quarantine/parse job, review candidates, apply once, source purge and job status.
- Document APIs: protected manifest, access grant/revoke, signed short-lived download, export/delete; authorization checked per file.
- Commerce APIs: quote, revalidate, reviewed checkout, order status, cancellation/refund quote and explicit commit. Idempotency and reconciliation are mandatory.
- Workers: imports/OCR, provider status reconciliation, reminders, download preparation, currency/weather refresh where licensed, export/deletion jobs and support diagnostics.

Migrations are additive, tested and backed up. Existing prototype data is not automatically real customer data. Define a reviewed mapping before any legacy import; dates/fields that cannot be inferred are flagged for correction.

### 11.5 Operation states and exact validation rules

These are proposed shared contracts, with visible status names adapted to plain language in the UI:

| Object/workflow | States and important transitions |
| --- | --- |
| Trip draft | local draft → cloud migration pending → cloud saved; failed migration preserves local draft; archive is recoverable |
| Reservation record | tentative → saved manually/imported → verified where supported; changed/canceled/expired remain separate; matching a flight feed does not verify the purchase |
| Purchase | draft → priced → review → payment/order pending → confirmed; repricing returns to review; uncertain response → reconciling; retry reuses idempotency key |
| Cancellation | quote requested → fee/refund quote shown → user approves → supplier pending → canceled/refund pending → refund settled; denied/unknown states preserve original order |
| Import | received → quarantined → parsing → review required → applied/partially applied/rejected; a revised confirmation opens a diff, not a duplicate booking |
| Download | not selected → queued → downloading → verified; paused/failed/stale/removed separate; all mandatory manifest objects verified before ready |
| Edit | local saved → queued → syncing → server confirmed; rejected/conflict preserves editable draft and original server value |
| Requirement task | applicability unknown → action needed → traveler marked complete/not applicable; official result/source status recorded separately |
| Provider fact | current → stale → unavailable/expired; offline saved facts retain original timestamp; refresh does not fabricate confidence |
| Group proposal | proposed → accepted/rejected/withdrawn; accepting applies against a reviewed base revision once |

Validation defaults: trip title 1–120 characters; item/booking title 1–200; note 0–10,000; addresses 0–500; reference 0–200; no HTML execution. Dates use strict ISO calendar validation and cannot silently roll over. Airports/stations use provider identifiers plus readable labels; free-text alternatives stay explicitly unverified. Travelers can represent cities without coordinates until geocoded. File types and proposed size cap (20MB per ordinary document initially) are shown before upload; adjust caps through measured storage/usage review. Never truncate a ticket or original document silently.

A dated item must belong to its trip stop or explicitly represent the intervening travel day. A return leg can end at home outside destination stops. Date changes return an impact preview containing affected legs, stays, tickets, tasks, reminders, downloaded objects and expenses; fixed bookings are never silently rewritten. User-owned planned duration and provider-estimated route duration are distinct fields.

An expense requires amount/currency/purpose/date; payer and shares required only in a group ledger. Share totals must exactly match the expense. A reference-rate conversion needs original currency, base currency, decimal rate, rate date and source/manual status. Changing budget/base display does not rewrite historical original amounts. Refunds carry a link and sign convention rather than a negative accidental charge.

Reservation metadata can be incomplete; incompleteness is surfaced at the next relevant action. A flight identified only by number/date may be ambiguous: require selecting the matching origin/destination/operating leg before subscribing to live events. An imported booking can create multiple legs and linked timeline items in one transaction; it is not flattened into one day card.

### 11.6 Screen data and save contract examples

`GET /v1/trips/:id/overview` returns authorized trip/stop context, next commitment, actionable alerts, readiness summary and offline manifest revision. Large historical expenses/documents are not loaded here. `GET /v1/trips/:id/days/:date` returns ordered items, known connectors and explicit constraint results. `GET /v1/reservations/:id` returns mode-specific fields, permitted documents and support/source status, never another traveler's private identity fields.

`POST /v1/trips/:id/operations` accepts `{operation_id, entity_type, entity_id, base_revision, change}` entries and returns per-operation applied/rejected/conflict state, canonical revision and change cursor. Protect an entire multi-entity import or purchase linkage transactionally. `GET /v1/trips/:id/changes?after=cursor` pages authorized changes; cursor invalidation triggers a bounded resnapshot while retaining pending operations.

`POST /v1/imports` returns a job ID; `GET /v1/imports/:id/review` returns candidate fields with confidence/source and duplicate/change match; `POST /v1/imports/:id/apply` accepts reviewed selections and an operation ID. No import automatically sends messages, alters an existing purchase, or shares its source file.

A form with network-dependent save distinguishes “saved on this device,” “waiting to sync,” and “saved to your trip.” If a server rejects an edit, reopen its preserved values and explain the correction. No success toast substitutes for server confirmation. This contract is shared across phone and desktop; the presentation is platform-specific.

## 12. Offline, synchronization, and notifications

### 12.1 Offline contract

Native uses SQLite for normalized data and a protected file store for downloaded files. [Expo SQLite](https://docs.expo.dev/versions/latest/sdk/sqlite/) supplies a persistent database, not a synchronization engine. Web uses IndexedDB and a service worker for permitted app resources; browser quota/eviction and offline map capability are explicitly different from native. Credential storage and document encryption are separate concerns.

Offline available: downloaded plan, references, user-entered/safely licensed addresses and notes, contacts, selected tickets/files, packing/tasks/expenses, saved phrase pack and native map region within licensed scope. Offline unavailable: fresh live flight status, new marketplace quotes, unknown transit changes, arbitrary cloud translation and undownloaded/provider-restricted data. The UI says which is which.

Download flow: select trip/files/region → display estimated size and rights limits → fetch manifest → download with resumable verification → show per-item result → test retrieval. App never calls a region downloaded because only a style loaded. Remove downloaded copies is different from delete the trip.

### 12.2 Sync algorithm

Write an operation and local entity update transactionally; update UI immediately. Upload with stable operation IDs and base revision. Server authenticates, applies once or returns conflict, then writes a change event. Client pulls cursor-based changes, reconciles and retries with bounded backoff. Notifications/realtime prompt a pull; they are not the only source of truth.

Independent appends can merge. Packing completion is item-level. Concurrent edits of the same itinerary time or reservation field require conflict review; keep both versions. Deletes use tombstones and revocation-aware cleanup. Offline membership revocation takes effect on reconnect; do not promise remotely downloaded copies can be instantly erased while another device is offline.

Test account switching/sign-out clearing, offline device restart, clock skew, server reject, duplicate/reordered messages, long offline period, membership removal, and a revoked file already downloaded. Conflict resolution is a user-visible queue, not silent last-write-wins for critical commitments.

### 12.3 Notification rules

Local reminders for saved fixed commitments/tasks; server events for sourced changes. Ask permission only after the user requests reminders. Default notifications: changed commitment, chosen deadline, departure/check-in reminder, group edit requiring attention, incomplete requested download. No default promotional feed.

Deduplicate by event/version. Keep original/revised values and provider time. Quiet hours and trip zones are visible. Criticality does not imply access to platform emergency bypass privileges. In-app state remains correct if push fails or background execution is delayed. Never rely on continuous background execution for an essential offline view.

## 13. Provider and commercial implementation

### 13.1 Proposed provider decisions

These are my defaults, with specific validation gates. They are not claims of connected accounts or purchased access. If a gate fails, use the defined fallback and update supported coverage; do not leave an unlabeled dummy feature.

| Capability | Proposed primary route | Access/coverage gate and explicit fallback |
| --- | --- | --- |
| Maps/native offline | Mapbox web/native map stack; evaluate React Native bridge in development builds | Validate region download, SDK maintenance, attribution, telemetry/consent requirements, route needs and costs. Native offline region supported by official SDK docs; web offline is separately evaluated. Fallback: downloaded own itinerary/address/route notes, never a fake interactive map. |
| General POIs/practical places | Evaluate Geoapify for cache-compatible data with Mapbox | Validate actual per-product storage license, completeness, native names, hours/access fields and attribution. Geoapify's [Places API](https://www.geoapify.com/places-api/) supports POI queries; marketing claims alone are not license approval. Fallback: user-entered/curated official place records. |
| Rich ratings/photos | Google Places only in a compliant isolated integration if needed | Its attribution/display/caching terms are a hard design gate. Do not overlay Google POIs on a Mapbox map contrary to terms. If used, show a separate Google-backed map/detail experience or choose compatible licensed data. Do not scrape/copy reviews. |
| Road/walking route | Mapbox-supported routing; test supplied modes and access constraints | Coverage/estimated-duration accuracy tests by destination, mode, time. Fallback: distance plus manual route notes with estimate/unknown labeling. |
| Transit | Licensed agency/aggregator data; GTFS Schedule/Realtime with routing service for selected launch cities | [GTFS](https://gtfs.org/documentation/overview/) is a data specification, not a worldwide ready-made router or coverage guarantee. Validate each feed/license. Fallback: official operator journey planner handoff, saved tickets and user route notes. |
| Flight status | FlightAware AeroAPI commercial use tier | [AeroAPI](https://www.flightaware.com/commercial/aeroapi/) has commercial-tier/usage conditions. Validate gate/terminal/event coverage, leg identity and cost per tracked flight. Fallback: last known/manual schedule and airline status handoff. |
| Entry requirements | Evaluate licensed IATA Timatic service | [Timatic](https://www.iata.org/en/services/compliance/timatic/) provides travel requirement products; contract/query integration and context fields must be verified. Fallback: appropriate embassy/border official links plus unresolved readiness state. |
| Weather | Open-Meteo commercial subscription for production | [Commercial-use plan](https://open-meteo.com/en/pricing) rather than assuming free commercial use; validate model/horizon/attribution. Fallback: saved forecast with timestamp or no current forecast. |
| Flights/stays commerce | Duffel candidate for flights; Booking.com Demand candidate for stays/other supported inventory | Commercial onboarding, seller model, fulfillment/cancel/refund support, inventory and fees verified before launch. Fallback: reviewed import/manual capture and clearly attributed provider checkout return path. No auto-purchase. |
| Activities | GetYourGuide partner/API or approved Booking.com attraction access | [GetYourGuide API requirements](https://partner.getyourguide.support/hc/en-us/articles/13981133907613-API-integration-and-requirements) and inventory rights reviewed. Fallback: official venue/provider handoff plus import and linked ticket; no fake availability. |
| Restaurant reservations | Operator-approved integrations city by city | Availability, booking IDs, modifications, no-show terms and support gate. Fallback: official booking/contact handoff; capture confirmation back into trip. Never promise universal restaurant booking. |
| eSIM | Airalo Partner API candidate | [Airalo partner docs](https://developers.partners.airalo.com/) cover integration, subject to partnership and package terms. Test installation/activation, compatible device, data-only limits, usage/refund/support. Fallback: connectivity checklist and provider purchase handoff. |
| Translation | Cloud Translation online with OCR/platform speech; curated offline phrases | [Cloud Translation](https://docs.cloud.google.com/translate/docs/basic/translating-text) supports text translation. Verify processing/retention and language support; exclude private records unless explicitly requested. Fallback: downloaded phrases; unsupported audio/offline features clearly marked. |
| Currency | Evaluate licensed commercial FX feed with daily snapshots | Check base pairs, timestamp, historical rights, cost and redistribution; reference rates differ from card/cash execution. Fallback: user-entered rate with date/source; never silently apply a current estimate to past expenses. |
| Email import | Unique forwarding address + upload/share sheet first | Sender verification, injection/attachment isolation, parsing review. Mailbox connection only in M8 after [restricted-scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification) requirements are assessed; fallback remains forwarding. |
| Emergency/destination basics | Curated official national/local tourism, embassy, health and operator sources | Content owner, review/expiry schedule, jurisdiction, corrections and offline rights. Fallback official link plus recorded contacts; no generated emergency hotline. |

No default dependence on an API whose current availability/commercial program was not verified. In particular, do not build around old tutorials claiming unrestricted airline inventory or easy unapproved booking access.

### 13.2 How an integration actually ships

For each provider: sandbox fixtures → access/contract and storage-right review → capability map → adapter and schema → retry/quota/circuit breaker → provenance UI → failure/offline behavior → realistic coverage tests → real production validation → monitoring/cost alert → support runbook. Record source/refresh/expiry and licensing per field or resource.

Maintain manual/user data independently of provider responses. Provider disappearance must not delete a paid ticket or a traveler-entered address. Reconcile differing sources without overwriting a confirmed record with an inferred suggestion.

### 13.3 Purchases and outside-app handoffs

Keep search, comparison, terms and saved trip context inside the app. When a supplier requires web/app authentication or checkout, explain the destination, preserve a return link and import the result. App-held transactions need quote expiry/repricing, reviewed total/fees/currency, passenger validation, payment authorization, order confirmation, receipts, support ownership, cancellation/refund quotes and reconciliation. A payment timeout leaves “checking status,” not “failed—buy again.”

Do not launch in-app travel sales until legal/commercial review establishes seller responsibilities and support capability. App digital subscriptions and physical/travel services have different store billing rules; assess the applicable region/program under [Apple's review guidelines](https://developer.apple.com/app-store/review/guidelines/) and [Google Play payments policy](https://support.google.com/googleplay/android-developer/answer/9858738) before implementation. Avoid hard-coded assumptions about a single global billing rule.

### 13.4 Cost model and launch geography

Calculate monthly cost as active travelers × trips × provider calls per trip + map sessions/download rights + files/storage/egress + import/OCR/translation volume + notifications/backend/support + optional commerce fees. Price current provider contracts at acquisition time; do not treat a developer free tier as production economics.

Track per-trip API cost, quote search volume, refresh frequency, repeat lookup hits, download bytes and support contacts. Set tenant/provider budgets and abuse controls without making existing tickets inaccessible. Launch with a verified destination/mode coverage matrix; expand by passing the same data and real-trip tests, not by adding a country selector.

## 14. Security, privacy, and reliability

Identity documents and household/medical notes are private by default, separate from shared itinerary records. Trip access never automatically grants passport/insurance/medical-file access. Scope every file and search result; no sensitive snippets in public share links or push notification previews.

Server-side authorization plus [database row-level policies](https://supabase.com/docs/guides/database/postgres/row-level-security), short-lived file access, encrypted transport/storage, [protected native credentials](https://docs.expo.dev/versions/latest/sdk/securestore/) and sensitive-file unlock are required. Define document key management, recovery and sharing before uploads. Do not call ordinary server encryption end-to-end encryption. If end-to-end vault encryption is chosen, parsing/search/recovery architecture must be redesigned and tested explicitly.

Use malware/type/size validation and quarantine for uploads, isolate parsing, strip executable content, protect email ingestion from spoofing, and treat imported text as data. AI instructions in a PDF/email cannot authorize payment, sharing or private-data access.

Location is optional; foreground/manual location works first. Temporary background sharing is separate explicit consent. Avoid storing precise historical location by default. Dependent information is managed privately by guardians; no automatic child social profiles.

Guest drafts contain minimal user-entered planning data; browser persistence is not a secure passport vault. Document deletion/export/account deletion cover object files, indexes, providers, devices and backup-retention disclosures. Provide device/session revocation and a lost-phone flow.

Reliability: transaction idempotency, source freshness, validated webhook identity, retry limits, outbox/dead-letter jobs, backup/restore drills, incident detection and rollback. Live feed failure preserves known itinerary data. Availability targets will be instrumented and reviewed; no guarantee of emergency response or uninterrupted third-party service.

## 15. Build sequence and completion gates

No application changes begin until this plan is approved. Each milestone produces complete traveler flows, not new empty navigation sections.

| Milestone | Exact work package | Gate before progressing |
| --- | --- | --- |
| **M0 — investigation and design validation** | Production-like speed baseline; bottleneck traces; traveler interviews; task inventory; wireframes for creation/outline/day/travel/help; test four-label architecture; review privacy/provider feasibility | Document actual speed cause(s); travelers complete core prototype tasks; complete cross-form-factor screen spec and revised plan accepted |
| **M1 — polished foundation and speed repair** | New tokens/components/layouts; semantic navigation; forms/sheets/inspectors; measured auth/navigation/storage/bundle fixes; error/loading/offline states; preview route independent of needless auth | Before/after timings meet agreed budget; keyboard/screen-reader basics; 320px–desktop layout and no overlapping controls; no real sensitive-data fixture |
| **M2 — real trip organizer vertical slice** | Guest/cloud trip creation, flexible/exact dates, multi-stop outline, saved ideas, day plan, manual legs/stays, domain/contracts/API, initial search/export; backend administration/migration gate | Create → schedule → reload → reopen on another device; ownership and migration tests; constraints/time/money correct; no fake fixed dates |
| **M3 — native and offline foundation** | Expo iOS/Android development builds; secure session; SQLite/IndexedDB adapters, sync queue/conflicts, manifest, memberships/roles, revocation; real-device installs | Same authorized trip across web/iPhone/Android; offline restart/edit/reconnect; no duplicate operations or private-data leaks |
| **M4 — practical trip essentials** | Reviewed imports/OCR, complete mode/stay/ticket details; readiness/packing/home/return tasks; private documents; contacts; money/rates/splits/receipts; calendar/reminders | Full manually organized home-to-home trip including tickets and costs works; secure/private downloaded files; import duplicate/change review and reminder/zone tests |
| **M5 — real discovery and realistic planning** | Map/POI/route provider acquisition, practical search, details/filters, day placement, constraint checker/optimization preview, native offline regions and transit coverage | Discover → evaluate → add → route → retrieve offline; locked commitments preserved; missing coverage honest; licensing/attribution tests pass |
| **M6 — operational travel** | Flight feed/status/alerts, forecast, leave-time explanation, connections, disruption dependency/replan and provider contacts, notification deduplication | Inject cancellation/gate/delay/weather/stale events; correct affected items and user review; feed outage does not block the plan |
| **M7 — tourism services and international utilities** | Licensed destination comparison/content, entry-service validation, attraction/stay/flight partner integration, dining/pass/rental supported-provider flows, eSIM/translation/currency enhancements | At least one real supported service end-to-end through fulfillment and support; coverage/terms visible; timeout/reprice/refund paths verified; no broad marketplace claim |
| **M8 — advanced coordination and wrap-up** | Optional connected mail, proposals/comments/votes depth, consented location, issue/claims records, memories/reusable templates, optional grounded assistant, portability/deletion | Concurrent/offline/group scenarios and privacy tests; reviewed AI actions; real return-home wrap-up; recover/export/delete verified |
| **M9 — beta and store release** | Full real-trip beta, support tools/docs, accessibility audit, performance field monitoring, legal/privacy/store preparation, signed builds, staged release/rollback, cost monitoring | No unresolved critical security/data-loss defects; core task success and latency targets; supported coverage published; approval to publish and required account access |

Dependency order: M0 → M1 → M2 → M3; M4 builds on M2/M3; M5/M6 require contracts/provider gates; M7 requires commerce/support readiness; M8 requires reliable privacy/sync; M9 requires launch flows passing. Provider evaluation can happen while foundations are being built; purchasing/signing/submitting requires the appropriate business authorization. Do not block manual trip organization on a supplier deal.

### Per-feature definition of done

Data contract and ownership → full phone/desktop/native flow → reliable persistence and sync → validation/empty/loading/offline/error states → provenance and permissions → accessibility → meaningful tests → performance/cost budget → real-provider/device validation → support instructions and published coverage. A feature failing these conditions is tracked as incomplete even if its screen looks finished.

### Existing code disposition

Retain only useful, tested date/time/currency utilities and security checks after review. Replace the current visual/layout structure. Reconsider the database around the complete model instead of forcing every reservation into an Activity. Keep a recoverable snapshot before removing test code. Do not apply migrations to another person's Supabase project without appropriate administration access; build/test isolated data contracts in the meantime. No authentication bypass.

## 16. Testing and real-trip validation

### 16.1 Meaningful automated tests

- Domain: flexible/date-line/DST/overnight timing, fixed-window constraints, cancellation cutoffs, integer money/currency conversion/splits, expense-versus-booking deduplication.
- Authorization: owner/editor/viewer, dependent/private-file grants, scoped search, revoked invites/members/devices, direct API/file access attacks.
- Sync: duplicate/out-of-order operations, offline concurrent moves, delete/edit conflicts, partial batches, migration/version mismatch, long offline periods.
- Import: real-format anonymized operator samples, changed confirmations, ambiguous airports/dates, OCR confidence, duplicate attachment, malformed/malicious files.
- Providers: licensed contract fixtures, missing fields, source disagreement, timeout/quota/expiry, codeshares, no transit coverage, sold-out/price change, webhook duplicates.
- Commerce: idempotent checkout, payment/order mismatch, unknown result, reconciliation, cancellation/refund partial failure, support ownership.
- Offline: airplane mode after restart, downloaded file corruption, token expiry, storage exhaustion, map region edges and revocation limits.
- UI/end-to-end: guest creation/migration, discover/add/move, reference/ticket retrieval, expense entry, readiness/packing, return tasks, export; keyboard/accessibility text and native screen readers.

### 16.2 Device matrix

Desktop Chrome/Safari/Firefox where supported; small/large iPhone Safari and native iOS; representative older/midrange Android browser/native; tablet/landscape; slow network, reduced motion, light/dark, large text, denied location/notifications, and storage pressure. Emulation supplements real devices; it does not replace them.

### 16.3 Beta gates

Run the complete example journey and adverse scenarios in section 8 with real travelers. Measure creation time, reference lookup, realistic day planning, external handoffs, offline task success, expense capture, missed/confusing alerts, cross-device correctness and repeated trip use. Record what people still need another app for. Classify each gap as necessary supplier/system handoff, missing supported integration, or UI failure, and fix the relevant layer.

No market-superiority claim until comparative usability evidence supports it. Do not trade reliable essentials for a larger count of small features.

## 17. Release, support, and ongoing operation

### 17.1 Store and web release

Obtain company-owned Apple/Google developer accounts, bundle IDs/signing, privacy policies/support URLs, provider approvals, and store-specific disclosures. Native binaries, TestFlight/Play testing, device capability/permission copy, screenshots, age/data declarations, account deletion and review account/fixtures must be ready. Validate purchases/subscriptions under then-current regional store policy. Do not submit or accept commercial terms as part of this planning task.

Web needs production hosting/domain/HTTPS, bounded provider access, correct auth callbacks, observability, backups, privacy/export/deletion/support and production review route. Separate sample/staging/customer environments; sample data never silently becomes a real booked trip.

### 17.2 Operations

Monitor auth/API latency, sync errors, crash-free sessions, provider coverage/freshness, order reconciliation, broken downloads and cost per trip. Maintain incident runbooks for provider outage, wrong alert, sensitive-file access, payment mismatch, lost device and data recovery. Establish a content owner/review interval for destination/help information and user correction feedback.

Support can view redacted diagnostics by default; sensitive document access requires specific authorization and audit. Provider support ownership is clear before checkout. Feature flags can disable unreliable live data without disabling the saved trip.

### 17.3 Long-term product discipline

Maintain a coverage register: traveler job, destination/mode applicability, feature ID, owner, provider/source, screen, known limits, last verification and next review. New jobs receive the same specification rather than another generic menu. Reuse across future trips should improve defaults with explicit user control; avoid surveillance or automatic sensitive profiling.

## 18. Previewing phone and desktop

### Current redesign review

Open `http://localhost:3000/preview` on the Mac while the development server is running. It contains the first redesigned guest workspace and an explicitly fictional sample trip. Use the **Desktop** and **iPhone layout** controls at the top to compare layouts. `/workspace` opens the normal guest trip list without automatically creating sample data. It is development-only, so a production `/preview` URL currently returns 404.

**Desktop:** open the URL in a normal wide Chrome/Safari window.  
**iPhone-sized web view in Chrome on Mac:** open Developer Tools (`⌘⌥I`), toggle the device toolbar (`⌘⇧M` while DevTools is active), choose an available iPhone preset or Responsive around 393 × 852 CSS pixels, and reload when testing viewport initialization. Compare with the normal desktop window. Model availability/shortcuts can differ by browser version; the DevTools menu also exposes the device toolbar. See [Chrome device-mode documentation](https://developer.chrome.com/docs/devtools/device-mode).

This previews the responsive website at an iPhone-like viewport. It does not show the actual future native app, reproduce every Safari behavior, or validate physical device speed.

**Actual iPhone Safari:** `localhost` on an iPhone points to that iPhone, not the Mac. A running development server reachable over the same Wi-Fi can be opened using the Mac's local-network address and port, subject to its network/firewall configuration. A hosted HTTPS review URL is preferable for repeatable real-device review once approved. Do not expose real identity/payment documents through an unsecured development setup.

**Future native review:** install an iOS development/TestFlight build and Android development/Play test build; use real devices plus simulator/emulator, with the same fixture trip. This requires native implementation and signing/distribution configuration, which have not been done.

Earlier image references below show the superseded prototype; see `REDESIGN_PROGRESS.md` for the current review.

- Phone screenshot: `/Users/adityabanwasi/.codex/visualizations/2026/09/27/01a0e3b2-3bc8-7091-bb8f-0db9ceb46f53/trippilot-phone.png`
- Desktop screenshot: `/Users/adityabanwasi/.codex/visualizations/2026/09/27/01a0e3b2-3bc8-7091-bb8f-0db9ceb46f53/trippilot-desktop.png`

### Preview requirements for the replacement

Provide a clearly separate review environment with switchable phone/desktop canvas widths and consistent fixtures, without forcing users to enter DevTools. Include empty new trip, imported trip, preparation, active travel, disruption, return, group, no-network and long-trip scenarios. Native review remains separately labeled. Production-like performance review must be available without weakening authentication or relying on development compilation.

## 19. Approval boundary and next work

The user approved this product direction, the four-destination trip workspace, the specific capability inventory, the redesign/performance standards, and the milestone sequence. Approval does not imply every commercial provider is contracted, new spending is authorized, or a production migration/store publication should occur automatically.

**Implementation is authorized and underway.** The first redesigned web foundation is documented in [REDESIGN_PROGRESS.md](REDESIGN_PROGRESS.md). The user requested pauses at reviewable milestones; stop after each agreed review milestone so they can inspect progress. This does not mark all M0/M1 gates or later feature work complete.

The delivery sequence remains M0 onward: establish measured speed baselines and validate the new creation/day/travel flows with wireframes. Then complete M1's polished foundation and targeted speed fixes before adding more screens. Continue through the feature gates with specific evidence. Infrastructure/provider/store access is requested only when required; use isolated fixtures for independent work, not as substitute proof of live functionality.

The user should not have to choose libraries, navigation micro-details, or implementation tactics. This plan gives recommended defaults. Decisions that require business ownership—service contracts, operating budget, account access and publication—remain explicit gates, with prepared evidence rather than open-ended design questions.
