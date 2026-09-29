# TripPilot

**Redesign approved September 27, 2026. Implementation is underway.**

The comprehensive coverage specification is [docs/MASTER_PLAN.md](docs/MASTER_PLAN.md). The latest [assistant-first revision](docs/ASSISTANT_FIRST_REVISION.md) takes precedence for interaction, navigation, contextual home, commerce acceptance and milestone order: **Today · Explore · Trip · You**, selection/import before manual entry, and genuine in-app purchasing for supported services. The existing implementation does not yet match those revised flows.

The new guest workspace is at `/workspace`; `/preview` provides development-only desktop and iPhone layout review. This is the first web foundation of the approved product, not completion of its native apps or provider integrations. See [docs/MINIMAL_UI_AND_REAL_DATA.md](docs/MINIMAL_UI_AND_REAL_DATA.md) for the prior implementation milestone, and [docs/REDESIGN_PROGRESS.md](docs/REDESIGN_PROGRESS.md) for earlier behavior, validation, and outstanding work. The assistant-first correction guides the implementation milestones; no flight tracking or booking capability is claimed.

The latest implementation checkpoint is [map and discovery polish](docs/GOOGLE_MAPS_DISCOVERY.md): larger labeled pins, distance-based suggestions, live place search, fewer forms, and an optional Google Maps renderer that still needs authorized credentials for live verification. The prior [day planning](docs/PLAN_WORKFLOW_MILESTONE.md) and [multi-city and nearby](docs/MULTI_CITY_AND_NEARBY_MILESTONE.md) checkpoints cover the connected planning flow. The complete [Wanderlog/TripIt parity register](docs/WANDERLOG_TRIPIT_PARITY.md) tracks every requested capability and its honest implementation state. The contextual Today dashboard, native apps, cloud sync, reservation import, live flights and production marketplace remain incomplete.

Supabase administration is unavailable in this setup. Continue local work without weakening account authorization or claiming that cloud synchronization is connected.
