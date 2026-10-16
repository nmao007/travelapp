# Travel reference data

`travel-reference.json` contains an offline snapshot of current country currencies
from [Unicode CLDR](https://github.com/unicode-org/cldr-json) and timezone regions
from [IANA tzdb](https://github.com/eggert/tz/blob/main/zone1970.tab), retrieved
2026-10-14. `dist/country-currencies.js` derives country labels using Intl.

Unicode data is distributed under the included `UNICODE-LICENSE.txt`. IANA's
timezone tables are public domain. An ambiguous timezone never selects a currency
on its own; an explicit country in the saved destination address takes priority.

# Public API connections

- Open-Meteo: current regional weather and the next 16 days. Its key-free endpoint
  is for evaluation/non-commercial use. A commercial release needs an appropriate
  provider licence. [Documentation](https://open-meteo.com/en/docs)
- Frankfurter: reference exchange rates. No account or key is required; no
  transactions are made. [Documentation](https://frankfurter.dev/)

Both connections run server-side with fixed provider URLs, timeouts, normalized
responses, bounded caches and in-flight request coalescing. Weather is cached for
30 minutes; currency pairs for one hour. No configuration forms are necessary.

The browser rounds destination coordinates to one decimal before making the
weather request; the server rounds again before forwarding. It requests a generic
16-day window, never a user's travel dates. Country/currency detection runs from
bundled reference data. External requests contain no names, IDs, notes, addresses,
bookings, cookies, auth headers, trip dates or device location. The exchange API
receives currency codes only. Conversion amounts are calculated in the browser.

Existing Maps/Supabase settings are reused without exporting their values to new
services. AeroDataBox flight lookup still requires a separately authorized provider
account/key; this work does not register accounts, purchase plans or publish a deployment.
