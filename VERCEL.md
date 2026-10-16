# Deploy TripPilot to Vercel

This configuration deploys the current `site` app, including its device previews, rather than the separate Next.js UI.

## Import the repository

Import `nmao007/travelapp` into Vercel. Keep the root directory at `./` and use the **Other** framework preset. The tracked `vercel.json` selects the build command and output directory. Use Node.js **24.x**.

The build generates browser modules from the shared domain code and copies only the app's public assets into `vercel-static`. `/` and `/preview` open the device preview; `/app` serves the app. API requests are handled by one Node function. Local `.env.local` files are never part of the static output and are not read on Vercel.

## Environment variables

Set these in Vercel's project settings before deploying:

- `NEXT_PUBLIC_SUPABASE_URL`: your Supabase project URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: the public anon/publishable key, never a service-role key.
- `GOOGLE_MAPS_BROWSER_KEY`: the browser key for Maps JavaScript and Places; add the deployment domain to its HTTP referrer restrictions.
- `GOOGLE_MAP_ID`: your map ID, or `DEMO_MAP_ID` for testing.
- `GOOGLE_MAPS_ROUTES_KEY`: optional server key for route calculations; enable the Routes API and restrict its allowed APIs. This server key is never returned by `/api/config`.
- `AERODATABOX_API_KEY`: optional server key for flight lookup.
- `AERODATABOX_GATEWAY`: `rapidapi` (default, including the free Basic plan) or `direct` for a direct AeroDataBox subscription.

Missing Supabase configuration leaves browser-local planning available; accounts and cloud syncing require Supabase. Missing flight credentials disables flight lookup. Google Maps requires a working key and provider quota.

In Supabase Authentication URL Configuration, add the deployed app URL to the allowed redirect URLs and set the Site URL to your production domain. Redeploy after changing environment variables.

## Verify after deploying

Open the root URL, choose a phone or desktop view, and check adding/editing a stop, the calendar, map search, and account sign-in. `/api/config` must include only public configuration. `/api/timezone?lat=34.05&lng=-118.24` should return `America/Los_Angeles`.

Warm function instances retain bounded route/flight/photo caches, but caches are not shared across instances. Trips persist through browser storage and Supabase, not the function filesystem.

## Local development

Continue using `npm run dev` inside `site` for the local site on port 3010. To validate the deployment output, run `node --disable-warning=ExperimentalWarning scripts/build-vercel.mjs` from the repository root.
