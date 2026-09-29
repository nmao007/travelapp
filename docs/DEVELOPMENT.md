# Development and release status

Use Node 24 (see `.nvmrc`). Install with `npm ci`. Start web development with `npm run dev`.

## Checks

- `npm run typecheck` checks TypeScript.
- `npm test` runs domain edge cases and isolated PostgreSQL migration/RLS/integrity tests using PGlite. Tests never connect to Supabase or touch live data. PGlite is a development-only dependency.
- `npm run build` checks production compilation and routes.

Development uses `.next-dev` and production uses `.next` so a build check does not overwrite the running development server. The obsolete unconfigured lint script was removed; a dedicated lint configuration remains a future tooling task.

## Workspace migration

The migration `supabase/migrations/202609270001_trip_workspace.sql` adds trip time zone/currency/budget and the activities, expenses, and packing_items tables. It preserves existing trips and defaults their zone to UTC and currency to USD. Review legacy trip settings before relying on Today or budgeting.

The live itinerary, expense, and packing features require this migration. Until it is applied, the app detects the legacy schema and preserves trip creation, listing, editing, and deletion; unavailable tools show a clear pending state. It has been tested against an isolated PostgreSQL runtime, not the live Supabase project. This checkout has no linked Supabase project or database administration credentials configured. The public application URL/key are insufficient for applying SQL migrations.

When database access is available, check remote migration history, back up production, and apply the pending migration through the Supabase CLI (`supabase db push` after linking) or the authenticated project SQL editor. Do not reset a remote database. Verify existing migration history before applying the older create-trips migrations.

Live validation still required: two isolated users, trip creation/update/deletion, activity CRUD, expense CRUD, packing updates, refresh persistence, session expiry, and a real phone browser. Automated database tests emulate Supabase roles and `auth.uid()` but do not validate hosted auth or PostgREST behavior.

## Current redesign and boundaries

The approved specification is [MASTER_PLAN.md](MASTER_PLAN.md); earlier product/layout drafts are superseded. See [GLOBE_DISCOVERY_MILESTONE.md](GLOBE_DISCOVERY_MILESTONE.md) for the latest implemented review slice and [WANDERLOG_TRIPIT_PARITY.md](WANDERLOG_TRIPIT_PARITY.md) for the requested complete feature register. Earlier milestones are preserved in [MINIMAL_UI_AND_REAL_DATA.md](MINIMAL_UI_AND_REAL_DATA.md) and [REDESIGN_PROGRESS.md](REDESIGN_PROGRESS.md).

- `/` opens `/workspace`, the new guest planner. `/preview` is a development-only design review with Desktop/iPhone layout controls and an optional development fixture control; it returns 404 in production.
- Trip navigation is Trip, Plan, Explore, and Essentials. Guest trip creation supports destination names, flexible/exact dates, and optional preferences. Stop names do not yet have per-stop nights or resolved place IDs.
- Guest records use local IndexedDB and readable JSON backup export. They are not cloud synchronized or encrypted. The app shell does not yet work offline; native iOS/Android clients are separate milestones.
- Manual reservations appear in the plan and reservation list as one record. Items use local times and per-item zones. Repeated daylight-saving times still need explicit offset selection in advanced reservation handling.
- Expenses use one trip currency. Currency conversion, provider prices, and payments are not connected.
- Explore place search still uses explicit server-side OpenStreetMap/Nominatim lookup. New-trip destination autocomplete and globe reverse discovery use Photon with actual OSM identities; public Photon is development-only, and production requires `PHOTON_SERVICE_URL`. The live vector globe and destination map use MapLibre/OpenFreeMap with visible attribution. There is no fictional fallback, sourced itinerary route, live flight feed or booking provider.
- Protected account routes retain their prior interface, authentication/ownership checks, and migration dependency. The new guest route does not access account data or require Supabase administration.
- Production performance targets, full provider integration, secure document handling, and real-device/native validation remain open gates. Build success and local browser checks are not proof of the finished travel product.

Follow `PRODUCT.md` and the master plan for milestone sequencing. Pause at each reviewable milestone as requested by the user.
