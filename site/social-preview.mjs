// Previews for links shared into Elsewhere from TikTok, Instagram, YouTube and
// the web: caption, creator and cover image, plus places the caption names so
// the share screen can suggest where the video was filmed.
//
// TikTok's oEmbed no longer returns captions, so TikTok pages are read for the
// video data they embed. Instagram needs a Meta app for oEmbed; until one is
// set up it gets a plain link card. Anything else uses the generic preview.

function failure(message, status = 502) { return Object.assign(new Error(message), { status }); }

const TIKTOK = /(^|\.)tiktok\.com$/i;
const INSTAGRAM = /(^|\.)instagram\.com$/i;
const YOUTUBE = /(^|\.)(youtube\.com|youtu\.be)$/i;

// Hashtags that describe the video, not a place.
const GENERIC_TAGS = new Set(`fyp foryou foryoupage fy fypシ viral trending explore explorepage reels reel tiktok instagood
  travel traveltok travelgram travelling traveling travelvlog travelblogger traveltips travelguide travelhacks wanderlust
  vacation holiday holidays trip roadtrip weekend weekendgetaway bucketlist hiddengem hiddengems thingstodo
  food foodie foodtok foodporn eats eatwithme aesthetic vlog dayinmylife ootd summer winter spring fall autumn
  solotravel couplestravel familytravel budgettravel luxurytravel cafe coffee brunch sunset nature hiking beach
  petsoftiktok capcut xyzbca learnontiktok tiktoktravel`.split(/\s+/).filter(Boolean));

export function socialProvider(url) {
  const host = url.hostname.replace(/^www\./, '');
  if (TIKTOK.test(host)) return 'tiktok';
  if (INSTAGRAM.test(host)) return 'instagram';
  if (YOUTUBE.test(host)) return 'youtube';
  return 'web';
}

// Place names in a caption, most specific first: TikTok's location tag, then
// "📍 Name" lines, then "Location: Name", then descriptive hashtags.
export function placeCandidates(caption = '', poi = '') {
  const found = [];
  const add = value => {
    const text = String(value || '').replace(/[#@][\w.]+/g, '').replace(/[|•·,;:\-–—]+\s*$/, '').replace(/\s+/g, ' ').trim();
    if (text.length < 3 || text.length > 80) return;
    if (!found.some(entry => entry.toLowerCase() === text.toLowerCase())) found.push(text);
  };
  add(poi);
  const text = String(caption || '');
  for (const match of text.matchAll(/(?:📍|📌)\s*([^\n#📍📌]+)/gu)) add(match[1]);
  for (const match of text.matchAll(/\b(?:location|where|address)\s*[:\-]\s*([^\n#]+)/giu)) add(match[1]);
  for (const match of text.matchAll(/#([\p{L}\p{N}_]{3,40})/gu)) {
    const tag = match[1];
    if (!GENERIC_TAGS.has(tag.toLowerCase()) && !/^\d+$/.test(tag)) add(tag.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2'));
  }
  return found.slice(0, 4);
}

function decode(value) {
  return String(value || '').replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

// The video data TikTok embeds in its page for the share preview.
export function parseTikTokPage(html) {
  const script = /<script[^>]+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!script) return null;
  let data; try { data = JSON.parse(script[1]); } catch { return null; }
  const scope = data?.__DEFAULT_SCOPE__ || {};
  const item = (scope['webapp.video-detail'] || scope['webapp.reflow.video.detail'])?.itemInfo?.itemStruct;
  if (!item) return null;
  const video = item.video || {};
  const poi = item.poi || {};
  return {
    title: decode(item.desc).slice(0, 2200),
    author: item.author?.nickname || item.author?.uniqueId || '',
    handle: item.author?.uniqueId ? `@${item.author.uniqueId}` : '',
    image: video.cover || video.originCover || video.shareCover?.[0] || '',
    poi: [poi.name, poi.city].filter(Boolean).join(', '),
  };
}

export function createSocialPreview({ request = fetch, places, genericPreview, now = Date.now } = {}) {
  const cache = new Map();

  async function page(url, accept = 'text/html') {
    const response = await request(url, { headers: { 'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1', accept }, redirect: 'follow', signal: AbortSignal.timeout(7000) });
    if (!response.ok) throw failure('This video could not be reached.');
    return response;
  }

  async function tiktok(url) {
    const response = await page(url.href);
    // Short links (vm.tiktok.com) redirect; never read a page from another site.
    if (response.url && !TIKTOK.test(new URL(response.url).hostname)) throw failure('This video could not be reached.');
    const parsed = parseTikTokPage(await response.text());
    if (!parsed) throw failure('TikTok did not return this video. It may be private or removed.');
    return { ...parsed, url: response.url || url.href };
  }

  async function youtube(url) {
    const response = await page(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url.href)}`, 'application/json');
    const data = await response.json();
    return { title: decode(data.title), author: data.author_name || '', handle: '', image: data.thumbnail_url || '', poi: '', url: url.href };
  }

  async function suggestPlaces(caption, poi, key, client) {
    if (!places || !key) return [];
    const results = [];
    for (const input of placeCandidates(caption, poi)) {
      if (results.length >= 3) break;
      try {
        const [first] = await places.autocomplete({ input, scope: 'all' }, key, client);
        if (first && !results.some(place => place.placeId === first.placeId)) results.push({ ...first, matched: input });
      } catch (error) {
        if (error.status === 429 || error.status === 503) break;
      }
    }
    return results;
  }

  async function load(url, key, client) {
    const provider = socialProvider(url);
    let base;
    if (provider === 'tiktok') base = await tiktok(url);
    else if (provider === 'youtube') base = await youtube(url);
    else if (provider === 'instagram') base = { title: '', author: '', handle: '', image: '', poi: '', url: url.href };
    else {
      const generic = genericPreview ? await genericPreview(url.href).catch(() => null) : null;
      base = { title: generic?.title || '', author: '', handle: '', image: generic?.image || '', poi: '', url: url.href };
    }
    const placesFound = await suggestPlaces(base.title, base.poi, key, client);
    return { provider, url: base.url, title: base.title, author: base.author, handle: base.handle, image: base.image, places: placesFound };
  }

  return {
    async preview(rawUrl, key, client) {
      let url;
      try { url = new URL(String(rawUrl || '').trim()); } catch { throw failure('Share a link to a video or page.', 400); }
      if (url.protocol !== 'https:' || url.username || url.password) throw failure('Share a public HTTPS link.', 400);
      const cacheKey = url.href;
      const hit = cache.get(cacheKey);
      if (hit && hit.expires > now()) return hit.promise;
      const promise = load(url, key, client);
      cache.set(cacheKey, { promise, expires: now() + 10 * 60_000 });
      if (cache.size > 300) cache.delete(cache.keys().next().value);
      try { return await promise; } catch (error) { cache.delete(cacheKey); throw error; }
    },
  };
}
