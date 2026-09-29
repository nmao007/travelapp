# Review checkpoint — vector maps and destination autocomplete

September 27, 2026. Implements the user's request for a modern smooth map service, live typing suggestions and cycling examples in “Where to?”. Supersedes the raster-map and explicit-submission destination-search choices in the previous milestone.

## Delivered behavior

- MapLibre GL JS replaces Leaflet/raster tiles. Destination previews use a clean OpenFreeMap Positron vector style, native canvas interaction, zoom controls, a selected-location marker and visible attribution. The renderer is imported only when the destination map opens. WebGL is required; unavailable graphics/provider connections show an error and do not prevent calendar use.
- Destination suggestions appear after three characters and a 400 ms debounce, without a Search button or Enter submission. Arrow keys navigate; Enter selects; Escape clears. Clear returns focus to the input. Editing/unmounting/choosing aborts old client requests so stale replies cannot replace current results.
- Empty input cycles “Try Lisbon, Portugal”, “Try Kyoto, Japan”, “Try Barcelona, Spain”, “Try Cape Town, South Africa” every 3.2 seconds. These are placeholder examples requested by the user, not results, prefilled values, default trips or remote search requests. Cycling stops while typing, viewing a destination, or when reduced motion is requested; hidden-page ticks are skipped.
- Actual results retain country/region, source identity, validated coordinates and server-derived time zones. The existing tap-calendar and guest persistence remain.

## Service decision and boundaries

No Google credentials were configured. The user explicitly allowed another modern map service; therefore the implementation uses [OpenFreeMap](https://openfreemap.org/) with [MapLibre](https://maplibre.org/maplibre-gl-js/docs/), rather than displaying Google branding or claiming an unconnected Google API. OpenFreeMap documents public, key-free commercial use and requires map-data attribution. It offers no SLA guarantee. The [integration guide](https://openfreemap.org/quick_start/) supports the vector styles and web/native clients. No native build or offline-map delivery is claimed here.

[Photon](https://github.com/komoot/photon) supports search-as-you-type and permits reasonable use of its public demo. It can throttle/block excessive use and does not guarantee availability. Development uses that actual endpoint, not hardcoded suggestions. The server adapter serializes requests with one-second spacing, allows at most four distinct pending searches and 30 new searches/minute per process, deduplicates identical inflight searches and caches up to 256 queries for one hour. These are our conservative controls, not provider-issued quota promises. HTTPS, six-second request timeouts, response bounds and source validation apply. Larger/distributed operation requires a hosted/self-managed service and shared controls.

Nominatim is **not** used for autocomplete. General Explore place lookup still uses its previous explicit-search adapter and policy gate. There is no silent fallback to prohibited autocomplete or fabricated results when Photon fails.

## Configuration

- `MAP_STYLE_URL`: optional HTTPS MapLibre style URL; default is OpenFreeMap Positron. Style URLs and any embedded access tokens are client-visible. Use only browser/public credentials and reviewed style sources; never include a private server key. Attribution comes from the reviewed style's sources and is displayed without a collapsed toggle.
- `PHOTON_SERVICE_URL`: full HTTPS Photon-compatible `/api/` endpoint. Required in production; the public demo is not enabled there by default. Configure the authorized hosted/self-managed endpoint and restart the server.
- Old `MAP_TILE_URL`/`MAP_TILE_ATTRIBUTION` are no longer consumed by the destination map. No Google Cloud project, billing, API keys or purchase was created. A later Google implementation would need authorized Maps/Places access and a separate provider/policy adapter.
- `predev` and `prebuild` run `scripts/prepare-maps.mjs` to copy the locked MapLibre worker, shared module and license into versioned public assets. The server returns the matching worker URL. This avoids Next.js rewriting the library's default worker URL into a broken bundle path. Generated files are ignored by Git and rebuilt by those scripts; call the script after dependency installation if starting Next.js directly. Worker code is served locally, without a separate third-party script host.

Search text is sent to the configured destination provider; map requests go to style/tile/font providers. This flow searches public destinations, not private home addresses or confidential traveler records. Endpoint configuration is a deployment decision, not a user-editable URL or SSRF surface.

## Validation

Automated suite: 39 tests pass, including Photon identity/coordinate validation, duplicates, bounds, caching/inflight sharing, request spacing and failure handling without fake results. Type checking and production build pass. Live browser verification confirms typed `Lisb` returns actual Lisbon, Lisbourg, Lisburn and regional Lisbon matches without submission. Arrow Down then Enter selects Lisbon. The placeholder changed from Lisbon to Kyoto without changing the input value or submitting a query. Live vector maps load and zoom; the marker recenters when the layout resizes. Desktop and 390 px phone views were visually checked with attribution visible; 320 px and 390 px widths show no horizontal page overflow. Vector-map and responsive screenshots accompany this checkpoint; no real-device/native or frame-rate benchmark is claimed.

Stop for review after this checkpoint. Current-location discovery, the contextual Today dashboard, authenticated sync, flights and actual booking remain separate incomplete milestones.

Review images:

- [Desktop vector map](/Users/adityabanwasi/.codex/visualizations/2026/09/27/01a0e3b2-3bc8-7091-bb8f-0db9ceb46f53/vector-destination-desktop.png)
- [Phone vector map](/Users/adityabanwasi/.codex/visualizations/2026/09/27/01a0e3b2-3bc8-7091-bb8f-0db9ceb46f53/vector-destination-phone.png)
- [Live suggestions](/Users/adityabanwasi/.codex/visualizations/2026/09/27/01a0e3b2-3bc8-7091-bb8f-0db9ceb46f53/live-destination-suggestions.png)
