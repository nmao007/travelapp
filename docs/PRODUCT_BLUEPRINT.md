> Superseded draft. The authoritative new proposal is [MASTER_PLAN.md](MASTER_PLAN.md). Implementation is paused until the user approves that plan.

# TripPilot: complete travel companion

## Product promise

One home for the whole trip: from deciding where to go and preparing at home to getting around, changing plans, and returning home. Travelers should rarely need to copy information between services, search confirmation emails, or remember which app holds a detail. A person with only a phone must be able to do everything essential.

Comprehensive means covering the whole journey through one coherent interface and extensible services. It does not mean claiming unconnected providers work, presenting invented live information, or putting every feature on the home screen.

## Journey coverage

| Stage | Needs to cover | Product behavior |
| --- | --- | --- |
| Discover and decide | Destinations, dates, season, interests, budget, group needs, accessibility, dietary needs, family/pets, visa constraints | Save ideas, compare options, build a flexible trip brief, carry preferences through planning |
| Plan | Multi-city itinerary, flights/trains, stays, local travel, attractions, food, tickets, route duration, opening hours, bookings, cancellation conditions | One itinerary with linked places, bookings, costs, documents, and reminders; review conflicts and buffers |
| Prepare at home | Passport/visa readiness, entry rules, insurance, medical preparations, vaccinations/medicines, connectivity/eSIM, payment readiness, packing, home arrangements, pet/child care, airport transport | A personalized preparation list with deadlines, authoritative source links, reminders, and offline readiness |
| Door to door | Leave-home time, pickup, check-in, baggage, terminal/gate, security, boarding, transfer, arrival, immigration, baggage collection, destination transport | Contextual Today actions and the next travel leg; saved references/tickets; disruption recovery |
| Stay and explore | Check-in/out, hotel details, local maps, walking/transit/taxi, sights, food, accessibility, local language, etiquette, weather, rest, reservations, spontaneous discoveries | Nearby and saved places, route-aware suggestions, in-app details, easy additions to the plan |
| Manage daily | Expenses, splits, currencies, receipts, travel documents, notes, group coordination, calendar/reminders, connectivity, offline use | Quick capture, shared data, visible sync status, dependable access to essentials |
| Handle problems | Cancellations/delays, missed connections, lost documents, illness, theft, emergency contacts, insurance assistance, embassy information, alternative routes | A Help & safety center available from every screen; current information with timestamps and provenance; no fabricated assistance |
| Return home | Departure readiness, checkout, packing, return flights/transfers, customs reminders, home transport, settle balances, refunds/claims, memories and reusable preferences | The return leg is part of the same itinerary; a wrap-up view after arrival; retain useful records |

## Information architecture

Five stable primary destinations:

1. **Today:** the relevant next action, next travel leg/stop, today's plan, important references, and timely preparation or return-home tasks.
2. **Plan:** itinerary, bookings, saved trip notes, preparation, and the route. Activities, reservations, and transport are connected rather than isolated lists.
3. **Explore:** places and experiences, search/filters, maps, saved ideas, and add-to-day. Discovery keeps the traveler's location, time, interests, and constraints in context.
4. **Wallet:** bookings/tickets/documents plus expenses and group balances. A reference and its document belong to the related reservation; financial tracking does not imply a bank account.
5. **Tools:** packing, phrasebook/translation, currency calculator, connectivity, weather, safety/help, and traveler settings. Today surfaces the relevant tool so it does not have to be rediscovered.

Trip switching, universal search, quick add, and profile are global. Help & safety is available without scrolling through a feature catalogue. Search spans plans, places, bookings, notes, references, and documents once indexed.

## Core object model

Traveler profile (preferences, optional accessibility/dietary needs), Trip, TripStop, TripMember, ItineraryItem, Place, Reservation, Document, Task, PackingItem, Expense, Split, Note, Reminder, TravelLeg, ProviderConnection, and SyncOperation.

- One reservation can link to an itinerary item, place, expense, document, and travel leg.
- Dates remain calendar dates. Operational times include zone and, where ambiguity matters, explicit offset.
- Each provider fact carries source, last-updated time, and confidence/status. Confirmed bookings are separate from suggested ideas.
- Documents have access controls, encryption, retention, and offline policy. Government identifiers are not casual browser-storage data.
- Offline changes have IDs, versions, tombstones, queues, and a clear conflict strategy. Cache clearing on sign-out matters.

## Phone, tablet, and desktop

Phone: five labeled bottom destinations, compact trip context, primary action within thumb reach, sheets/dialogs for quick capture, details revealed when needed. No laptop-only planning, hover-only controls, or large decorative banners above essential information.

Tablet: navigation rail and two-pane content when space allows; maintain task focus.

Desktop: persistent sidebar, search and quick add, planning canvas, and contextual side pane. Use extra space for seeing a day, a map, and details together rather than merely enlarging phone cards.

## First execution slice

Build an interactive local workspace that proves the entire information architecture before adding more infrastructure. It must support:

- Switching Today/Plan/Explore/Wallet/Tools and trip lifecycle (preparing/traveling/returned).
- A coherent itinerary with day selection and quick add/edit.
- Preparation/home/return task completion.
- Saved place discovery and adding a place to a chosen day.
- Manual reservation capture, in-app reservation details, references, and linking a booking to the itinerary.
- Expense entry, category totals, budget, and packing updates.
- Search across the local trip and quick navigation to results.
- A local phrasebook and currency calculator with explicitly user-entered/sample rates.
- Clearly labeled sample data, browser persistence, and no false live provider status.

Existing test code is a resource, not a product constraint. Reuse dependable logic where useful, but redesign the application structure around this blueprint.

## Delivery sequence

1. **Experience foundation:** document coverage/layout, build the coherent interactive workspace, test phone/desktop usability and accessibility. Gate: users can find and complete the key trip tasks without a feature tour.
2. **Shared product foundation:** proper backend ownership, trip membership, native Expo clients, secure auth/session storage, schema/API/versioning, observability. Gate: the same real trip works across web, iOS, and Android.
3. **Offline essentials:** itinerary, reservations, reference documents, contacts, packing, explicit sync state, network recovery; queued edits with conflict handling. Gate: the airport-to-hotel scenario works in airplane mode.
4. **Preparation and reservations:** document handling, personalized readiness tasks, calendar/reminders, assisted imports with review, multi-leg travel, insurance references and authoritative entry information. Gate: bookings and preparations connect to the daily plan.
5. **In-app discovery and movement:** licensed place/map data, opening hours, route duration, nearby search, saved places, transit/transport links, accessibility/food constraints. Gate: discover, evaluate, and add a suitable stop without losing trip context.
6. **Group/international utility:** invitations/roles, shared edits, multiple currencies with rate provenance, split expenses/settlement tracking, translation/phrase downloads, connectivity services. Gate: concurrent and offline edits preserve information.
7. **Operational assistance:** licensed flight/disruption feeds, weather, leave-time suggestions, alternatives, safety information, optional AI grounded in real trip/provider data. Gate: timestamps/provenance and failure behavior are reliable; never imply guarantees the providers do not offer.
8. **Launch and improve:** real-trip beta, support, privacy/deletion/export, monitoring/backups, app-store submissions, measured retention/task completion, expansion based on evidence.

## Integration strategy

Prefer in-app service details and supported provider APIs/SDKs. Use provider checkout/auth handoffs only where required, preserve the trip context, and return the result to the itinerary. External provider availability, licensing, commercial agreements, credentials, and store rules are dependencies to resolve; a polished button is not a completed integration.

Supabase administration is currently unavailable. Continue locally, without weakening account protection or claiming local data synchronizes. Native apps and production integrations remain unbuilt until their milestones.

## Architecture decisions

Keep Next.js for the desktop/web client and build phone clients with React Native and Expo. Share TypeScript domain rules, validation, data contracts, and design tokens; give each form factor its own view components. The phone product will be a native client with the same trip data, not merely the desktop page in a wrapper. Expo provides an established iOS/Android production-build path; store distribution still requires developer accounts and signing.

Retain Supabase for identity and PostgreSQL. Add versioned service contracts that web and native clients can both consume; Next.js server actions alone are not the native API. Enforce trip membership and object ownership at the database boundary. Keep service credentials and provider calls on the server. Separate provider adapters from itinerary logic so licensing or availability changes do not force a UI rewrite.

Introduce an explicit persistence interface between the domain and browser/native storage. The local reducer is the current development implementation. Production needs a server adapter and an offline adapter with versioned writes and conflicts. Browser localStorage is only for this labeled sample workspace. Native session credentials belong in platform secure storage; document files need separate encrypted storage and retention rules.

Build each integration through a complete traveler flow: data contract → source/provenance and failure behavior → service adapter → useful screen/action → tests with realistic fixtures → real-provider validation. Prioritize maps/places, booking import, and offline travel essentials before marketplace purchases or speculative convenience tools.

References: [Expo platform documentation](https://docs.expo.dev/), [production builds](https://docs.expo.dev/deploy/build-project/), [native secure storage](https://docs.expo.dev/versions/latest/sdk/securestore/).

## Measures

Time to make a useful initial plan; taps/time to find a booking reference; expense entry time; successful offline travel-day tasks; itinerary changes completed on phone; cross-device consistency; correction/conflict rate; outside-app handoffs per task; accessibility completion; travelers returning for another trip.

Do not claim to be better than every competitor before validating these outcomes with real travelers.
