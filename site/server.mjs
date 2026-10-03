import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { createRequire } from 'node:module';
import { createRouteService } from './route-service.mjs';
import { createFlightService } from './flight-service.mjs';
import { matchingPhotoPage } from './wiki-photo-match.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3010);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const wikiHeaders = { 'user-agent': 'TripPilotLocal/0.1 (local travel planning prototype)' };
const photoCache = new Map();
const lookupFlight = createFlightService();
const lookupRoute = createRouteService();
const require = createRequire(import.meta.url);
let zoneLookup;
try { zoneLookup = require('geo-tz').find; } catch { /* Time zones remain editable without the optional lookup. */ }

function distanceKm(a, b) {
  const radians = value => value * Math.PI / 180;
  const dLat = radians(b.lat - a.lat), dLng = radians(b.lng - a.lng);
  const arc = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

async function wikimediaPhoto(title, lat, lng, width, destination = false) {
  const url = new URL('https://en.wikipedia.org/w/api.php');
  url.search = new URLSearchParams({ action: 'query', prop: 'pageimages|coordinates', titles: title, redirects: '1', converttitles: '1', piprop: 'thumbnail|name', pithumbsize: String(width), format: 'json' }).toString();
  const response = await fetch(url, { headers: wikiHeaders, signal: AbortSignal.timeout(7000) });
  if (!response.ok) throw new Error('Wikimedia unavailable');
  const data = await response.json();
  let page = Object.values(data.query?.pages || {})[0];
  // Google names often differ from article titles (Jinja/Shrine, diacritics,
  // translated names). Search nearby articles, but never use a random neighbor.
  if (!page?.thumbnail?.source || !page.coordinates?.[0]) {
    const nearby = new URL('https://en.wikipedia.org/w/api.php');
    nearby.search = new URLSearchParams({ action: 'query', generator: 'geosearch', ggscoord: `${lat}|${lng}`, ggsradius: '1500', ggslimit: '12', prop: 'pageimages|coordinates', piprop: 'thumbnail|name', pithumbsize: String(width), format: 'json' }).toString();
    const nearbyResponse = await fetch(nearby, { headers: wikiHeaders, signal: AbortSignal.timeout(7000) });
    if (nearbyResponse.ok) {
      const nearbyData = await nearbyResponse.json();
      const match = Object.values(nearbyData.query?.pages || {}).find(candidate => matchingPhotoPage(candidate, title, lat, lng, distanceKm));
      if (match) page = match;
    }
  }
  const point = page?.coordinates?.[0];
  if (!point || distanceKm({ lat, lng }, { lat: point.lat, lng: point.lon }) > (destination ? 35 : 2)) return commonsPlacePhoto(title, lat, lng, width);
  if (!page.thumbnail?.source) {
    const image = await commonsPlacePhoto(title, lat, lng, width);
    if (image) return image;
  }
  const filename = page.pageimage;
  const commonsUrl = filename ? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(filename.replaceAll(' ', '_'))}` : `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replaceAll(' ', '_'))}`;
  let artist = 'Wikimedia Commons', license = '', licenseUrl = '';
  if (filename) {
    const detail = new URL('https://commons.wikimedia.org/w/api.php');
    detail.search = new URLSearchParams({ action: 'query', prop: 'imageinfo', iiprop: 'extmetadata', titles: `File:${filename}`, format: 'json' }).toString();
    try {
      const creditResponse = await fetch(detail, { headers: wikiHeaders, signal: AbortSignal.timeout(5000) });
      const creditData = await creditResponse.json();
      const meta = Object.values(creditData.query?.pages || {})[0]?.imageinfo?.[0]?.extmetadata || {};
      artist = (meta.Artist?.value || artist).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().slice(0, 100);
      license = (meta.LicenseShortName?.value || '').slice(0, 50);
      licenseUrl = meta.LicenseUrl?.value || '';
    } catch { /* Keep a link to the Commons file when extended credits are unavailable. */ }
  }
  return { src: page.thumbnail?.source || null, artist, license, licenseUrl, creditUrl: commonsUrl };
}

async function commonsPlacePhoto(title, lat, lng, width) {
  for (const search of [
    { generator: 'search', gsrsearch: title, gsrnamespace: '6', gsrlimit: '20' },
    { generator: 'geosearch', ggscoord: `${lat}|${lng}`, ggsradius: '500', ggslimit: '30', ggsnamespace: '6' },
  ]) {
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.search = new URLSearchParams({ action: 'query', ...search, prop: 'coordinates|imageinfo', iiprop: 'url|extmetadata', iiurlwidth: String(width), format: 'json' }).toString();
    let data;
    try { const response = await fetch(url, { headers: wikiHeaders, signal: AbortSignal.timeout(7000) }); if (!response.ok) continue; data = await response.json(); } catch { continue; }
    for (const page of Object.values(data.query?.pages || {})) {
      const info = page.imageinfo?.[0], meta = info?.extmetadata || {};
      const license = meta.LicenseShortName?.value || '';
      if (!/CC BY|CC0|public domain/i.test(license)) continue;
      if (!matchingPhotoPage({ ...page, thumbnail: { source: info.thumburl } }, title, lat, lng, distanceKm)) continue;
      return { src: info.thumburl, artist: (meta.Artist?.value || 'Wikimedia Commons').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().slice(0, 100), license, licenseUrl: meta.LicenseUrl?.value || '', creditUrl: info.descriptionurl };
    }
  }
  return null;
}

async function localSettings() {
  let contents = '';
  try { contents = await readFile(join(root, '.env.local'), 'utf8'); } catch { /* Setup is intentionally optional. */ }
  const values = Object.fromEntries(contents.split(/\r?\n/).map(line => {
    const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    return match ? [match[1], match[2].trim().replace(/^['"]|['"]$/g, '')] : [];
  }).filter(parts => parts.length));
  return values;
}
async function localConfig() {
  const values = await localSettings();
  return { mapsKey: values.GOOGLE_MAPS_BROWSER_KEY || null, mapId: values.GOOGLE_MAP_ID || 'DEMO_MAP_ID', flightLookup: Boolean(values.AERODATABOX_API_KEY || process.env.AERODATABOX_API_KEY), supabaseUrl: values.NEXT_PUBLIC_SUPABASE_URL || null, supabaseAnonKey: values.NEXT_PUBLIC_SUPABASE_ANON_KEY || null };
}

createServer(async (request, response) => {
  const pathname = new URL(request.url || '/', 'http://localhost').pathname;
  if (pathname === '/api/route') {
    try {
      if (request.method !== 'POST') throw Object.assign(new Error('Use POST for directions.'), { status: 405 });
      const chunks = []; let bytes = 0;
      for await (const chunk of request) { bytes += chunk.length; if (bytes > 16384) throw Object.assign(new Error('Route request is too large.'), { status: 413 }); chunks.push(chunk); }
      let input; try { input = JSON.parse(Buffer.concat(chunks).toString()); } catch { throw Object.assign(new Error('Invalid route request.'), { status: 400 }); }
      const values = await localSettings();
      const route = await lookupRoute(input, values.GOOGLE_MAPS_ROUTES_KEY || process.env.GOOGLE_MAPS_ROUTES_KEY || values.GOOGLE_MAPS_BROWSER_KEY);
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); response.end(JSON.stringify(route));
    } catch (error) {
      response.writeHead(error.status || 502, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify({ error: error.status ? error.message : 'Directions unavailable. Try again.' }));
    }
    return;
  }
  if (pathname === '/api/flights') {
    const params = new URL(request.url, 'http://localhost').searchParams;
    try {
      const values = await localSettings();
      const flights = await lookupFlight(params.get('number'), params.get('date'), { key: values.AERODATABOX_API_KEY || process.env.AERODATABOX_API_KEY, gateway: values.AERODATABOX_GATEWAY || process.env.AERODATABOX_GATEWAY || 'direct' });
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }); response.end(JSON.stringify({ flights }));
    } catch (error) {
      response.writeHead(error.status || 502, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify({ error: error.status ? error.message : 'Flight lookup unavailable.', code: error.code || 'UNAVAILABLE' }));
    }
    return;
  }
  if (pathname === '/api/timezone') {
    const params = new URL(request.url, 'http://localhost').searchParams;
    const lat = Number(params.get('lat')), lng = Number(params.get('lng'));
    if (!params.has('lat') || !params.has('lng') || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) { response.writeHead(400); response.end('Invalid coordinates'); return; }
    try {
      const timeZone = zoneLookup?.(lat, lng)?.[0] || null;
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify({ timeZone }));
    } catch { response.writeHead(503); response.end('Time zone lookup unavailable'); }
    return;
  }
  if (pathname === '/api/config') {
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    response.end(JSON.stringify(await localConfig()));
    return;
  }
  if (pathname === '/api/place-image') {
    const params = new URL(request.url || '/', 'http://localhost').searchParams;
    const title = (params.get('title') || '').trim();
    const lat = Number(params.get('lat')), lng = Number(params.get('lng'));
    const width = Math.max(320, Math.min(1600, Number(params.get('width')) || 800));
    const destination = params.get('scope') === 'destination';
    if (!title || title.length > 100 || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      response.writeHead(400); response.end('Invalid place'); return;
    }
    try {
      const cacheKey = `${title}|${lat.toFixed(5)}|${lng.toFixed(5)}|${width}|${destination}`;
      let cached = photoCache.get(cacheKey);
      if (!cached || cached.expires < Date.now()) {
        const promise = wikimediaPhoto(title, lat, lng, width, destination);
        cached = { promise, expires: Date.now() + 30_000 };
        photoCache.set(cacheKey, cached);
        if (photoCache.size > 200) photoCache.delete(photoCache.keys().next().value);
        promise.then(image => { cached.expires = Date.now() + (image?.license ? 30 * 60_000 : 30_000); }, () => photoCache.delete(cacheKey));
      }
      const image = await cached.promise;
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      response.end(JSON.stringify({ image }));
    } catch {
      response.writeHead(502, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      response.end(JSON.stringify({ image: null }));
    }
    return;
  }
  if (pathname === '/' || pathname === '/index.html' || pathname === '/preview') {
    const body = await readFile(join(root, 'preview.html'));
    response.writeHead(200, { 'content-type': mime['.html'], 'cache-control': 'no-store' });
    response.end(body);
    return;
  }
  const assets = new Map([['/', 'index.html'], ['/index.html', 'index.html'], ['/app.css', 'app.css'], ['/app.js', 'app.js'], ['/trip-store.js', 'trip-store.js'], ['/date-range.js', 'date-range.js'], ['/domain.js', 'domain.js'], ['/trip-itinerary.js', 'trip-itinerary.js'], ['/itinerary-model.js', 'itinerary-model.js'], ['/itinerary-ui.js', 'itinerary-ui.js'], ['/place-model.js', 'place-model.js'], ['/motion.js', 'motion.js'], ['/flight-model.js', 'flight-model.js'], ['/planning-drag.js', 'planning-drag.js'], ['/dropdowns.js', 'dropdowns.js'], ['/explore-model.js', 'explore-model.js'], ['/place-photos.js', 'place-photos.js'], ['/day-route-model.js', 'day-route-model.js'], ['/day-routes.js', 'day-routes.js'], ['/maps-links.js', 'maps-links.js'], ['/tour-model.js', 'tour-model.js'], ['/place-search.js', 'place-search.js'], ['/trip-banner.js', 'trip-banner.js']]);
  assets.set('/app', 'index.html');
  assets.set('/calendar-export.js', 'calendar-export.js');
  assets.set('/notices.js', 'notices.js');
  assets.set('/time-picker.js', 'time-picker.js');
  assets.set('/expansion.js', 'expansion.js');
  assets.set('/day-motion.js', 'day-motion.js');
  assets.set('/mobile.css', 'mobile.css');
  assets.set('/phone-touch.js', 'phone-touch.js');
  const asset = assets.get(pathname);
  if (!asset) { response.writeHead(404); response.end('Not found'); return; }
  try {
    const body = await readFile(join(root, 'dist', asset));
    response.writeHead(200, { 'content-type': mime[extname(asset)], 'cache-control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(500); response.end('Site unavailable');
  }
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`Local: http://127.0.0.1:${port}\n`);
});
