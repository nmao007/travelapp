import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';
import { createRequire } from 'node:module';
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { createRouteService } from './route-service.mjs';
import { createFlightService } from './flight-service.mjs';
import { matchingPhotoPage } from './wiki-photo-match.mjs';
import { createTravelDataService } from './travel-data-service.mjs';

const root = dirname(fileURLToPath(import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
const wikiHeaders = { 'user-agent': 'TripPilotLocal/0.1 (local travel planning prototype)' };
const photoCache = new Map();
const ideaPreviewCache = new Map();
const lookupFlight = createFlightService();
const lookupRoute = createRouteService();
const require = createRequire(import.meta.url);
let zoneLookup;
try { zoneLookup = require('geo-tz').find; } catch { /* Time zones remain editable without the optional lookup. */ }
const travelData = createTravelDataService({ timezoneForPoint: (lat, lng) => zoneLookup?.(lat, lng)?.[0] });

function publicAddress(address) {
  if (address.family === 4) { const parts=address.address.split('.').map(Number),[a,b]=parts; return !(a===0||a===10||a===127||a>=224||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&b===168)); }
  const ip=address.address.toLowerCase(); return !(ip==='::1'||ip==='::'||ip.startsWith('fc')||ip.startsWith('fd')||ip.startsWith('fe8')||ip.startsWith('fe9')||ip.startsWith('fea')||ip.startsWith('feb')||ip.startsWith('::ffff:'));
}
async function safePreviewUrl(value) {
  let url; try { url=new URL(value); } catch { throw Object.assign(new Error('Enter a valid link.'),{status:400}); }
  if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443')||url.hostname==='localhost'||url.hostname.endsWith('.localhost')) throw Object.assign(new Error('Use a public HTTPS link.'),{status:400});
  const family=isIP(url.hostname); let addresses=[];
  try { addresses=family?[{address:url.hostname,family}]:await dnsLookup(url.hostname,{all:true,verbatim:true}); } catch { throw Object.assign(new Error('This link could not be reached.'),{status:400}); }
  if(!addresses.length||addresses.some(address=>!publicAddress(address))) throw Object.assign(new Error('This link is not available for preview.'),{status:400});
  return url;
}
async function fetchIdeaPreview(rawUrl) {
  let url=await safePreviewUrl(rawUrl);
  for(let redirects=0;redirects<=3;redirects++){
    const response=await fetch(url,{headers:{'user-agent':'TripPilotPreview/1.0 (+https://trippilot.app)','accept':'text/html,application/xhtml+xml'},redirect:'manual',signal:AbortSignal.timeout(5000)});
    if(response.status>=300&&response.status<400){const location=response.headers.get('location');if(!location||redirects===3)break;url=await safePreviewUrl(new URL(location,url).href);continue;}
    if(!response.ok||!response.headers.get('content-type')?.includes('text/html'))return null;
    const reader=response.body?.getReader();if(!reader)return null;const chunks=[];let size=0;while(size<512000){const {done,value}=await reader.read();if(done)break;chunks.push(value);size+=value.length;}reader.cancel().catch(()=>{});
    const html=new TextDecoder().decode(Buffer.concat(chunks.map(chunk=>Buffer.from(chunk))));
    const extract=(patterns)=>{for(const pattern of patterns){const match=pattern.exec(html);if(match?.[1])return match[1].replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim();}return '';};
    const title=extract([/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)/i,/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title/i,/<title[^>]*>([^<]+)/i]).slice(0,180);
    const image=extract([/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i,/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image/i,/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)/i]);
    let imageUrl='';try{if(image){const parsed=new URL(image,url);if(parsed.protocol==='https:'){await safePreviewUrl(parsed.href);imageUrl=parsed.href;}}}catch{}
    return {title,image:imageUrl,site:url.hostname};
  }
  return null;
}

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
  if (!process.env.VERCEL) {
    try { contents = await readFile(join(root, '.env.local'), 'utf8'); } catch { /* Local setup is optional. */ }
  }
  const values = Object.fromEntries(contents.split(/\r?\n/).map(line => {
    const match = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    return match ? [match[1], match[2].trim().replace(/^['"]|['"]$/g, '')] : [];
  }).filter(parts => parts.length));
  return { ...values, ...process.env };
}
async function localConfig() {
  const values = await localSettings();
  return { mapsKey: (values.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY || values.GOOGLE_MAPS_BROWSER_KEY) || null, mapId: values.GOOGLE_MAP_ID || 'DEMO_MAP_ID', flightLookup: Boolean(values.AERODATABOX_API_KEY || process.env.AERODATABOX_API_KEY), supabaseUrl: values.NEXT_PUBLIC_SUPABASE_URL || null, supabaseAnonKey: values.NEXT_PUBLIC_SUPABASE_ANON_KEY || null };
}

export async function handleRequest(request, response) {
  const pathname = new URL(request.url || '/', 'http://localhost').pathname;
  if(pathname==='/api/idea-preview'){
    try{
      if(request.method!=='GET')throw Object.assign(new Error('Use GET to retrieve a link preview.'),{status:405});
      const raw=new URL(request.url,'http://localhost').searchParams.get('url')||'';if(raw.length>2048)throw Object.assign(new Error('This link is too long.'),{status:400});
      const key=raw.trim();let cached=ideaPreviewCache.get(key);if(!cached||cached.expires<Date.now()){const promise=fetchIdeaPreview(key).catch(()=>null);cached={promise,expires:Date.now()+30_000};ideaPreviewCache.set(key,cached);promise.then(()=>{cached.expires=Date.now()+10*60_000;});if(ideaPreviewCache.size>300)ideaPreviewCache.delete(ideaPreviewCache.keys().next().value);}
      const preview=await cached.promise;response.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'public, max-age=300'});response.end(JSON.stringify({preview}));
    }catch(error){response.writeHead(error.status||502,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});response.end(JSON.stringify({error:error.status?error.message:'Preview unavailable.'}));}
    return;
  }
  if (pathname === '/api/weather' || pathname === '/api/exchange-rate') {
    try {
      if (request.method !== 'GET') throw Object.assign(new Error('Use GET for travel data.'), { status: 405 });
      const params = new URL(request.url, 'http://localhost').searchParams;
      if (pathname === '/api/weather' && (!params.get('lat')?.trim() || !params.get('lng')?.trim())) throw Object.assign(new Error('Choose a mapped destination.'), { status: 400 });
      const data = pathname === '/api/weather'
        ? await travelData.weather(Number(params.get('lat')), Number(params.get('lng')), params.get('country'))
        : await travelData.rate(params.get('base'), params.get('quote'));
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'public, max-age=300, s-maxage=1800' }); response.end(JSON.stringify(data));
    } catch (error) {
      response.writeHead(error.status || 502, { 'content-type': 'application/json', 'cache-control': 'no-store' }); response.end(JSON.stringify({ error: error.status ? error.message : 'Travel data is temporarily unavailable.' }));
    }
    return;
  }
  if (pathname === '/api/route') {
    try {
      if (request.method !== 'POST') throw Object.assign(new Error('Use POST for directions.'), { status: 405 });
      const chunks = []; let bytes = 0;
      // Vercel may already have parsed the body; local Node requests remain streams.
      if (request.body !== undefined) {
        const body = Buffer.isBuffer(request.body) ? request.body : Buffer.from(typeof request.body === 'string' ? request.body : JSON.stringify(request.body));
        bytes = body.length; chunks.push(body);
      } else {
        for await (const chunk of request) { bytes += chunk.length; if (bytes > 16384) break; chunks.push(chunk); }
      }
      if (bytes > 16384) throw Object.assign(new Error('Route request is too large.'), { status: 413 });
      let input; try { input = JSON.parse(Buffer.concat(chunks).toString()); } catch { throw Object.assign(new Error('Invalid route request.'), { status: 400 }); }
      const values = await localSettings();
      const route = await lookupRoute(input, values.GOOGLE_MAPS_ROUTES_KEY || process.env.GOOGLE_MAPS_ROUTES_KEY || (values.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY || values.GOOGLE_MAPS_BROWSER_KEY));
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
      const flights = await lookupFlight(params.get('number'), params.get('date'), { key: values.AERODATABOX_API_KEY || process.env.AERODATABOX_API_KEY, gateway: values.AERODATABOX_GATEWAY || process.env.AERODATABOX_GATEWAY || 'rapidapi' });
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
  assets.set('/trip-guide.js', 'trip-guide.js');
  assets.set('/flight-window.js', 'flight-window.js');
  for (const file of ['wallet-model.js', 'wallet-ui.js', 'wallet-export.js', 'expense-rates.js']) assets.set(`/${file}`, file);
  assets.set('/calendar-stops.js', 'calendar-stops.js');
  assets.set('/notices.js', 'notices.js');
  assets.set('/time-picker.js', 'time-picker.js');
  assets.set('/expansion.js', 'expansion.js');
  assets.set('/day-motion.js', 'day-motion.js');
  assets.set('/plan-navigation.js', 'plan-navigation.js');
  assets.set('/trip-dates.js', 'trip-dates.js');
  assets.set('/phone-devices.js', 'phone-devices.js');
  assets.set('/mobile.css', 'mobile.css');
  assets.set('/ui.css', 'ui.css');
  assets.set('/phone.css', 'phone.css');
  assets.set('/phone-touch.js', 'phone-touch.js');
  assets.set('/phone-motion.js', 'phone-motion.js');
  assets.set('/place-art.js', 'place-art.js');
  assets.set('/place-targets.js', 'place-targets.js');
  assets.set('/travel-essentials.js', 'travel-essentials.js');
  assets.set('/country-currencies.js', 'country-currencies.js');
  const asset = assets.get(pathname);
  if (!asset) { response.writeHead(404); response.end('Not found'); return; }
  try {
    const body = await readFile(join(root, 'dist', asset));
    response.writeHead(200, { 'content-type': mime[extname(asset)], 'cache-control': 'no-store' });
    response.end(body);
  } catch {
    response.writeHead(500); response.end('Site unavailable');
  }
}
