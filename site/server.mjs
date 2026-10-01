import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { createRequire } from 'node:module';
import { createFlightService } from './flight-service.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3010);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const wikiHeaders = { 'user-agent': 'TripPilotLocal/0.1 (local travel planning prototype)' };
const photoCache = new Map();
const lookupFlight = createFlightService();
const require = createRequire(import.meta.url);
let zoneLookup;
try { zoneLookup = require('geo-tz').find; } catch { /* Time zones remain editable without the optional lookup. */ }

function distanceKm(a, b) {
  const radians = value => value * Math.PI / 180;
  const dLat = radians(b.lat - a.lat), dLng = radians(b.lng - a.lng);
  const arc = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

async function wikimediaPhoto(title, lat, lng, width) {
  const url = new URL('https://en.wikipedia.org/w/api.php');
  url.search = new URLSearchParams({ action: 'query', prop: 'pageimages|coordinates|extracts', titles: title, redirects: '1', piprop: 'thumbnail|name', pithumbsize: String(width), exintro: '1', explaintext: '1', exchars: '600', format: 'json' }).toString();
  const response = await fetch(url, { headers: wikiHeaders, signal: AbortSignal.timeout(7000) });
  if (!response.ok) throw new Error('Wikimedia unavailable');
  const data = await response.json();
  const page = Object.values(data.query?.pages || {})[0];
  const point = page?.coordinates?.[0];
  const locality = !/\d/.test(title) && !/street|temple|museum|park|tower|hotel|bridge|shrine/i.test(title);
  if (!point || distanceKm({ lat, lng }, { lat: point.lat, lng: point.lon }) > (locality ? 35 : 2)) return null;
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
  return { src: page.thumbnail?.source || null, artist, license, licenseUrl, creditUrl: commonsUrl, description: page.extract || '', descriptionUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replaceAll(' ', '_'))}` };
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
  return { mapsKey: values.GOOGLE_MAPS_BROWSER_KEY || null, mapId: values.GOOGLE_MAP_ID || 'DEMO_MAP_ID', flightLookup: Boolean(values.AERODATABOX_API_KEY || process.env.AERODATABOX_API_KEY) };
}

createServer(async (request, response) => {
  const pathname = new URL(request.url || '/', 'http://localhost').pathname;
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
    if (!title || title.length > 100 || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      response.writeHead(400); response.end('Invalid place'); return;
    }
    try {
      const cacheKey = `${title}|${lat.toFixed(3)}|${lng.toFixed(3)}|${width}`;
      let cached = photoCache.get(cacheKey);
      if (!cached || cached.expires < Date.now()) {
        const promise = wikimediaPhoto(title, lat, lng, width);
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
  if (pathname === '/preview') {
    const body = await readFile(join(root, 'preview.html'));
    response.writeHead(200, { 'content-type': mime['.html'], 'cache-control': 'no-store' });
    response.end(body);
    return;
  }
  const assets = new Map([['/', 'index.html'], ['/index.html', 'index.html'], ['/app.css', 'app.css'], ['/app.js', 'app.js'], ['/trip-store.js', 'trip-store.js'], ['/date-range.js', 'date-range.js'], ['/domain.js', 'domain.js'], ['/trip-itinerary.js', 'trip-itinerary.js'], ['/itinerary-model.js', 'itinerary-model.js'], ['/itinerary-ui.js', 'itinerary-ui.js'], ['/place-model.js', 'place-model.js'], ['/motion.js', 'motion.js'], ['/flight-model.js', 'flight-model.js'], ['/planning-drag.js', 'planning-drag.js']]);
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
