const point = value => value && Number.isFinite(value.latitude) && Number.isFinite(value.longitude) && Math.abs(value.latitude) <= 90 && Math.abs(value.longitude) <= 180;
function failure(message, status = 502) { return Object.assign(new Error(message), { status }); }
export function createRouteService({ request = fetch, now = Date.now } = {}) {
  const cache = new Map(), queue = []; let active = 0;
  function drain() {
    while (active < 3 && queue.length) {
      const job = queue.shift(); active++;
      Promise.resolve().then(job.run).then(job.resolve, job.reject).finally(() => { active--; drain(); });
    }
  }
  return async (input, key) => {
    if (!['WALK', 'DRIVE', 'TRANSIT'].includes(input?.mode) || !point(input.origin) || !point(input.destination)) throw failure('Choose two mapped places and a travel mode.', 400);
    if (!key) throw failure('Google routing is not configured.', 503);
    const cacheKey = JSON.stringify([input.mode, input.origin.latitude, input.origin.longitude, input.destination.latitude, input.destination.longitude]);
    const cached = cache.get(cacheKey);
    if (cached && cached.expires > now()) return cached.promise;
    const run = async () => {
      const waypoint = value => ({ location: { latLng: value } });
      const response = await request('https://routes.googleapis.com/directions/v2:computeRoutes', {
        method: 'POST', signal: AbortSignal.timeout(15000),
        headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps,routes.warnings' },
        body: JSON.stringify({ origin: waypoint(input.origin), destination: waypoint(input.destination), travelMode: input.mode, languageCode: 'en', units: 'METRIC', ...(input.mode === 'DRIVE' ? { routingPreference: 'TRAFFIC_AWARE' } : {}), ...(input.mode === 'TRANSIT' ? { departureTime: new Date(now()).toISOString() } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw failure(response.status === 429 ? 'Routing limit reached. Try again shortly.' : response.status === 403 ? 'Enable Google Routes API for this Maps key.' : 'Google could not calculate this route.', response.status === 429 ? 429 : 502);
      const route = data.routes?.[0];
      if (!route) return { available: false, mode: input.mode };
      const seconds = Number(String(route.duration || '').replace(/s$/, ''));
      if (!/^\d+(?:\.\d+)?s$/.test(route.duration || '') || !Number.isFinite(seconds) || seconds < 0 || !Number.isFinite(route.distanceMeters) || route.distanceMeters < 0 || !route.polyline?.encodedPolyline) throw failure('Google returned an incomplete route.');
      return { available: true, mode: input.mode, seconds, meters: route.distanceMeters, polyline: route.polyline.encodedPolyline, warnings: route.warnings || [], checkedAt: new Date(now()).toISOString(), steps: (route.legs || []).flatMap(leg => (leg.steps || []).map(step => {
        const transit = step.transitDetails, line = transit?.transitLine;
        return { instruction: step.navigationInstruction?.instructions || '', mode: step.travelMode || input.mode, meters: step.distanceMeters || 0, line: line?.nameShort || line?.name || '', vehicle: line?.vehicle?.type || '', departureStop: transit?.stopDetails?.departureStop?.name || '', arrivalStop: transit?.stopDetails?.arrivalStop?.name || '', headsign: transit?.headsign || '' };
      })) };
    };
    const entry = { expires: now() + (input.mode === 'WALK' ? 600000 : 60000), promise: new Promise((resolve, reject) => { queue.push({ run, resolve, reject }); drain(); }) };
    cache.set(cacheKey, entry);
    if (cache.size > 150) cache.delete(cache.keys().next().value);
    try { return await entry.promise; } catch (error) { cache.delete(cacheKey); throw error; }
  };
}
