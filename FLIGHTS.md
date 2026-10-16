# Flight lookup

The app looks up a flight number **and its departure date** through AeroDataBox.
Select a match to fill both airports, dates, airport-local times, and time zones.
Provider details include airline, status, terminals, gates, aircraft, check-in desk,
and baggage belt when available. Missing fields are left blank; manual entry remains available.

## Activation

1. Sign in to [RapidAPI's official AeroDataBox listing](https://rapidapi.com/aedbx-aedbx/api/aerodatabox/pricing).
2. Review and activate **Basic ($0/month)**. Do not select a paid plan.
3. Store the account's key in `site/.env.local` as `AERODATABOX_API_KEY`.
   `AERODATABOX_GATEWAY=rapidapi` is the default. Never use a `NEXT_PUBLIC_` variable for this key.
4. Restart the local server and test a real flight number with the correct departure date.
   For deployment, use protected server environment variables with the same names.

No account or key is bundled with the repository. The app returns `NOT_CONFIGURED`
until a key is present; it never displays invented flight results.

## Free-plan limits checked October 15, 2026

- 400 API units/month, hard limit. A single-date lookup is Tier 2 (2 units),
  so the allowance is approximately 200 uncached lookups, excluding other API usage.
- Flight plans are explicitly disabled to avoid their double-unit charge.
- Free use is noncommercial and requires AeroDataBox attribution, included in the app.
- Coverage, future schedules, terminals, gates, and live updates are not guaranteed.
- RapidAPI also lists a platform bandwidth allowance and overage fee. Review the
  subscription page before accepting terms or providing payment information.

## Request savings and privacy

Identical in-flight requests coalesce. Within each running server instance, future
schedules are cached six hours, near-flight results five minutes, empty searches
15 minutes, and access/quota errors pause requests for one minute. These caches
are bounded and do not persist across server restarts or Vercel instances.

Only flight number/date go to the provider; credentials are sent in server-side
HTTPS headers. Booking references, passenger data, and trip notes are not sent.
The browser receives a connection flag and normalized flight details, never the key.
Saved flight details are snapshots, not a live flight-monitoring guarantee.

[Provider documentation](https://doc.aerodatabox.com/)
