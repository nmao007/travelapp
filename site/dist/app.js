import { playMotion, revealSequence, reducedMotion } from './motion.js';
import { readTrips, saveTrip, deleteTrip, addPlace, removePlace, movePlace, addStop, moveStop, removeStop, tripStops, tripTitle, renameTrip } from './trip-store.js';
import { calendarMonth, presetRange, rangeLength, selectDateRange } from './date-range.js';
import { datesForTrip, mappedPlace, fixedItem } from './itinerary-model.js';
import { createItineraryUI } from './itinerary-ui.js';
import { mapEntries, scheduleUnassigned, googlePlaceRecord, destinationForDay } from './place-model.js';


const $ = id => document.getElementById(id);
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const state = { maps: null, places: null, markerClass: null, map: null, marker: null, stopMarkers: [], placeMarkers: [], suggestionMarkers: [], suggestions: [], selected: null, trip: null, day: 'ideas', animation: 0, config: null, pendingNearby: null, nearbyRequest: 0, photoRequest: 0, calendarRange: { start: null, end: null }, calendarYear: 0, calendarMonth: 0, routeEditing: false, planMode: 'list', workspaceView: 'itinerary', nearbyCategory: 'see', detailCooldownUntil: 0, detailCache: new Map(), imageCache: new Map(), infoWindow: null, activePlaceId: null, discoveryPlace: null, nearbyCenter: null, nearbyCache: new Map() };
const dateLabel = value => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
const dateLong = value => new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
const tripDateLabel = trip => trip.startDate && trip.endDate ? `${dateLabel(trip.startDate)} – ${dateLabel(trip.endDate)}` : 'Add dates';
const coordinates = place => ({ lat: place.latitude, lng: place.longitude });
const status = (id, text = '') => { $(id).textContent = text; };

const daysForTrip = datesForTrip;

function updateTripTitle() {
  const title = $('trip-title'), value = tripTitle(state.trip);
  if (title.dataset.title === value) return;
  title.dataset.title = value; title.replaceChildren();
  const stops = tripStops(state.trip);
  if (stops.length > 1 && !state.trip.title?.trim()) {
    for (const [index, stop] of stops.entries()) {
      if (index) title.insertAdjacentHTML('beforeend', icon('arrow'));
      const label = document.createElement('span'); label.textContent = stop.name; title.append(label);
    }
  } else title.textContent = value;
  $('destination-hero').classList.toggle('long-title', value.length > 24);
  playMotion(title, [
    { opacity: 0, clipPath: 'inset(0 0 100% 0)', transform: 'translateY(14px) rotate(-2deg)' },
    { opacity: 1, clipPath: 'inset(0)', transform: 'translateY(-2px) rotate(.3deg)', offset: .8 },
    { opacity: 1, clipPath: 'inset(0)', transform: 'none' },
  ], { duration: 700 });
}

function updateRecent() {
  const trips = readTrips();
  $('my-trips').hidden = !trips.length;
  $('trip-count').textContent = String(trips.length);
  $('recent').hidden = !trips.length;
  $('recent-items').replaceChildren();
  for (const trip of trips.slice(0, 6)) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'recent-trip';
    button.innerHTML = `${icon('pin')}<strong></strong>${icon('arrow')}`;
    button.querySelector('strong').textContent = tripTitle(trip);
    button.addEventListener('click', () => openTrip(trip));
    $('recent-items').append(button);
  }
}

function showHome({ focus = false } = {}) {
  $('trip-title-input').hidden = true; $('edit-trip-title').hidden = false;
  cancelAnimationFrame(state.animation);
  state.photoRequest++;
  state.selected = null; state.trip = null; state.infoWindow?.close(); $('place-dialog').close(); $('plan-dialog').close(); $('day-preview').close();
  $('home-view').hidden = false;
  $('workspace').hidden = true;
  $('destination').value = '';
  $('suggestions').hidden = true;
  $('suggestions').replaceChildren();
  status('home-status');
  history.replaceState(null, '', '/');
  updateRecent();
  if (focus) $('destination').focus();
}

function renderRoute() {
  const stops = tripStops(state.trip);
  const list = $('route-list'); list.replaceChildren(); list.hidden = stops.length < 2;
  for (const [index, stop] of stops.entries()) {
    const group = document.createElement('div'); group.className = 'route-stop-group';
    const select = document.createElement('button'); select.type = 'button'; select.className = 'route-stop';
    select.classList.toggle('active', state.selected?.placeId === stop.placeId);
    select.setAttribute('aria-label', `Explore ${stop.name}, stop ${index + 1} of ${stops.length}`);
    select.innerHTML = '<span class="route-index"></span><strong></strong>';
    select.querySelector('.route-index').textContent = String(index + 1).padStart(2, '0');
    select.querySelector('strong').textContent = stop.name;
    select.addEventListener('click', () => selectStop(stop));
    group.append(select);
    if (state.routeEditing) {
      const controls = document.createElement('span'); controls.className = 'route-controls';
      for (const [label, direction, disabled] of [['Earlier', -1, index === 0], ['Later', 1, index === stops.length - 1]]) {
        const button = document.createElement('button'); button.type = 'button'; button.innerHTML = icon(direction < 0 ? 'back' : 'arrow');
        button.setAttribute('aria-label', `Move ${stop.name} ${label.toLowerCase()}`); button.disabled = disabled;
        button.addEventListener('click', () => commitRoute(moveStop(state.trip, index, direction), stop.placeId)); controls.append(button);
      }
      const remove = document.createElement('button'); remove.type = 'button'; remove.innerHTML = icon('close'); remove.disabled = stops.length === 1;
      remove.setAttribute('aria-label', `Remove ${stop.name} from route`);
      remove.addEventListener('click', () => commitRoute(removeStop(state.trip, stop.placeId), state.selected?.placeId === stop.placeId ? null : state.selected?.placeId));
      controls.append(remove); group.append(controls);
      const dates = daysForTrip(state.trip);
      if (dates.length) {
        const selectDate = document.createElement('select'); selectDate.className = 'route-date'; selectDate.setAttribute('aria-label', `Arrival day in ${stop.name}`);
        const undecided = document.createElement('option'); undecided.value = ''; undecided.textContent = 'Arrival day'; selectDate.append(undecided);
        for (const date of dates) { const option = document.createElement('option'); option.value = date; option.textContent = dateLong(date); selectDate.append(option); }
        selectDate.value = stop.date || '';
        selectDate.addEventListener('change', () => commitRoute({ ...state.trip, stops: tripStops(state.trip).map(item => item.placeId === stop.placeId ? { ...item, date: selectDate.value || null } : item) }, state.selected?.placeId));
        group.append(selectDate);
      }
    }
    list.append(group);
  }
  $('edit-route').hidden = stops.length < 2;
  $('edit-route').innerHTML = icon(state.routeEditing ? 'check' : 'edit'); $('edit-route').setAttribute('aria-label', state.routeEditing ? 'Finish editing route' : 'Edit route');
}

function selectStop(stop, syncDay = true) {
  if (!stop || !state.trip) return;
  state.infoWindow?.close(); state.activePlaceId = null; state.nearbyCenter = null; $('search-map-area').hidden = true;
  if (syncDay && daysForTrip(state.trip).includes(stop.date)) state.day = stop.date;
  state.selected = stop; state.photoRequest++; state.nearbyRequest++; state.suggestions = [];
  $('nearby-results').replaceChildren();
  updateTripTitle();
  $('trip-address').textContent = stop.address || '';
  $('map-caption').textContent = stop.name;

  renderRoute(); renderPlan(); showMap(stop, true); drawMarkers();
  if (state.places?.Place) { loadDestinationPhoto(stop); exploreNearby('see'); }
  else state.pendingNearby = 'see';
}

function commitRoute(next, selectedId) {
  try {
    saveTrip(next); state.trip = next; updateRecent(); renderPlan();
    selectStop(tripStops(next).find(stop => stop.placeId === selectedId) || tripStops(next)[0]);
  } catch { status('trip-status', 'Could not save this route.'); }
}

function showWorkspace(place, trip = null) {
  $('trip-title-input').hidden = true; $('edit-trip-title').hidden = false;
  $('place-dialog').close(); $('plan-dialog').close(); $('transport-dialog').close(); $('day-preview').close();
  state.selected = place; state.trip = trip ? scheduleUnassigned(trip) : trip;
  state.infoWindow?.close(); state.activePlaceId = null; state.nearbyCenter = null; $('search-map-area').hidden = true;
  if (trip && state.trip !== trip) { saveTrip(state.trip); trip = state.trip; }
  state.photoRequest++;
  state.pendingNearby = null;
  state.nearbyRequest++;
  state.suggestions = [];
  $('nearby-results').hidden = true;
  $('nearby-results').replaceChildren();
  document.querySelectorAll('[data-nearby]').forEach(button => button.classList.remove('active'));
  $('home-view').hidden = true;
  $('workspace').hidden = false;
  updateTripTitle();
  $('trip-address').textContent = place.address || '';
  $('map-caption').textContent = place.name;
  $('trip-dates').textContent = tripDateLabel(trip);
  $('trip-menu').hidden = true;
  $('edit-date-picker').hidden = true;
  $('route-search').hidden = true;
  state.routeEditing = false;
  status('trip-status');
  $('hero-gallery').replaceChildren();
  if (trip) {
    renderRoute();
    const days = daysForTrip(trip);
    if (state.day !== 'ideas' && !days.includes(state.day)) state.day = days[0] || 'ideas';
    if (state.day === 'ideas' && days.length && !trip.items?.length) state.day = days[0];
    renderPlan(); setWorkspaceView('itinerary');
    ensureTripZone(trip);
    history.replaceState(null, '', `?trip=${encodeURIComponent(trip.id)}`);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
  showMap(place, true, true);
  if (state.places?.Place) { loadDestinationPhoto(place); exploreNearby('see'); }
  else state.pendingNearby = 'see';
}

function openTrip(trip) { showWorkspace(trip, trip); }

function createOrOpenTrip(place) {
  const existing = readTrips().find(trip => trip.placeId === place.placeId);
  if (existing) { openTrip(existing); return; }
  const trip = { id: crypto.randomUUID(), ...place, stops: [place], startDate: null, endDate: null, items: [], createdAt: new Date().toISOString() };
  try { saveTrip(trip); state.day = 'ideas'; openTrip(trip); updateRecent(); }
  catch { status('home-status', 'Could not save this trip on this device.'); }
}

function photoCredits(container, photo) {
  container.replaceChildren();
  const credits = photo?.authorAttributions || [];
  for (const credit of credits) {
    if (!credit.displayName) continue;
    const link = document.createElement('a');
    link.textContent = `Photo: ${credit.displayName}`;
    link.href = credit.uri || photo.googleMapsURI || '#';
    link.target = '_blank'; link.rel = 'noopener noreferrer';
    container.append(link);
  }
  container.hidden = !container.childNodes.length;
}

function wikimediaCredits(container, image) {
  container.replaceChildren();
  const author = document.createElement('a');
  author.textContent = `Photo: ${image.artist}`;
  author.href = image.creditUrl; author.target = '_blank'; author.rel = 'noopener noreferrer';
  container.append(author);
  if (image.license && image.licenseUrl) {
    const license = document.createElement('a');
    license.textContent = ` · ${image.license}`;
    license.href = image.licenseUrl; license.target = '_blank'; license.rel = 'noopener noreferrer';
    container.append(license);
  }
  container.hidden = false;
}

async function wikimediaImage(place, width) {
  const query = new URLSearchParams({ title: place.name, lat: String(place.latitude), lng: String(place.longitude), width: String(width) });
  const response = await fetch(`/api/place-image?${query}`, { cache: 'no-store' });
  if (!response.ok) return null;
  const data = await response.json();
  return data.image || null;
}

const heroPhotos = new Map();
async function destinationPhoto(destination) {
  const key = destination.placeId;
  if (!heroPhotos.has(key)) heroPhotos.set(key, (async () => {
    if (state.places?.Place && Date.now() >= state.detailCooldownUntil) {
      try {
        const place = new state.places.Place({ id: key });
        await place.fetchFields({ fields: ['photos'] });
        const photo = place.photos?.[0];
        if (photo) return { src: photo.getURI({ maxWidth: 1200 }), googlePhoto: photo };
      } catch (error) { notePlaceQuota(error); }
    }
    try { return await wikimediaImage(destination, 1200); } catch { return null; }
  })());
  const source = await heroPhotos.get(key);
  if (!source?.src) heroPhotos.delete(key);
  return source;
}
async function loadDestinationPhoto() {
  if (!state.trip) return;
  const gallery = $('hero-gallery'), stops = tripStops(state.trip), route = stops.map(stop => stop.placeId).join('|');
  if (gallery.dataset.route === route && gallery.childNodes.length) return;
  gallery.dataset.route = route; gallery.replaceChildren();
  for (const [index, stop] of stops.entries()) {
    const segment = document.createElement('figure'); segment.className = 'hero-segment';
    segment.style.setProperty('--segment-delay', `${Math.min(index * 90, 360)}ms`);
    const image = document.createElement('img'); image.className = 'hero-photo'; image.alt = stop.name; image.hidden = true;
    const credit = document.createElement('figcaption'); credit.className = 'hero-credit'; credit.hidden = true;
    segment.append(image, credit); gallery.append(segment);
    destinationPhoto(stop).then(source => {
      if (!source?.src || !segment.isConnected || gallery.dataset.route !== route) return;
      image.onload = () => { image.hidden = false; }; image.onerror = () => { image.hidden = true; };
      image.src = source.src;
      if (source.googlePhoto) photoCredits(credit, source.googlePhoto); else wikimediaCredits(credit, source);
    });
  }
}

function animateMap(target, zoom = 12) {
  if (!state.map) return;
  cancelAnimationFrame(state.animation);
  const to = coordinates(target);
  const fromPoint = state.map.getCenter();
  const from = fromPoint ? { lat: fromPoint.lat(), lng: fromPoint.lng() } : to;
  const fromZoom = state.map.getZoom() || 5;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { state.map.moveCamera({ center: to, zoom }); return; }
  let lngDelta = to.lng - from.lng;
  if (lngDelta > 180) lngDelta -= 360;
  if (lngDelta < -180) lngDelta += 360;
  const start = performance.now();
  const duration = 850;
  const frame = now => {
    const t = Math.min(1, (now - start) / duration);
    const ease = 1 - Math.pow(1 - t, 3);
    state.map.moveCamera({ center: { lat: from.lat + (to.lat - from.lat) * ease, lng: from.lng + lngDelta * ease }, zoom: fromZoom + (zoom - fromZoom) * ease });
    if (t < 1) state.animation = requestAnimationFrame(frame);
  };
  state.animation = requestAnimationFrame(frame);
}

function pinContent(entry) {
  const pin = document.createElement('span'); pin.className = `map-place-pin ${entry.planned ? 'planned-pin' : 'recommended-pin'}`;
  const symbol = document.createElement('span'); symbol.className = 'pin-symbol';
  symbol.innerHTML = entry.planned ? String(entry.number) : icon(entry.primaryType === 'hotel' ? 'stay' : ['restaurant', 'cafe'].includes(entry.primaryType) ? 'food' : 'pin');
  const label = document.createElement('span'); label.className = 'pin-label'; label.textContent = entry.name;
  pin.append(symbol, label); return pin;
}

function showMapEntry(entry, marker) {
  state.activePlaceId = entry.placeId || entry.id;
  animateMap(entry, 15);
  if (entry.planned) {
    const item = state.trip.items.find(item => item.placeId === entry.placeId && item.day === state.day) || state.trip.items.find(item => item.id === entry.id);
    if (item) { setWorkspaceView('itinerary'); itinerary.selectItem(item); }
  } else {
    setWorkspaceView('explore');
    const card = [...$('nearby-results').querySelectorAll('[data-place-id]')].find(card => card.dataset.placeId === entry.placeId);
    card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  document.querySelectorAll('[data-place-id]').forEach(element => element.classList.toggle('selected', element.dataset.placeId === entry.placeId));
  const content = document.createElement('div'); content.className = 'map-entry-info';
  const title = document.createElement('strong'); title.textContent = entry.name;
  const button = document.createElement('button'); button.type = 'button'; button.textContent = entry.planned ? 'Open plan' : 'View place';
  button.addEventListener('click', () => entry.planned ? itinerary.openPlan(state.trip.items.find(item => item.placeId === entry.placeId && item.day === state.day) || state.trip.items.find(item => item.id === entry.id)) : openDiscovery(entry));
  content.append(title, button);
  state.infoWindow ||= new state.maps.InfoWindow();
  state.infoWindow.setContent(content);
  state.infoWindow.open({ map: state.map, anchor: marker, shouldFocus: false });
}

function drawMarkers() {
  if (!state.map || !state.markerClass || !state.selected) return;
  if (state.marker) state.marker.map = null;
  for (const marker of [...state.stopMarkers, ...state.placeMarkers, ...state.suggestionMarkers]) marker.map = null;
  state.stopMarkers = []; state.placeMarkers = []; state.suggestionMarkers = [];
  const optional = google.maps.CollisionBehavior.OPTIONAL_AND_HIDES_LOWER_PRIORITY;
  // Planned places take priority. Suggestions for those places never get a second pin.
  for (const entry of mapEntries(state.trip?.items, state.suggestions)) {
    const marker = new state.markerClass({ map: state.map, position: coordinates(entry), title: entry.name, content: pinContent(entry), gmpClickable: true, collisionBehavior: optional, zIndex: entry.planned ? 100 : 10 });
    marker.addEventListener('gmp-click', () => showMapEntry(entry, marker));
    (entry.planned ? state.placeMarkers : state.suggestionMarkers).push(marker);
  }
}

const nearbyTypes = { see: ['tourist_attraction', 'historical_landmark', 'monument', 'museum', 'art_gallery'], eat: ['restaurant', 'cafe', 'bakery'], stay: ['hotel'], nature: ['park', 'hiking_area', 'national_park'], culture: ['museum', 'art_gallery', 'historical_landmark'] };
async function exploreNearby(category, center = null) {
  if (!state.trip || !nearbyTypes[category]) return;
  const requestId = ++state.nearbyRequest;
  state.infoWindow?.close(); state.nearbyCategory = category; state.nearbyCenter = center;
  document.querySelectorAll('[data-nearby]').forEach(button => { button.classList.toggle('active', button.dataset.nearby === category); button.setAttribute('aria-pressed', String(button.dataset.nearby === category)); });
  const container = $('nearby-results'); container.hidden = false; container.textContent = 'Finding places…';
  if (!state.places?.Place) { state.pendingNearby = category; return; }
  try {
    const searchCenter = center || coordinates(state.selected || state.trip);
    const cacheKey = `${category}:${searchCenter.lat.toFixed(4)}:${searchCenter.lng.toFixed(4)}`;
    let cached = state.nearbyCache.get(cacheKey);
    if (!cached || cached.expires < Date.now()) {
      cached = { expires: Date.now() + 5 * 60_000, promise: state.places.Place.searchNearby({
        fields: ['id', 'displayName', 'formattedAddress', 'location', 'photos', 'rating', 'userRatingCount', 'primaryType', 'primaryTypeDisplayName'],
        locationRestriction: { center: searchCenter, radius: 12000 },
        includedTypes: nearbyTypes[category], maxResultCount: 20,
        rankPreference: state.places.SearchNearbyRankPreference.POPULARITY, language: 'en'
      }) };
      state.nearbyCache.set(cacheKey, cached);
      if (state.nearbyCache.size > 60) state.nearbyCache.delete(state.nearbyCache.keys().next().value);
      cached.promise.catch(() => state.nearbyCache.delete(cacheKey));
    }
    const { places } = await cached.promise;
    if (requestId !== state.nearbyRequest) return;
    state.suggestions = (places || []).filter(place => place.id && place.location).map(googlePlaceRecord);
    renderRecommendations(); drawMarkers();
  } catch {
    if (requestId !== state.nearbyRequest) return;
    container.textContent = 'Could not load places. Try another category or search.';
    state.suggestions = []; drawMarkers();
  }
}

function addToDay(place) {
  if (!state.trip) return;
  const days = daysForTrip(state.trip);
  if (!days.length) { $('place-dialog').close(); openCalendar(); $('save-dates').focus({ preventScroll: true }); status('trip-status', 'Choose a day for your trip first.'); return; }
  if (!days.includes(state.day)) state.day = days[0];
  // Live Google content stays in memory; only itinerary choices and the place ID are saved.
  const item = { placeId: place.placeId, name: place.name, address: place.address, latitude: place.latitude, longitude: place.longitude, day: state.day, timeZone: state.selected?.timeZone || state.trip.timeZone, kind: place.primaryType === 'hotel' ? 'Stay' : ['restaurant', 'cafe', 'bakery'].includes(place.primaryType) ? 'Food' : 'Activity' };
  const next = addPlace(state.trip, item);
  if (next === state.trip) { status('trip-status', 'Already on this day.'); return; }
  try { state.infoWindow?.close(); commitTrip(next); animateMap(place, 15); status('trip-status', `Added to ${dateLong(state.day)}`); syncDiscovery(); }
  catch { status('trip-status', 'Could not save this place.'); }
}

async function fallbackPlacePhoto(container, record, className = 'detail-photo') {
  const key = `${record.placeId}:photo`;
  if (!state.imageCache.has(key)) state.imageCache.set(key, wikimediaImage(record, 800).catch(() => null));
  const photo = await state.imageCache.get(key);
  if (!photo || !container.isConnected || container.dataset.photoPlace !== record.placeId) return;
  if (className === 'detail-photo' && container.dataset.fallbackDescription === 'true' && photo.description && !container.querySelector('.place-description')) {
    const text = document.createElement('p'); text.className = 'place-description'; text.textContent = photo.description;
    const source = document.createElement('a'); source.className = 'description-source'; source.textContent = 'Wikipedia'; source.href = photo.descriptionUrl; source.target = '_blank'; source.rel = 'noopener noreferrer';
    container.append(text, source);
  }
  if (!photo.src) return;
  const figure = document.createElement('figure'); figure.className = className;
  const image = document.createElement('img'); image.alt = record.name; image.loading = 'lazy'; image.src = photo.src;
  const credit = document.createElement('figcaption'); wikimediaCredits(credit, photo);
  figure.append(image);
  if (className === 'recommendation-fallback-photo') { credit.className = 'photo-credit'; container.closest('.recommendation-card')?.append(credit); }
  else figure.append(credit);
  container.prepend(figure);
}
const photoObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    photoObserver.unobserve(entry.target);
    const record = state.suggestions.find(place => place.placeId === entry.target.dataset.photoPlace);
    if (record) fallbackPlacePhoto(entry.target, record, 'recommendation-fallback-photo');
  }
}, { rootMargin: '150px' });

const recommendationMotion = new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) { recommendationMotion.unobserve(entry.target); revealSequence([entry.target]); }
}, { threshold: .15 });
function renderRecommendations() {
  recommendationMotion.disconnect();
  const container = $('nearby-results'); photoObserver.disconnect(); container.replaceChildren();
  if (!state.suggestions.length) { container.textContent = 'No places found here. Try another category or area.'; return; }
  for (const place of state.suggestions) {
    const row = document.createElement('article'); row.className = 'recommendation-card'; row.dataset.placeId = place.placeId;
    const open = document.createElement('button'); open.type = 'button'; open.className = 'recommendation-open'; open.setAttribute('aria-label', `View ${place.name}`);
    const photo = document.createElement('div'); photo.className = 'recommendation-photo';
    if (place.photo) {
      const image = document.createElement('img'); image.alt = ''; image.loading = 'lazy'; image.src = place.photo.getURI({ maxWidth: 420 }); photo.append(image);
      const credit = document.createElement('span'); credit.className = 'photo-credit'; photoCredits(credit, place.photo); if (!credit.hidden) row.append(credit);
    } else { photo.innerHTML = icon(place.primaryType === 'hotel' ? 'stay' : ['restaurant', 'cafe'].includes(place.primaryType) ? 'food' : 'pin'); }
    const copy = document.createElement('span'); copy.className = 'recommendation-copy';
    const title = document.createElement('strong'); title.textContent = place.name;
    const meta = document.createElement('span'); meta.className = 'recommendation-meta';
    meta.textContent = [Number.isFinite(place.rating) ? `${place.rating.toFixed(1)}${place.ratingCount ? ` (${place.ratingCount.toLocaleString()})` : ''}` : '', place.category].filter(Boolean).join(' · ');
    if (Number.isFinite(place.rating)) meta.insertAdjacentHTML('afterbegin', icon('star')); copy.append(title, meta); open.append(photo, copy);
    open.addEventListener('click', () => { animateMap(place, 15); openDiscovery(place); });
    const add = document.createElement('button'); add.type = 'button'; add.className = 'recommendation-add'; add.innerHTML = icon('plus'); add.setAttribute('aria-label', `Add ${place.name} to day`); add.addEventListener('click', () => addToDay(place));
    row.append(open, add); container.append(row); recommendationMotion.observe(row);
    if (!place.photo) { photo.dataset.photoPlace = place.placeId; photoObserver.observe(photo); }
  }

  syncSuggestionCards();
}

function notePlaceQuota(error) {
  if (/RESOURCE_EXHAUSTED|quota exceeded/i.test(String(error.message || error))) { state.detailCooldownUntil = Date.now() + 30 * 60_000; return true; }
  return false;
}
async function detailedGooglePlace(record) {
  if (!state.places?.Place) throw new Error('Google Maps unavailable');
  const cached = state.detailCache.get(record.placeId);
  if (cached) return cached;
  if (Date.now() < state.detailCooldownUntil) throw new Error('PLACE_DETAILS_QUOTA');
  const promise = (async () => {
    const place = new state.places.Place({ id: record.placeId, requestedLanguage: 'en' });
    await place.fetchFields({ fields: ['id', 'displayName', 'formattedAddress', 'location', 'photos', 'rating', 'userRatingCount', 'primaryType', 'primaryTypeDisplayName', 'regularOpeningHours', 'currentOpeningHours', 'websiteURI', 'internationalPhoneNumber', 'googleMapsURI', 'businessStatus', 'editorialSummary', 'priceLevel', 'accessibilityOptions', 'attributions'] });
    return place;
  })();
  state.detailCache.set(record.placeId, promise);
  try { return await promise; } catch (error) { state.detailCache.delete(record.placeId); if (notePlaceQuota(error)) throw new Error('PLACE_DETAILS_QUOTA'); throw error; }
}

async function hydratePlace(container, record) {
  const request = crypto.randomUUID(); container.dataset.request = request; container.dataset.photoPlace = record.placeId; delete container.dataset.fallbackDescription;
  container.replaceChildren();
  const loading = document.createElement('p'); loading.className = 'detail-loading'; loading.textContent = 'Loading place details…'; container.append(loading);
  try {
    const place = await detailedGooglePlace(record);
    if (!container.isConnected || container.dataset.request !== request) return;
    container.replaceChildren(); container.dataset.photoPlace = record.placeId;
    if (place.photos?.[0]) {
      const figure = document.createElement('figure'); figure.className = 'detail-photo';
      const image = document.createElement('img'); image.alt = place.displayName || record.name; image.loading = 'lazy'; image.src = place.photos[0].getURI({ maxWidth: 900 });
      const credit = document.createElement('figcaption'); photoCredits(credit, place.photos[0]); figure.append(image, credit); container.append(figure);
    } else fallbackPlacePhoto(container, { ...record, name: place.displayName || record.name }).catch(() => {});
    const meta = document.createElement('p'); meta.className = 'detail-rating';
    meta.textContent = [Number.isFinite(place.rating) ? `${place.rating.toFixed(1)}${place.userRatingCount ? ` · ${place.userRatingCount.toLocaleString()} reviews` : ''}` : '', place.primaryTypeDisplayName].filter(Boolean).join(' · ');
    if (meta.textContent) { if (Number.isFinite(place.rating)) meta.insertAdjacentHTML('afterbegin', icon('star')); container.append(meta); }
    if (place.editorialSummary) { const description = document.createElement('p'); description.className = 'place-description'; description.textContent = place.editorialSummary; container.append(description); }
    if (place.businessStatus && place.businessStatus !== 'OPERATIONAL') { const closed = document.createElement('p'); closed.className = 'closed-status'; closed.textContent = place.businessStatus === 'CLOSED_PERMANENTLY' ? 'Permanently closed' : 'Temporarily closed'; container.append(closed); }
    if (place.formattedAddress) { const address = document.createElement('p'); address.className = 'place-address'; address.textContent = place.formattedAddress; container.append(address); }
    const descriptions = place.currentOpeningHours?.weekdayDescriptions || place.regularOpeningHours?.weekdayDescriptions;
    if (descriptions?.length) {
      const hours = document.createElement('details'); hours.className = 'place-hours'; const title = document.createElement('summary'); title.innerHTML = icon('clock'); title.append(document.createTextNode('Opening hours')); hours.append(title);
      for (const text of descriptions) { const line = document.createElement('p'); line.textContent = text; hours.append(line); } container.append(hours);
    }
    const links = document.createElement('div'); links.className = 'place-links';
    for (const [label, url] of [['Website', place.websiteURI], ['Directions', place.googleMapsURI], [place.internationalPhoneNumber, place.internationalPhoneNumber ? `tel:${place.internationalPhoneNumber}` : null]]) {
      if (!url || !label || !/^(https?:|tel:)/i.test(url)) continue;
      const link = document.createElement('a'); link.innerHTML = icon(url.startsWith('tel:') ? 'phone' : label === 'Directions' ? 'directions' : 'external'); link.append(document.createTextNode(label)); link.href = url; link.className = 'detail-chip'; if (!url.startsWith('tel:')) { link.target = '_blank'; link.rel = 'noopener noreferrer'; } links.append(link);
    }
    container.append(links);
    const features = document.createElement('div'); features.className = 'place-features';
    if (place.priceLevel) { const price = document.createElement('span'); price.textContent = String(place.priceLevel).replaceAll('_', ' ').toLowerCase(); features.append(price); }
    if (place.accessibilityOptions?.hasWheelchairAccessibleEntrance === true) { const accessible = document.createElement('span'); accessible.textContent = 'Step-free entrance'; features.append(accessible); }
    if (features.childNodes.length) container.append(features);
    for (const provider of place.attributions || []) { if (!/^https?:/i.test(provider.providerURI || '')) continue; const link = document.createElement('a'); link.className = 'provider-credit'; link.href = provider.providerURI; link.textContent = provider.provider; link.target = '_blank'; link.rel = 'noopener noreferrer'; container.append(link); }
  } catch (failure) {
    if (!container.isConnected || container.dataset.request !== request) return;
    container.replaceChildren();
    const available = state.suggestions.find(place => place.placeId === record.placeId) || record;
    const rating = document.createElement('p'); rating.className = 'detail-rating';
    if (Number.isFinite(available.rating)) { rating.innerHTML = icon('star'); rating.append(document.createTextNode(`${available.rating.toFixed(1)}${available.ratingCount ? ` · ${available.ratingCount.toLocaleString()} reviews` : ''}`)); }
    if (available.category) rating.append(document.createTextNode(`${rating.textContent ? ' · ' : ''}${available.category}`));
    if (rating.childNodes.length) container.append(rating);
    container.dataset.fallbackDescription = 'true';
    fallbackPlacePhoto(container, { ...record, name: available.name || record.name }).catch(() => {});
    if (record.address) { const address = document.createElement('p'); address.className = 'place-address'; address.textContent = record.address; container.append(address); }
    const links = document.createElement('div'); links.className = 'place-links';
    const directions = document.createElement('a'); directions.className = 'detail-chip'; directions.innerHTML = icon('directions'); directions.append(document.createTextNode('Directions')); directions.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(record.name)}&query_place_id=${encodeURIComponent(record.placeId)}`; directions.target = '_blank'; directions.rel = 'noopener noreferrer'; links.append(directions); container.append(links);
  }
}

function syncDiscovery() {
  const place = state.discoveryPlace;
  if (!place || !$('place-dialog').open) return;
  const chips = $('discovery-day-chips'); chips.replaceChildren();
  for (const day of daysForTrip(state.trip)) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'detail-chip'; button.textContent = dateLong(day); button.setAttribute('aria-pressed', String(state.day === day));
    button.addEventListener('click', () => { state.day = day; renderPlan(); syncDiscovery(); }); chips.append(button);
  }
  const saved = state.trip?.items?.some(item => item.placeId === place.placeId && item.day === state.day);
  $('add-discovery-place').disabled = Boolean(saved); $('add-discovery-place').textContent = saved ? 'Added to this day' : daysForTrip(state.trip).length ? `Add to ${dateLabel(state.day)}` : 'Choose dates';
}
function openDiscovery(place) {
  state.discoveryPlace = place; $('place-dialog-title').textContent = place.name; $('place-dialog-status').textContent = '';
  $('place-dialog').showModal(); hydratePlace($('discovery-place-details'), place); syncDiscovery();
}
$('add-discovery-place').addEventListener('click', () => { addToDay(state.discoveryPlace); syncDiscovery(); });
$('search-map-area').addEventListener('click', () => { const center = state.map.getCenter(); setWorkspaceView('explore'); exploreNearby(state.nearbyCategory, { lat: center.lat(), lng: center.lng() }); $('search-map-area').hidden = true; });

function showMap(place, fly = false) {
  if (!state.maps) return;
  if (!state.map) {
    state.map = new state.maps.Map($('map'), { center: coordinates(place), zoom: 5, mapId: state.config?.mapId || 'DEMO_MAP_ID', gestureHandling: 'greedy', mapTypeControl: false, streetViewControl: false, fullscreenControl: false, clickableIcons: true, zoomControl: true, cameraControl: false });
    $('map-loading').hidden = true;
    state.map.addListener('dragend', () => { $('search-map-area').hidden = false; });
    state.map.addListener('click', async event => {
      if (!event.placeId) return;
      event.stop();
      try {
        const place = await detailedGooglePlace({ placeId: event.placeId });
        const record = googlePlaceRecord(place); const item = state.trip?.items?.find(item => item.placeId === record.placeId && item.day === state.day) || state.trip?.items?.find(item => item.placeId === record.placeId);
        if (item) { setWorkspaceView('itinerary'); itinerary.selectItem(item); itinerary.openPlan(item); }
        else openDiscovery(record);
      } catch { status('trip-status', 'Could not open this map location.'); }
    });
  }
  // The map container was hidden on the start screen; allow layout to settle before moving its camera.
  requestAnimationFrame(() => {
    google.maps.event.trigger(state.map, 'resize');
    if (fly) animateMap(place);
    else state.map.moveCamera({ center: coordinates(place), zoom: 12 });
    drawMarkers();
  });
}

function renderPlan() { itinerary.render(); syncSuggestionCards(); updateTripTitle(); $('trip-heading').setAttribute('aria-label', tripTitle(state.trip)); }

function syncSuggestionCards() {
  for (const card of $('nearby-results').querySelectorAll('.recommendation-card')) {
    const saved = state.trip?.items?.some(item => item.placeId === card.dataset.placeId && item.day === state.day);
    card.classList.toggle('added', Boolean(saved));
    const button = card.querySelector('.recommendation-add'); button.disabled = Boolean(saved);
    const name = card.querySelector('strong')?.textContent;
    button.setAttribute('aria-label', saved ? `${name} added to this day` : `Add ${name} to day`);
    const wasSaved = button.dataset.saved === 'true'; button.dataset.saved = String(Boolean(saved));
    button.classList.toggle('just-added', Boolean(saved) && !wasSaved); button.innerHTML = icon(saved ? 'check' : 'plus');
  }
}

function setupAutocomplete(inputId, listId, onSelect, biasToTrip = false) {
  const input = $(inputId), list = $(listId);
  let timer, requestId = 0, token = null;
  const hide = () => { list.hidden = true; list.replaceChildren(); input.setAttribute('aria-expanded', 'false'); };
  async function search(query, id) {
    if (!state.places) { status(inputId === 'destination' ? 'home-status' : 'trip-status', 'Search is unavailable right now.'); return; }
    try {
      token ||= new state.places.AutocompleteSessionToken();
      const request = { input: query, sessionToken: token, language: 'en' };
      if (inputId === 'destination' || inputId === 'stop-search') request.includedPrimaryTypes = ['(regions)'];
      if (biasToTrip && state.trip) request.locationBias = { center: coordinates(state.selected || state.trip), radius: 50000 };
      const { suggestions } = await state.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
      if (id !== requestId || input.value.trim() !== query) return;
      list.replaceChildren();
      for (const suggestion of suggestions || []) {
        const prediction = suggestion.placePrediction;
        if (!prediction) continue;
        const button = document.createElement('button'); button.type = 'button'; button.className = 'suggestion'; button.setAttribute('role', 'option');
        button.innerHTML = `<span class="suggestion-icon">${icon('pin')}</span><span class="suggestion-copy"><strong></strong><small></small></span>${icon('arrow')}`;
        button.querySelector('strong').textContent = prediction.mainText?.toString() || prediction.text?.toString() || '';
        button.querySelector('small').textContent = prediction.secondaryText?.toString() || '';
        button.addEventListener('click', async () => {
          hide();
          try {
            let selected;
            try {
              if (Date.now() < state.detailCooldownUntil) throw new Error('PLACE_DETAILS_QUOTA');
              const place = prediction.toPlace();
              await place.fetchFields({ fields: ['id', 'displayName', 'formattedAddress', 'location'] });
              if (!place.id || !place.location) throw new Error('No map location');
              selected = { placeId: place.id, name: place.displayName || prediction.mainText?.toString() || '', address: place.formattedAddress || '', latitude: place.location.lat(), longitude: place.location.lng() };
            } catch (error) {
              notePlaceQuota(error);
              // Geocoding has a separate quota; resolve the exact Google prediction ID, never a guessed city center.
              const { Geocoder } = await google.maps.importLibrary('geocoding');
              const { results } = await new Geocoder().geocode({ placeId: prediction.placeId });
              const result = results?.[0];
              if (!result?.geometry?.location || !result.place_id) throw new Error('No map location');
              selected = { placeId: result.place_id, name: prediction.mainText?.toString() || result.formatted_address, address: result.formatted_address, latitude: result.geometry.location.lat(), longitude: result.geometry.location.lng() };
            }
            input.value = ['departure-search', 'arrival-search'].includes(inputId) ? selected.name : ''; token = null;
            await onSelect(selected);
            status(inputId === 'destination' ? 'home-status' : 'trip-status');
          } catch (error) {
            const serviceUnavailable = Date.now() < state.detailCooldownUntil || /REQUEST_DENIED|OVER_QUERY_LIMIT/.test(error?.message || '');
            status(inputId === 'destination' ? 'home-status' : 'trip-status', serviceUnavailable ? 'Destination lookup is unavailable. Check Google Maps billing and quotas.' : 'Could not open that place. Try another result.');
          }
        });
        list.append(button);
      }
      list.hidden = !list.children.length;
      input.setAttribute('aria-expanded', String(!list.hidden));
    } catch { if (id === requestId) { hide(); status(inputId === 'destination' ? 'home-status' : 'trip-status', 'Search is unavailable right now.'); } }
  }
  input.addEventListener('input', () => {
    clearTimeout(timer); const query = input.value.trim(); const id = ++requestId;
    if (query.length < 2) { hide(); return; }
    timer = setTimeout(() => search(query, id), 160);
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Escape') hide();
    if ((event.key === 'ArrowDown' || event.key === 'Enter') && !list.hidden) { event.preventDefault(); list.querySelector('button')?.focus(); if (event.key === 'Enter') list.querySelector('button')?.click(); }
  });
  list.addEventListener('keydown', event => {
    const buttons = [...list.querySelectorAll('button')], index = buttons.indexOf(document.activeElement);
    if (event.key === 'ArrowDown') { event.preventDefault(); buttons[Math.min(index + 1, buttons.length - 1)]?.focus(); }
    if (event.key === 'ArrowUp') { event.preventDefault(); index <= 0 ? input.focus() : buttons[index - 1]?.focus(); }
    if (event.key === 'Escape') { hide(); input.focus(); }
  });
  document.addEventListener('pointerdown', event => { if (!list.contains(event.target) && event.target !== input) hide(); });
}

function commitTrip(next) {
  state.infoWindow?.close();
  next = scheduleUnassigned(next); saveTrip(next); state.trip = next; renderPlan(); drawMarkers(); updateRecent();
}
function setWorkspaceView(view) {
  state.workspaceView = view;
  $('plan-controls').dataset.view = view;
  $('plan-panel').hidden = view !== 'itinerary';
  $('discover-panel').hidden = view !== 'explore';
  $('transport-panel').hidden = view !== 'transportation';
  $('map-column').hidden = view === 'transportation';
  for (const button of document.querySelectorAll('[data-workspace-view]')) button.setAttribute('aria-pressed', String(button.dataset.workspaceView === view));
  if (view !== 'transportation' && state.map) requestAnimationFrame(() => google.maps.event.trigger(state.map, 'resize'));
  renderPlan();
  const panel = view === 'explore' ? $('discover-panel') : view === 'transportation' ? $('transport-panel') : $('plan-panel');
  revealSequence([...panel.children].filter(child => !child.hidden), { step: 35 });
}
async function placeZone(place) {
  const response = await fetch(`/api/timezone?lat=${place.latitude}&lng=${place.longitude}`, { signal: AbortSignal.timeout(8000) });
  if (!response.ok) return null;
  return (await response.json()).timeZone;
}
async function ensureTripZone(trip) {
  if (trip.timeZone) return;
  try {
    const timeZone = await placeZone(trip);
    if (!timeZone || state.trip?.id !== trip.id) return;
    const next = { ...state.trip, timeZone, stops: tripStops(state.trip).map(stop => stop.placeId === trip.placeId ? { ...stop, timeZone } : stop) };
    commitTrip(next);
    if (state.selected?.placeId === trip.placeId) state.selected = { ...state.selected, timeZone };
  } catch { /* The transport editor always lets the traveler confirm the zone. */ }
}
function updateDayContext(day) {
  const stop = destinationForDay(state.trip, tripStops(state.trip), day);
  if (stop && stop.placeId !== state.selected?.placeId) selectStop(stop, false);
}
const itinerary = createItineraryUI({ state, commit: commitTrip,
  explore: () => { updateDayContext(state.day); setWorkspaceView('explore'); },
  onDayChange: updateDayContext,
  onModeChange: mode => { if ($('plan-controls').dataset.mode === mode) return; $('plan-controls').dataset.mode = mode; if (state.map) requestAnimationFrame(() => google.maps.event.trigger(state.map, 'resize')); },
  chooseDates: () => { $('edit-date-picker').hidden = true; openCalendar(); $('save-dates').focus({ preventScroll: true }); },
  focusPlace: place => { animateMap(place, 15); document.querySelectorAll('[data-place-id]').forEach(element => element.classList.toggle('selected', element.dataset.placeId === place.placeId)); }, hydratePlace, icon });
for (const button of document.querySelectorAll('[data-workspace-view]')) button.addEventListener('click', () => setWorkspaceView(button.dataset.workspaceView));
for (const leg of ['departure', 'arrival']) {
  $(`${leg}-search`).addEventListener('input', event => { delete event.target.dataset.placeId; });
  setupAutocomplete(`${leg}-search`, `${leg}-suggestions`, async place => {
  const form = $('transport-form'); form.elements[`${leg}_location`].value = place.name;
  const selectedPlaceId = place.placeId; form.elements[`${leg}_location`].dataset.placeId = selectedPlaceId;
  const version = form.dataset.version, previousZone = form.elements[`${leg}_time_zone`].value;
  form.dataset.pendingZones = String(Number(form.dataset.pendingZones || 0) + 1); form.querySelector('[type="submit"]').disabled = true;
  try {
    const timeZone = await placeZone(place);
    if (version === form.dataset.version && timeZone && form.elements[`${leg}_location`].dataset.placeId === selectedPlaceId && form.elements[`${leg}_time_zone`].value === previousZone) form.elements[`${leg}_time_zone`].value = timeZone;
  } catch { /* Keep the editable time zone. */ }
  finally { if (version === form.dataset.version) { form.dataset.pendingZones = String(Math.max(0, Number(form.dataset.pendingZones) - 1)); form.querySelector('[type="submit"]').disabled = Number(form.dataset.pendingZones) > 0; } }
  });
}
setupAutocomplete('destination', 'suggestions', createOrOpenTrip);
setupAutocomplete('plan-location-search', 'plan-location-suggestions', place => { itinerary.attachPlace(place); animateMap(place, 15); }, true);
setupAutocomplete('place-search', 'place-suggestions', place => { animateMap(place, 15); openDiscovery(place); }, true);
setupAutocomplete('stop-search', 'stop-suggestions', async place => {
  if (!state.trip) return;
  try {
    const tripId = state.trip.id;
    try { place.timeZone = await placeZone(place); } catch {}
    if (state.trip?.id !== tripId) return;
    const next = addStop(state.trip, place);
    if (next === state.trip) { status('trip-status', 'That destination is already on this trip.'); return; }
    saveTrip(next); state.trip = next; updateRecent(); $('route-search').hidden = true;
    selectStop(place); status('trip-status', `Added ${place.name} to the route`);
  } catch (error) { status('trip-status', error.message || 'Could not add this stop.'); }
});

$('back-button').addEventListener('click', () => showHome());
$('mobile-back').addEventListener('click', () => showHome());
$('my-trips').addEventListener('click', () => showHome());
$('add-stop').addEventListener('click', () => { $('route-search').hidden = !$('route-search').hidden; if (!$('route-search').hidden) $('stop-search').focus(); });
$('edit-route').addEventListener('click', () => { state.routeEditing = !state.routeEditing; renderRoute(); });
function renderCalendar() {
  const { start, end } = state.calendarRange;
  $('date-summary').innerHTML = `<span><small>DEPART</small><strong>${start ? dateLong(start) : 'Choose a day'}</strong></span>${icon('arrow')}<span><small>RETURN</small><strong>${end ? dateLong(end) : start ? 'Choose a day' : '—'}</strong></span>`;
  const month = new Date(Date.UTC(state.calendarYear, state.calendarMonth, 1));
  $('calendar-month').textContent = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(month);
  const grid = $('calendar-grid'); grid.replaceChildren();
  for (const label of ['M', 'T', 'W', 'T', 'F', 'S', 'S']) {
    const heading = document.createElement('span'); heading.className = 'calendar-weekday'; heading.textContent = label; heading.setAttribute('aria-hidden', 'true'); grid.append(heading);
  }
  for (const date of calendarMonth(state.calendarYear, state.calendarMonth)) {
    if (!date) { const blank = document.createElement('span'); grid.append(blank); continue; }
    const button = document.createElement('button'); button.type = 'button'; button.textContent = String(Number(date.slice(-2)));
    button.setAttribute('aria-label', new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)));
    button.setAttribute('aria-pressed', String(date === start || date === end));
    if (date === start || date === end) button.classList.add('selected');
    if (start && end && date > start && date < end) button.classList.add('in-range');
    button.addEventListener('click', () => { state.calendarRange = selectDateRange(state.calendarRange, date); $('calendar-message').replaceChildren(); renderCalendar(); });
    grid.append(button);
  }
  $('save-dates').disabled = !start || !end;
}
function openCalendar() {
  const picker = $('edit-date-picker');
  if (!picker.hidden) { picker.hidden = true; return; }
  state.calendarRange = { start: state.trip?.startDate || null, end: state.trip?.endDate || null };
  const focusDate = state.calendarRange.start ? new Date(`${state.calendarRange.start}T12:00:00Z`) : new Date();
  state.calendarYear = focusDate.getUTCFullYear(); state.calendarMonth = focusDate.getUTCMonth();
  $('calendar-message').replaceChildren(); renderCalendar(); picker.hidden = false;
  picker.style.left = '16px'; picker.style.right = 'auto'; picker.style.top = '16px';
  const trigger = $('edit-dates').getBoundingClientRect(), rect = picker.getBoundingClientRect();
  picker.style.left = `${Math.max(16, Math.min(innerWidth - rect.width - 16, trigger.left))}px`;
  picker.style.top = `${Math.max(16, Math.min(innerHeight - rect.height - 16, trigger.bottom + 10))}px`;
}
$('edit-dates').addEventListener('click', openCalendar);
function saveDates(startDate, endDate, moveOutside = false) {
  if (!state.trip) return;
  if (Boolean(startDate) !== Boolean(endDate) || (startDate && endDate < startDate) || (startDate && rangeLength(startDate, endDate) > 366)) {
    $('calendar-message').textContent = 'Choose a range of up to one year.'; return;
  }
  const validDays = daysForTrip({ startDate, endDate });
  const outside = (state.trip.items || []).filter(item => item.day !== 'ideas' && !validDays.includes(item.day));
  if ((state.trip.transport || []).some(segment => !validDays.includes(segment.departure_date) || !validDays.includes(segment.arrival_date)) || outside.some(fixedItem)) {
    $('calendar-message').textContent = 'These dates exclude fixed plans. Edit their dates first.'; return;
  }
  if (outside.length && !moveOutside) {
    const message = $('calendar-message'); message.replaceChildren();
    const label = document.createElement('span'); label.textContent = `${outside.length} planned ${outside.length === 1 ? 'place falls' : 'places fall'} outside these dates.`;
    const button = document.createElement('button'); button.type = 'button'; button.textContent = validDays.length ? `Move to ${dateLabel(validDays[0])}` : 'Keep plans until dates are chosen';
    button.addEventListener('click', () => saveDates(startDate, endDate, true));
    message.append(label, button); return;
  }
  const items = (state.trip.items || []).map(item => item.day === 'ideas' || validDays.includes(item.day) ? item : { ...item, day: validDays[0] || 'ideas' });
  const next = { ...state.trip, startDate, endDate, items, stops: tripStops(state.trip).map(stop => ({ ...stop, date: validDays.includes(stop.date) ? stop.date : null })) };
  try { const scheduled = scheduleUnassigned(next); saveTrip(scheduled); state.trip = scheduled; state.day = validDays[0] || 'ideas'; $('edit-date-picker').hidden = true; $('trip-dates').textContent = tripDateLabel(next); renderPlan(); status('trip-status'); }
  catch { $('calendar-message').textContent = 'Could not save dates on this device.'; }
}
$('save-dates').addEventListener('click', () => saveDates(state.calendarRange.start, state.calendarRange.end));
$('clear-dates').addEventListener('click', () => { $('edit-date-picker').hidden = true; $('edit-dates').focus(); });
document.querySelectorAll('[data-date-preset]').forEach(button => button.addEventListener('click', () => {
  const range = presetRange(button.dataset.datePreset);
  if (range) saveDates(range.start, range.end);
}));
function moveCalendarMonth(delta) {
  const date = new Date(Date.UTC(state.calendarYear, state.calendarMonth + delta, 1));
  state.calendarYear = date.getUTCFullYear(); state.calendarMonth = date.getUTCMonth(); renderCalendar();
}
$('previous-month').addEventListener('click', () => moveCalendarMonth(-1));
$('next-month').addEventListener('click', () => moveCalendarMonth(1));
$('trip-menu-button').addEventListener('click', () => { $('trip-menu').hidden = !$('trip-menu').hidden; $('delete-trip').textContent = 'Delete trip'; $('delete-trip').dataset.confirm = 'false'; });
document.querySelectorAll('[data-nearby]').forEach(button => button.addEventListener('click', () => exploreNearby(button.dataset.nearby)));
$('delete-trip').addEventListener('click', event => {
  if (!state.trip) return;
  if (event.currentTarget.dataset.confirm !== 'true') { event.currentTarget.dataset.confirm = 'true'; event.currentTarget.textContent = 'Confirm delete'; return; }
  deleteTrip(state.trip.id); event.currentTarget.dataset.confirm = 'false'; showHome();
});

document.addEventListener('keydown', event => {
  if (event.altKey && event.shiftKey && event.code === 'KeyM' && window.parent !== window) {
    event.preventDefault(); window.parent.postMessage('trippilot-toggle-preview', location.origin);
  }
});

updateRecent();
const tripId = new URLSearchParams(location.search).get('trip');
const current = readTrips().find(trip => trip.id === tripId);
if (current) openTrip(current);
fetch('/api/config', { cache: 'no-store' })
  .then(response => response.ok ? response.json() : Promise.reject())
  .then(async config => {
    state.config = config;
    if (!config.mapsKey) throw new Error('Map unavailable');
    await new Promise((resolve, reject) => {
      const callback = `tripPilotReady${Date.now()}`;
      const timeout = setTimeout(() => { delete window[callback]; reject(new Error('Maps timed out')); }, 12000);
      window[callback] = () => { clearTimeout(timeout); delete window[callback]; resolve(); };
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(config.mapsKey)}&v=weekly&loading=async&language=en&callback=${callback}`;
      script.async = true; script.onerror = () => { clearTimeout(timeout); reject(new Error('Maps could not load')); };
      document.head.append(script);
    });
    const [maps, places, marker] = await Promise.all([google.maps.importLibrary('maps'), google.maps.importLibrary('places'), google.maps.importLibrary('marker')]);
    state.maps = maps; state.places = places; state.markerClass = marker.AdvancedMarkerElement;
    if (state.selected) { showMap(state.selected, true, true); loadDestinationPhoto(state.selected); }
    if (state.pendingNearby) { const category = state.pendingNearby; state.pendingNearby = null; exploreNearby(category); }
  })
  .catch(() => { status('home-status', 'Place search is unavailable right now.'); $('map-loading').textContent = 'Map unavailable'; if (state.pendingNearby) $('nearby-results').textContent = 'Suggestions are unavailable right now.'; });

let cancellingTitle = false;
$('edit-trip-title').addEventListener('click', () => {
  $('trip-title-input').value = tripTitle(state.trip); $('edit-trip-title').hidden = true; $('trip-title-input').hidden = false;
  $('trip-title-input').focus(); $('trip-title-input').select();
});
function finishTitle(cancel = false) {
  if ($('trip-title-input').hidden) return;
  if (!cancel) {
    try { commitTrip(renameTrip(state.trip, $('trip-title-input').value)); status('trip-status'); }
    catch (error) { status('trip-status', error.message); $('trip-title-input').focus(); return; }
  }
  $('trip-title-input').hidden = true; $('edit-trip-title').hidden = false;
}
$('trip-title-input').addEventListener('blur', () => { if (!cancellingTitle) finishTitle(); });
$('trip-title-input').addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === 'Escape') { event.preventDefault(); cancellingTitle = event.key === 'Escape'; finishTitle(cancellingTitle); $('edit-trip-title').focus(); cancellingTitle = false; }
});
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('edit-date-picker').hidden) { $('edit-date-picker').hidden = true; $('edit-dates').focus(); } });
document.addEventListener('pointerdown', event => {
  if (!$('edit-date-picker').hidden && !$('edit-date-picker').contains(event.target) && !$('edit-dates').contains(event.target)) $('edit-date-picker').hidden = true;
  if (!$('trip-menu').hidden && !$('trip-menu').contains(event.target) && !$('trip-menu-button').contains(event.target)) $('trip-menu').hidden = true;
});

// A small photographic camera shift responds to the pointer; controls themselves stay still.
const hero = $('destination-hero'); let heroPointerFrame = 0;
hero.addEventListener('pointermove', event => {
  if (reducedMotion() || event.pointerType !== 'mouse') return;
  cancelAnimationFrame(heroPointerFrame);
  heroPointerFrame = requestAnimationFrame(() => {
    const rect = hero.getBoundingClientRect();
    hero.style.setProperty('--photo-x', `${((event.clientX - rect.left) / rect.width - .5) * 10}px`);
    hero.style.setProperty('--photo-y', `${((event.clientY - rect.top) / rect.height - .5) * 6}px`);
  });
});
hero.addEventListener('pointerleave', () => { cancelAnimationFrame(heroPointerFrame); hero.style.setProperty('--photo-x', '0px'); hero.style.setProperty('--photo-y', '0px'); });
