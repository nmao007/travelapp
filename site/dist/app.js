import { placeMapsURL, mapViewURL, directionsMapsURL } from './maps-links.js';
import { createPlaceSearch, placeSearchGroups, mixedMapPlaces, createQuotaMemory, placeIcon, createSearchSelection, quotaFailure, boundedPlaceRequest } from './place-search.js';
import { isTourOperator } from './tour-model.js';
import { playMotion, revealSequence, reducedMotion } from './motion.js';
import { createTripBanner } from './trip-banner.js';
import { readTrips, saveTrip, deleteTrip, addPlace, removePlace, movePlace, addStop, moveStop, removeStop, tripStops, tripTitle, renameTrip, currentAccount, createAccount, signIn, signOut, restoreSession, loadCloudTrips } from './trip-store.js';
import { calendarMonth, presetRange, rangeLength, selectDateRange } from './date-range.js';
import { datesForTrip, eventsForDay, mappedPlace, fixedItem } from './itinerary-model.js';
import { createDayRoutes } from './day-routes.js';
import { createItineraryUI } from './itinerary-ui.js';
import { mapEntries, scheduleUnassigned, googlePlaceRecord, destinationForDay, googleDescription, googleRatingLabel, mergeGoogleContent, mapLabelPosition } from './place-model.js';
import { enhanceDropdowns } from './dropdowns.js';
import { viewportSearchArea, inSearchArea, createSearchAreaTracker } from './explore-model.js';
import { createPhotoLookup, resolvePlacePhoto } from './place-photos.js';


const $ = id => document.getElementById(id);
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
let resolveMapsReady;
const mapsReady = new Promise(resolve => { resolveMapsReady = resolve; });
let quotaStorage; try { quotaStorage = sessionStorage; } catch { /* Storage is optional. */ }
const quotaMemory = createQuotaMemory(quotaStorage);
const state = { maps: null, places: null, markerClass: null, map: null, marker: null, stopMarkers: [], placeMarkers: [], suggestionMarkers: [], suggestions: [], selected: null, trip: null, day: 'ideas', animation: 0, config: null, pendingNearby: null, nearbyRequest: 0, photoRequest: 0, calendarRange: { start: null, end: null }, calendarYear: 0, calendarMonth: 0, routeEditing: false, planMode: 'list', workspaceView: 'itinerary', nearbyCategory: 'see', detailCooldownUntil: quotaMemory.read('details'), photoCooldownUntil: quotaMemory.read('photo-details'), photoSearchCooldownUntil: quotaMemory.read('photo-text'), detailCache: new Map(), operatorCache: new Map(), imageCache: new Map(), infoWindow: null, activePlaceId: null, discoveryPlace: null, nearbyCache: new Map(), mapSuggestions: [], mapAreaKey: null, mapSearchVersion: 0, mapSearchTimer: null, placeClickVersion: 0, nearbyAreaKey: null, nearbyTimer: null, cameraMoving: false };
const tripBanner = createTripBanner({ workspace: $('workspace'), header: $('trip-masthead'), hero: $('destination-hero'), onResize: () => { if (state.map) requestAnimationFrame(() => google.maps.event.trigger(state.map, 'resize')); } });
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
  $('my-trips').hidden = !trips.length && !currentAccount();
  $('my-trips').firstChild.textContent = currentAccount() ? 'My trips ' : 'Trips ';
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

function updateAccountBar() {
  const account = currentAccount();
  $('account-button').hidden = Boolean(account);
  $('account-email-label').hidden = !account;
  $('account-email-label').textContent = account?.email || '';
  $('account-signout').hidden = !account;
  updateRecent();
}

function setAccountMode(signup) {
  $('account-dialog').dataset.mode = signup ? 'signup' : 'login';
  $('account-title').textContent = signup ? 'Create your account' : 'Sign in';
  $('account-submit').textContent = signup ? 'Create account' : 'Sign in';
  $('account-description').textContent = signup ? 'Create a profile for your trips on this browser.' : 'Open the trips saved to your profile on this browser.';
  $('account-password').autocomplete = signup ? 'new-password' : 'current-password';
  $('account-mode-toggle').textContent = signup ? 'Already have an account? Sign in' : 'Create an account';
  $('account-message').textContent = '';
}

$('account-button').addEventListener('click', () => { setAccountMode(false); $('account-dialog').showModal(); $('account-email').focus(); });
$('account-mode-toggle').addEventListener('click', () => setAccountMode($('account-dialog').dataset.mode !== 'signup'));
$('account-close').addEventListener('click', () => $('account-dialog').close());
$('account-dialog').addEventListener('click', event => { if (event.target === $('account-dialog')) $('account-dialog').close(); });
$('account-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget, submit = $('account-submit');
  submit.disabled = true; $('account-message').classList.remove('error'); $('account-message').textContent = 'Opening your profile…';
  try {
    const email = $('account-email').value, password = $('account-password').value;
    if ($('account-dialog').dataset.mode === 'signup') await createAccount(email, password); else await signIn(email, password);
    let syncError = '';
    try { await loadCloudTrips(); } catch (error) { syncError = error.message || 'Your trip list could not sync from Supabase.'; }
    $('account-dialog').close(); form.reset(); showHome(); updateAccountBar();
    if (syncError) status('home-status', syncError);
  } catch (error) {
    $('account-message').classList.add('error'); $('account-message').textContent = error.message || 'Could not open this profile.';
  } finally { submit.disabled = false; }
});
$('account-signout').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try { await signOut(); showHome(); updateAccountBar(); }
  finally { button.disabled = false; }
});

function showHome({ focus = false } = {}) {
  clearMapSearch(); selection.invalidate();
  itinerary.clearRemoval(); dayRoutes.clear();
  $('trip-title-input').hidden = true; $('edit-trip-title').hidden = false;
  cancelAnimationFrame(state.animation);
  state.photoRequest++; state.nearbyRequest++; clearTimeout(state.nearbyTimer); state.cameraMoving = false;
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
  state.infoWindow?.close(); state.activePlaceId = null; state.nearbyAreaKey = null; clearTimeout(state.nearbyTimer); $('search-map-area').hidden = true;
  if (syncDay && daysForTrip(state.trip).includes(stop.date)) state.day = stop.date;
  clearMapSearch(); selection.invalidate();
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
  clearMapSearch(); selection.invalidate();
  $('trip-title-input').hidden = true; $('edit-trip-title').hidden = false;
  $('place-dialog').close(); $('plan-dialog').close(); $('transport-dialog').close(); $('day-preview').close();
  state.selected = place; state.trip = trip ? scheduleUnassigned(trip) : trip;
  state.infoWindow?.close(); state.activePlaceId = null; state.nearbyAreaKey = null; clearTimeout(state.nearbyTimer); $('search-map-area').hidden = true;
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
  tripBanner.reset();
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

async function wikimediaImage(place, width, destination = false) {
  const query = new URLSearchParams({ title: place.name, lat: String(place.latitude), lng: String(place.longitude), width: String(width), scope: destination ? 'destination' : 'place' });
  const response = await fetch(`/api/place-image?${query}`, { cache: 'no-store' });
  if (!response.ok) return null;
  const data = await response.json();
  return data.image || null;
}

const heroPhotos = new Map();
async function destinationPhoto(destination) {
  const key = destination.placeId;
  if (!heroPhotos.has(key)) heroPhotos.set(key, resolvePlacePhoto(destination, { width: 1200, lookup: lookupGooglePhotos, load: loadPhotoImage, fallback: (place, size) => wikimediaImage(place, size, true) }));
  try { return await heroPhotos.get(key); } finally { heroPhotos.delete(key); }
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
  state.cameraMoving = true; clearTimeout(state.nearbyTimer); state.nearbyRequest++;
  const to = coordinates(target);
  const fromPoint = state.map.getCenter();
  const from = fromPoint ? { lat: fromPoint.lat(), lng: fromPoint.lng() } : to;
  const fromZoom = state.map.getZoom() || 5;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { state.map.moveCamera({ center: to, zoom }); state.cameraMoving = false; scheduleAreaSearch(); scheduleMapSuggestions(); return; }
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
    else { state.cameraMoving = false; state.animation = 0; scheduleAreaSearch(); scheduleMapSuggestions(); }
  };
  state.animation = requestAnimationFrame(frame);
}

function pinContent(entry) {
  const pin = document.createElement('span'); pin.dataset.symbol = placeIcon(entry); pin.className = `map-place-pin ${entry.planned ? 'planned-pin' : 'recommended-pin'}`;
  pin.dataset.placeId = entry.placeId || entry.id; pin.classList.toggle('selected', pin.dataset.placeId === state.activePlaceId);
  const symbol = document.createElement('span'); symbol.className = 'pin-symbol';
  symbol.innerHTML = icon(placeIcon(entry));
  if (entry.planned) { const order = document.createElement('span'); order.className = 'pin-order'; order.textContent = String(entry.number); pin.append(order); }
  const label = document.createElement('span'); label.className = 'pin-label'; label.textContent = entry.name;
  pin.append(symbol, label); return pin;
}

const mapLabel = document.createElement('div'); mapLabel.className = 'map-marker-label'; mapLabel.hidden = true; mapLabel.setAttribute('aria-hidden', 'true');
$('map-column').querySelector('.map-frame').append(mapLabel);
let hoveredMapPin = null;
function hideMapLabel() {
  if (hoveredMapPin) hoveredMapPin.marker.zIndex = hoveredMapPin.priority;
  hoveredMapPin = null; mapLabel.hidden = true;
}
function showMapLabel(marker, pin, entry, priority) {
  hideMapLabel(); hoveredMapPin = { marker, priority }; marker.zIndex = 100000;
  mapLabel.textContent = entry.name; mapLabel.style.left = '0px'; mapLabel.style.top = '0px'; mapLabel.hidden = false;
  const frame = mapLabel.parentElement.getBoundingClientRect();
  const local = rect => ({ left: rect.left - frame.left, top: rect.top - frame.top, width: rect.width, height: rect.height });
  const anchor = local(pin.getBoundingClientRect());
  const obstacles = [...$('map').querySelectorAll('.map-place-pin')].filter(element => element !== pin).map(element => local(element.getBoundingClientRect())).filter(rect => rect.width && rect.height);
  const position = mapLabelPosition(anchor, frame, { width: mapLabel.offsetWidth, height: mapLabel.offsetHeight }, obstacles);
  mapLabel.style.left = `${position.left}px`; mapLabel.style.top = `${position.top}px`;
}

function showMapEntry(entry) {
  hideMapLabel();
  state.placeClickVersion++;
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
  const external = document.createElement('a'); external.className = 'detail-chip'; external.href = placeMapsURL(entry); external.target = '_blank'; external.rel = 'noopener noreferrer'; external.innerHTML = icon('external'); external.append(document.createTextNode('Google Maps'));
  const actions = document.createElement('div'); actions.className = 'map-entry-actions'; actions.append(button, external); content.append(title); const rating = googleRatingLabel(knownGoogleContent(entry)); if (rating) { const score = document.createElement('span'); score.className = 'map-entry-rating'; score.innerHTML = icon('star'); score.append(document.createTextNode(rating)); content.append(score); } content.append(actions);
  state.infoWindow ||= new state.maps.InfoWindow({ disableAutoPan: true });
  state.infoWindow.setContent(content);
  state.infoWindow.setPosition(coordinates(entry));
  state.infoWindow.open({ map: state.map, shouldFocus: false });
}

function drawMarkers() {
  hideMapLabel();
  if (!state.map || !state.markerClass || !state.selected) return;
  if (state.marker) state.marker.map = null;
  for (const marker of [...state.stopMarkers, ...state.placeMarkers, ...state.suggestionMarkers]) marker.map = null;
  state.stopMarkers = []; state.placeMarkers = []; state.suggestionMarkers = [];
  const optional = google.maps.CollisionBehavior.OPTIONAL_AND_HIDES_LOWER_PRIORITY;
  // Planned places take priority. Suggestions for those places never get a second pin.
  const dayOnly = state.workspaceView === 'itinerary' && state.planMode === 'day';
  const items = dayOnly && state.trip ? eventsForDay(state.trip, state.day).filter(event => event.kind === 'activity').map(event => event.item) : state.trip?.items;
  const area = currentSearchArea();
  const recommendations = state.mapSuggestions.filter(place => !area || inSearchArea(area, { lat: place.latitude, lng: place.longitude }));
  for (const entry of mapEntries(items, recommendations)) {
    const pin = pinContent(entry), priority = entry.planned ? 1000 : Math.round((entry.rating || 0) * 100) + Math.min(99, Math.round(Math.log10((entry.ratingCount || 0) + 1) * 20));
    const marker = new state.markerClass({ map: state.map, position: coordinates(entry), title: entry.name, content: pin, gmpClickable: true, collisionBehavior: entry.planned ? google.maps.CollisionBehavior.REQUIRED_AND_HIDES_OPTIONAL : optional, zIndex: priority });
    const showLabel = () => showMapLabel(marker, pin, entry, priority);
    pin.addEventListener('pointerenter', showLabel); marker.addEventListener('focusin', showLabel);
    pin.addEventListener('pointerleave', () => { if (hoveredMapPin?.marker === marker) hideMapLabel(); });
    marker.addEventListener('focusout', () => { if (hoveredMapPin?.marker === marker) hideMapLabel(); });
    marker.addEventListener('gmp-click', () => showMapEntry(entry));
    (entry.planned ? state.placeMarkers : state.suggestionMarkers).push(marker);
  }
}

const nearbyTypes = placeSearchGroups;
const selection = createSearchSelection();
const placeSearch = createPlaceSearch({ nearby: request => state.places.Place.searchNearby(request), text: request => state.places.Place.searchByText(request), record: googlePlaceRecord, quotaMemory });
const searchAreaTracker = createSearchAreaTracker();
function currentSearchArea() {
  return searchAreaTracker.read(state.map?.getBounds()?.toJSON());
}
function scheduleAreaSearch() {
  clearTimeout(state.nearbyTimer);
  if (!state.trip || state.workspaceView !== 'explore' || state.cameraMoving || $('place-dialog').open || $('plan-dialog').open) return;
  const area = currentSearchArea();
  if (!area || `${state.nearbyCategory}:${area.key}` === state.nearbyAreaKey) return;
  state.nearbyTimer = setTimeout(() => exploreNearby(state.nearbyCategory), 900);
}
function clearMapSearch() {
  searchAreaTracker.reset(); clearTimeout(state.mapSearchTimer); state.mapSearchVersion++; state.mapAreaKey = null; state.mapSuggestions = []; state.placeClickVersion++;
}
function scheduleMapSuggestions() {
  clearTimeout(state.mapSearchTimer);
  if (!state.trip || !state.places || !state.map || state.cameraMoving || state.workspaceView === 'transportation' || $('place-dialog').open || $('plan-dialog').open) return;
  const area = currentSearchArea();
  if (!area || state.mapAreaKey === `${state.trip.id}:${area.key}`) return;
  state.mapSearchTimer = setTimeout(() => updateMapSuggestions(area), 1100);
}
async function updateMapSuggestions(area, force = false) {
  const tripId = state.trip?.id, version = ++state.mapSearchVersion;
  if (!tripId || state.cameraMoving) return;
  state.mapAreaKey = `${tripId}:${area.key}`;
  try {
    const places = await placeSearch.search('mixed', area, { force });
    if (version !== state.mapSearchVersion || state.trip?.id !== tripId || currentSearchArea()?.key !== area.key) return;
    state.mapSuggestions = mixedMapPlaces(places); drawMarkers();
  } catch { /* Keep itinerary markers and Google's native places available. */ }
}
function renderSearchFailure(error, category) {
  const container = $('nearby-results'); container.replaceChildren();
  const note = document.createElement('p'); note.className = 'explore-error'; note.setAttribute('role', 'status');
  note.textContent = error.message === 'PLACE_SEARCH_LIMIT' ? 'Google place search has reached its demo limit.' : 'Could not load places. Try again.';
  const link = document.createElement('a'); link.className = 'detail-chip'; link.href = placeMapsURL({ name: `${placeSearchGroups[category].query} near ${state.selected?.name || state.trip.name}` }); link.target = '_blank'; link.rel = 'noopener noreferrer'; link.innerHTML = icon('external'); link.append(document.createTextNode('Google Maps'));
  container.append(note, link);
}
async function exploreNearby(category, { force = false } = {}) {
  if (!state.trip || !nearbyTypes[category]) return;
  clearTimeout(state.nearbyTimer);
  const changed = state.nearbyCategory !== category;
  state.nearbyCategory = category; state.pendingNearby = null;
  document.querySelectorAll('[data-nearby]').forEach(button => { button.classList.toggle('active', button.dataset.nearby === category); button.setAttribute('aria-pressed', String(button.dataset.nearby === category)); });
  const container = $('nearby-results'); container.hidden = false;
  if (changed) { selection.invalidate(); state.nearbyAreaKey = null; state.suggestions = []; photoObserver.disconnect(); recommendationMotion.disconnect(); container.replaceChildren(); }
  if (!state.places?.Place) { state.pendingNearby = category; return; }
  const area = currentSearchArea();
  if (!area || state.cameraMoving) { state.pendingNearby = category; return; }
  const cacheKey = `${category}:${area.key}`;
  if (!force && state.nearbyAreaKey === cacheKey) return;
  const ticket = selection.begin(state.trip.id, category, area.key), requestId = ++state.nearbyRequest;
  state.nearbyAreaKey = cacheKey; container.setAttribute('aria-busy', 'true');
  if (!container.childNodes.length) container.textContent = 'Finding places…';
  $('search-map-area').hidden = false; $('search-map-area').disabled = true; $('search-map-area').textContent = 'Updating…';
  try {
    const places = await placeSearch.search(category, area, { force });
    if (!selection.current(ticket) || requestId !== state.nearbyRequest || ticket.tripId !== state.trip?.id || category !== state.nearbyCategory) return;
    state.suggestions = places; container.dataset.areaKey = area.key;
    renderRecommendations(); drawMarkers(); $('search-map-area').hidden = true;
  } catch (error) {
    if (!selection.current(ticket) || requestId !== state.nearbyRequest || ticket.tripId !== state.trip?.id) return;
    state.nearbyAreaKey = null; state.suggestions = []; renderSearchFailure(error, category); $('search-map-area').hidden = false;
  } finally {
    if (selection.current(ticket) && requestId === state.nearbyRequest) { container.setAttribute('aria-busy', 'false'); $('search-map-area').disabled = false; $('search-map-area').textContent = 'Search this area'; }
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

const lookupGooglePhotos = createPhotoLookup(async (id, record) => {
  if (!state.places?.Place) await boundedPlaceRequest(() => mapsReady);
  if (!state.places?.Place) return [];
  if (Date.now() >= state.photoCooldownUntil) {
    try {
      const place = new state.places.Place({ id, requestedLanguage: 'en' });
      await boundedPlaceRequest(() => place.fetchFields({ fields: ['photos'] }), 4500);
      if (place.photos?.length) return place.photos;
    } catch (error) { if (quotaFailure(error)) state.photoCooldownUntil = quotaMemory.block('photo-details'); }
  }
  // Photos-only requests have their own availability. A failed richer details
  // request must not stop a working photo request or exact-place search.
  const known = placeSearch.find(id) || record || state.trip?.items?.find(item => item.placeId === id);
  if (!known?.name || Date.now() < state.photoSearchCooldownUntil) return [];
  try {
    const { places } = await boundedPlaceRequest(() => state.places.Place.searchByText({ fields: ['id', 'photos', 'location'], textQuery: known.name, language: 'en', maxResultCount: 20, ...(mappedPlace(known) ? { locationBias: { center: coordinates(known), radius: 1000 } } : {}) }), 4500);
    return places?.find(place => place.id === id)?.photos || [];
  } catch (error) { if (quotaFailure(error)) state.photoSearchCooldownUntil = quotaMemory.block('photo-text'); return []; }
}, { limit: 2, timeoutMs: 10000 });

function loadPhotoImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = setTimeout(() => { image.src = ''; reject(new Error('Photo timed out')); }, 10000);
    image.onload = () => { clearTimeout(timeout); resolve(image); };
    image.onerror = () => { clearTimeout(timeout); reject(new Error('Photo failed')); };
    image.src = src;
  });
}
async function showPlacePhoto(container, record, className = 'detail-photo') {
  const request = crypto.randomUUID(); container.dataset.photoRequest = request;
  const width = className === 'detail-photo' ? 900 : 420;
  const source = await resolvePlacePhoto(record, { width, lookup: lookupGooglePhotos, load: loadPhotoImage, fallback: async (place, size) => {
    const key = `${place.placeId}:photo:${size}`;
    const cached = state.imageCache.get(key);
    if (!cached || cached.expires < Date.now()) state.imageCache.set(key, { expires: Date.now() + 60000, promise: wikimediaImage(place, size).catch(() => null) });
    return state.imageCache.get(key).promise;
  } });
  if (!source || !container.isConnected || container.dataset.photoRequest !== request || container.dataset.photoPlace !== record.placeId) return;
  const image = source.image; image.alt = record.name;
  const credit = document.createElement(className === 'detail-photo' ? 'figcaption' : 'span');
  if (source.googlePhoto) photoCredits(credit, source.googlePhoto); else wikimediaCredits(credit, source);
  if (className === 'detail-photo') {
    const figure = document.createElement('figure'); figure.className = className; figure.append(image, credit);
    const existing = container.querySelector('.detail-photo'); if (existing) existing.replaceWith(figure); else container.prepend(figure);
  } else {
    container.replaceChildren(image);
    const row = container.closest('.recommendation-card'); row?.querySelector('.photo-credit')?.remove();
    credit.className = 'photo-credit'; if (!credit.hidden) row?.append(credit);
  }
}
const photoObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    photoObserver.unobserve(entry.target);
    const record = placeSearch.find(entry.target.dataset.photoPlace) || state.suggestions.find(place => place.placeId === entry.target.dataset.photoPlace);
    if (record) showPlacePhoto(entry.target, record, 'recommendation-photo').catch(() => {});
  }
}, { rootMargin: '0px' });

const recommendationMotion = new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) { recommendationMotion.unobserve(entry.target); revealSequence([entry.target]); }
}, { threshold: .15 });
function renderRecommendations() {
  recommendationMotion.disconnect();
  const container = $('nearby-results'); photoObserver.disconnect(); container.replaceChildren(); container.scrollTop = 0;
  if (!state.suggestions.length) { container.textContent = 'No places found here. Try another category or area.'; return; }
  for (const place of state.suggestions) {
    const row = document.createElement('article'); row.className = 'recommendation-card'; row.dataset.placeId = place.placeId;
    const open = document.createElement('button'); open.type = 'button'; open.className = 'recommendation-open'; open.setAttribute('aria-label', `View ${place.name}`);
    const photo = document.createElement('div'); photo.className = 'recommendation-photo';
    photo.innerHTML = icon(placeIcon(place));
    const copy = document.createElement('span'); copy.className = 'recommendation-copy';
    const title = document.createElement('strong'); title.textContent = place.name;
    const meta = document.createElement('span'); meta.className = 'recommendation-meta';
    meta.textContent = [Number.isFinite(place.rating) ? `${place.rating.toFixed(1)}${place.ratingCount ? ` (${place.ratingCount.toLocaleString()})` : ''}` : '', place.category].filter(Boolean).join(' · ');
    if (Number.isFinite(place.rating)) meta.insertAdjacentHTML('afterbegin', icon('star')); copy.append(title, meta); open.append(photo, copy);
    open.addEventListener('click', () => { animateMap(place, 15); openDiscovery(place); });
    const add = document.createElement('button'); add.type = 'button'; add.className = 'recommendation-add'; add.innerHTML = icon('plus'); add.setAttribute('aria-label', `Add ${place.name} to day`); add.addEventListener('click', () => planDiscoveredPlace(place));
    row.append(open, add); container.append(row); recommendationMotion.observe(row);
    photo.dataset.photoPlace = place.placeId; photoObserver.observe(photo);
  }

  syncSuggestionCards();
}

function notePlaceQuota(error) {
  if (quotaFailure(error)) { state.detailCooldownUntil = quotaMemory.block('details'); return true; }
  return false;
}
async function detailedGooglePlace(record) {
  if (!state.places?.Place) throw new Error('Google Maps unavailable');
  const cached = state.detailCache.get(record.placeId);
  if (cached) return cached;
  if (Date.now() < state.detailCooldownUntil) throw new Error('PLACE_DETAILS_QUOTA');
  const promise = (async () => {
    const place = new state.places.Place({ id: record.placeId, requestedLanguage: 'en' });
    await boundedPlaceRequest(() => place.fetchFields({ fields: ['id', 'displayName', 'formattedAddress', 'location', 'photos', 'rating', 'userRatingCount', 'primaryType', 'types', 'primaryTypeDisplayName', 'regularOpeningHours', 'currentOpeningHours', 'websiteURI', 'internationalPhoneNumber', 'googleMapsURI', 'businessStatus', 'editorialSummary', 'priceLevel', 'accessibilityOptions', 'attributions'] }));
    return place;
  })();
  state.detailCache.set(record.placeId, promise);
  try { return await promise; } catch (error) { state.detailCache.delete(record.placeId); if (notePlaceQuota(error)) throw new Error('PLACE_DETAILS_QUOTA'); throw error; }
}

async function tourOperatorContacts(record) {
  const available = placeSearch.find(record.placeId) || state.suggestions.find(place => place.placeId === record.placeId) || record;
  if (available.websiteURI || available.internationalPhoneNumber) return available;
  if (!state.places?.Place) return null;
  if (state.operatorCache.has(record.placeId)) return state.operatorCache.get(record.placeId);
  const fields = ['id', 'displayName', 'formattedAddress', 'location', 'primaryType', 'types', 'primaryTypeDisplayName', 'rating', 'userRatingCount', 'websiteURI', 'internationalPhoneNumber', 'businessStatus'];
  const request = (async () => {
    if (mappedPlace(record)) {
      try {
        const { places } = await state.places.Place.searchNearby({ fields, locationRestriction: { center: coordinates(record), radius: 100 }, includedPrimaryTypes: ['tour_agency'], maxResultCount: 20, language: 'en' });
        const match = places?.find(place => place.id === record.placeId);
        if (match) return googlePlaceRecord(match);
      } catch { /* Exact text search below also supports older saved outings. */ }
    }
    const { places } = await state.places.Place.searchByText({ fields, textQuery: record.name, includedType: 'tour_agency', useStrictTypeFiltering: true, maxResultCount: 20, language: 'en', ...(mappedPlace(record) ? { locationBias: { center: coordinates(record), radius: 1000 } } : {}) });
    // Never substitute a similarly named business for the saved guide.
    const match = places?.find(place => place.id === record.placeId); return match ? googlePlaceRecord(match) : null;
  })();
  state.operatorCache.set(record.placeId, request);
  if (state.operatorCache.size > 100) state.operatorCache.delete(state.operatorCache.keys().next().value);
  try { return await request; } catch { state.operatorCache.delete(record.placeId); return null; }
}

function knownGoogleContent(record) {
  return mergeGoogleContent(record, placeSearch.find(record.placeId) || state.suggestions.find(place => place.placeId === record.placeId));
}
function renderPlaceContent(container, record, { contactOnly = false, compact = false } = {}) {
  const photo = container.querySelector('.detail-photo'); container.replaceChildren();
  if (photo && !compact && !contactOnly) container.append(photo);
  const rating = googleRatingLabel(record);
  if (rating) {
    const meta = document.createElement(compact ? 'span' : 'a'); meta.className = 'detail-rating'; meta.innerHTML = icon('star'); meta.append(document.createTextNode(rating));
    if (!compact) { meta.href = placeMapsURL(record); meta.target = '_blank'; meta.rel = 'noopener noreferrer'; }
    meta.setAttribute('aria-label', `${rating} on Google Maps`); container.append(meta);
  }
  if (compact) return;
  if (record.category) { const category = document.createElement('span'); category.className = 'place-category'; category.textContent = record.category; container.append(category); }
  const description = googleDescription(record.editorialSummary);
  if (!contactOnly && description) { const text = document.createElement('p'); text.className = 'place-description'; text.textContent = description; container.append(text); }
  if (record.businessStatus && record.businessStatus !== 'OPERATIONAL') { const closed = document.createElement('p'); closed.className = 'closed-status'; closed.textContent = record.businessStatus === 'CLOSED_PERMANENTLY' ? 'Permanently closed' : 'Temporarily closed'; container.append(closed); }
  if (!contactOnly && record.address) { const address = document.createElement('p'); address.className = 'place-address'; address.textContent = record.address; container.append(address); }
  const descriptions = record.currentOpeningHours?.weekdayDescriptions || record.regularOpeningHours?.weekdayDescriptions;
  if (!contactOnly && descriptions?.length) {
    const hours = document.createElement('details'); hours.className = 'place-hours'; const title = document.createElement('summary'); title.innerHTML = icon('clock'); title.append(document.createTextNode('Opening hours')); hours.append(title);
    for (const text of descriptions) { const line = document.createElement('p'); line.textContent = text; hours.append(line); } container.append(hours);
  }
  const links = document.createElement('div'); links.className = 'place-links';
  for (const [label, url] of [['Website', record.websiteURI], ['Google Maps', placeMapsURL(record)], ...(!contactOnly ? [['Directions', directionsMapsURL(record)]] : []), [record.internationalPhoneNumber, record.internationalPhoneNumber ? `tel:${record.internationalPhoneNumber}` : null]]) {
    if (!url || !label || !/^(https?:|tel:)/i.test(url)) continue;
    const link = document.createElement('a'); link.innerHTML = icon(url.startsWith('tel:') ? 'phone' : label === 'Directions' ? 'directions' : 'external'); link.append(document.createTextNode(label)); link.href = url; link.className = 'detail-chip'; if (!url.startsWith('tel:')) { link.target = '_blank'; link.rel = 'noopener noreferrer'; } links.append(link);
  }
  container.append(links);
  const features = document.createElement('div'); features.className = 'place-features';
  if (record.priceLevel) { const price = document.createElement('span'); price.textContent = String(record.priceLevel).replaceAll('_', ' ').toLowerCase(); features.append(price); }
  if (record.accessibilityOptions?.hasWheelchairAccessibleEntrance === true) { const accessible = document.createElement('span'); accessible.textContent = 'Step-free entrance'; features.append(accessible); }
  if (features.childNodes.length) container.append(features);
  for (const provider of record.attributions || []) { if (!/^https?:/i.test(provider.providerURI || '')) continue; const link = document.createElement('a'); link.className = 'provider-credit'; link.href = provider.providerURI; link.textContent = provider.provider; link.target = '_blank'; link.rel = 'noopener noreferrer'; container.append(link); }
}
const pendingDayDetails = new Map();
const dayDetailObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const load = pendingDayDetails.get(entry.target);
    pendingDayDetails.delete(entry.target); dayDetailObserver.unobserve(entry.target); load?.();
  }
}, { rootMargin: '0px' });
function pruneDayDetails() {
  for (const element of pendingDayDetails.keys()) if (!element.isConnected) { pendingDayDetails.delete(element); dayDetailObserver.unobserve(element); }
}
async function hydratePlace(container, record, { contactOnly = false, compact = false, visible = false } = {}) {
  const request = crypto.randomUUID(); container.dataset.request = request; container.dataset.photoPlace = record.placeId;
  let available = knownGoogleContent(record);
  renderPlaceContent(container, available, { contactOnly, compact });
  // A timeline rating uses already loaded data; opening a place loads its details.
  if (compact) return;
  if (!visible && container.classList.contains('day-card-details')) {
    pendingDayDetails.set(container, () => { if (container.isConnected && container.dataset.request === request) hydratePlace(container, record, { contactOnly, visible: true }); });
    dayDetailObserver.observe(container); return;
  }
  try {
    if (!state.places) await boundedPlaceRequest(() => mapsReady);
    if (!container.isConnected || container.dataset.request !== request) return;
    const operator = contactOnly ? await tourOperatorContacts(record) : null;
    const fresh = operator || googlePlaceRecord(await detailedGooglePlace(record));
    if (!container.isConnected || container.dataset.request !== request) return;
    available = mergeGoogleContent(available, fresh);
    renderPlaceContent(container, available, { contactOnly, compact });
    if (!contactOnly) showPlacePhoto(container, available).catch(() => {});
  } catch {
    if (!contactOnly && container.isConnected && container.dataset.request === request) showPlacePhoto(container, available).catch(() => {});
    // Keep real Google search data and independent photo loading visible.
    // Missing editorial summaries are omitted instead of invented or replaced.
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
  const saved = !isTourOperator(place) && state.trip?.items?.some(item => item.placeId === place.placeId && item.day === state.day);
  $('add-discovery-place').disabled = Boolean(saved); $('add-discovery-place').textContent = saved ? 'Added to this day' : isTourOperator(place) ? 'Plan a tour' : daysForTrip(state.trip).length ? `Add to ${dateLabel(state.day)}` : 'Choose dates';
}
function openDiscovery(place) {
  state.discoveryPlace = place; $('place-dialog-title').textContent = place.name; $('place-dialog-status').textContent = '';
  $('place-dialog').showModal(); hydratePlace($('discovery-place-details'), place); syncDiscovery();
}
function planDiscoveredPlace(place) {
  if (isTourOperator(place)) {
    if (!daysForTrip(state.trip).length) { $('place-dialog').close(); openCalendar(); return; }
    $('place-dialog').close(); itinerary.openTour(place);
  } else { addToDay(place); syncDiscovery(); }
}
$('add-discovery-place').addEventListener('click', () => planDiscoveredPlace(state.discoveryPlace));
$('search-map-area').addEventListener('click', () => { setWorkspaceView('explore'); exploreNearby(state.nearbyCategory, { force: true }); const area = currentSearchArea(); if (area) updateMapSuggestions(area, true); });
for (const id of ['place-dialog', 'plan-dialog']) $(id).addEventListener('close', () => { scheduleAreaSearch(); scheduleMapSuggestions(); });

function updateMapLink() {
  const center = state.map?.getCenter();
  const href = mapViewURL(center ? { latitude: center.lat(), longitude: center.lng() } : state.selected, state.map?.getZoom());
  $('open-google-map').hidden = !href;
  if (href) $('open-google-map').href = href; else $('open-google-map').removeAttribute('href');
}
function showMap(place, fly = false) {
  if (!state.maps) return;
  if (fly) state.cameraMoving = true;
  if (!state.map) {
    state.map = new state.maps.Map($('map'), { center: coordinates(place), zoom: 5, mapId: state.config?.mapId || 'DEMO_MAP_ID', gestureHandling: 'greedy', mapTypeControl: false, streetViewControl: false, fullscreenControl: false, clickableIcons: true, zoomControl: true, cameraControl: false });
    $('map-loading').hidden = true;
    state.map.addListener('bounds_changed', () => {
      hideMapLabel();
      clearTimeout(state.mapSearchTimer);
      clearTimeout(state.nearbyTimer);
      if (state.cameraMoving) return;
      const area = currentSearchArea();
      if (!area || state.nearbyAreaKey === `${state.nearbyCategory}:${area.key}`) return;
      if (state.workspaceView === 'explore') {
        state.nearbyRequest++; state.nearbyAreaKey = null;
        $('nearby-results').setAttribute('aria-busy', 'false');
        $('search-map-area').hidden = false; $('search-map-area').disabled = false; $('search-map-area').textContent = 'Search this area';
        scheduleAreaSearch();
      }
    });
    state.map.addListener('dragstart', () => { cancelAnimationFrame(state.animation); state.cameraMoving = false; });
    state.map.addListener('idle', () => {
      updateMapLink(); scheduleMapSuggestions();
      if (state.pendingNearby && !state.cameraMoving) exploreNearby(state.pendingNearby);
      else scheduleAreaSearch();
    });
    state.map.addListener('click', async event => {
      if (!event.placeId) return;
      const clickVersion = ++state.placeClickVersion, tripId = state.trip?.id;
      const item = state.trip?.items?.find(item => item.placeId === event.placeId && item.day === state.day) || state.trip?.items?.find(item => item.placeId === event.placeId);
      const known = item || placeSearch.find(event.placeId) || state.suggestions.find(place => place.placeId === event.placeId);
      const open = record => {
        if (clickVersion !== state.placeClickVersion || tripId !== state.trip?.id) return;
        status('trip-status');
        if (item) { setWorkspaceView('itinerary'); itinerary.selectItem(item); itinerary.openPlan(item); }
        else openDiscovery(record);
      };
      if (known) { event.stop(); state.infoWindow?.close(); open(known); return; }
      // Keep Google's own place popup working while optional app details load.
      // Never suppress it and replace it with a quota-error toast.
      state.infoWindow?.close(); status('trip-status');
      const point = event.latLng?.toJSON();
      let match; try { match = await placeSearch.findAt(event.placeId, point); } catch { /* Details may still be available. */ }
      if (clickVersion !== state.placeClickVersion || tripId !== state.trip?.id) return;
      if (match) { open(match); return; }
      try { open(googlePlaceRecord(await detailedGooglePlace({ placeId: event.placeId }))); }
      catch {
        if (clickVersion !== state.placeClickVersion || tripId !== state.trip?.id) return;
        if (!point) return;
        const content = document.createElement('div'); content.className = 'map-entry-info';
        const link = document.createElement('a'); link.className = 'detail-chip'; link.href = placeMapsURL({ placeId: event.placeId, latitude: point.lat, longitude: point.lng }); link.target = '_blank'; link.rel = 'noopener noreferrer'; link.innerHTML = icon('external'); link.append(document.createTextNode('View in Google Maps')); content.append(link);
        state.infoWindow ||= new state.maps.InfoWindow({ disableAutoPan: true }); state.infoWindow.setContent(content); state.infoWindow.setPosition(point); state.infoWindow.open({ map: state.map, shouldFocus: false });
      }
    });
  }
  // The map container was hidden on the start screen; allow layout to settle before moving its camera.
  requestAnimationFrame(() => {
    google.maps.event.trigger(state.map, 'resize');
    if (fly) animateMap(place);
    else state.map.moveCamera({ center: coordinates(place), zoom: 12 });
    drawMarkers(); updateMapLink();
  });
}

function renderPlan() { itinerary.render(); syncSuggestionCards(); updateTripTitle(); $('trip-heading').setAttribute('aria-label', tripTitle(state.trip)); }

function syncSuggestionCards() {
  for (const card of $('nearby-results').querySelectorAll('.recommendation-card')) {
    const tour = isTourOperator(state.suggestions.find(place => place.placeId === card.dataset.placeId));
    const saved = !tour && state.trip?.items?.some(item => item.placeId === card.dataset.placeId && item.day === state.day);
    card.classList.toggle('added', Boolean(saved));
    const button = card.querySelector('.recommendation-add'); button.disabled = Boolean(saved);
    const name = card.querySelector('strong')?.textContent;
    button.setAttribute('aria-label', saved ? `${name} added to this day` : tour ? `Plan a tour with ${name}` : `Add ${name} to day`);
    const wasSaved = button.dataset.saved === 'true'; button.dataset.saved = String(Boolean(saved));
    button.classList.toggle('just-added', Boolean(saved) && !wasSaved); button.innerHTML = icon(saved ? 'check' : tour ? 'guide' : 'plus');
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
            const known = [...(state.trip?.items || []), ...state.suggestions].find(place => place.placeId === prediction.placeId && mappedPlace(place));
            if (known) selected = { placeId: known.placeId, name: known.name, address: known.address || '', latitude: known.latitude, longitude: known.longitude, ...(known.primaryType ? { primaryType: known.primaryType, tourOperator: known.tourOperator } : {}) };
            else try {
              if (Date.now() < state.detailCooldownUntil) throw new Error('PLACE_DETAILS_QUOTA');
              const place = prediction.toPlace();
              await place.fetchFields({ fields: ['id', 'displayName', 'formattedAddress', 'location'] });
              if (!place.id || !place.location) throw new Error('No map location');
              selected = { placeId: place.id, name: place.displayName || prediction.mainText?.toString() || '', address: place.formattedAddress || '', latitude: place.location.lat(), longitude: place.location.lng() };
            } catch (error) {
              notePlaceQuota(error);
              // Search has a separate quota. Accept only the exact prediction ID, never a similarly named place.
              try {
                const { places } = await state.places.Place.searchByText({ textQuery: prediction.text?.toString() || prediction.mainText?.toString(), fields: ['id', 'displayName', 'formattedAddress', 'location', 'primaryType', 'types'], language: 'en', maxResultCount: 20, ...(biasToTrip && state.trip ? { locationBias: { center: coordinates(state.selected || state.trip), radius: 50000 } } : {}) });
                const match = places?.find(place => place.id === prediction.placeId && place.location);
                if (match) selected = googlePlaceRecord(match);
              } catch { /* Try the separately metered Geocoding service below. */ }
              if (!selected) {
              const { Geocoder } = await google.maps.importLibrary('geocoding');
              const { results } = await new Geocoder().geocode({ placeId: prediction.placeId });
              const result = results?.[0];
              if (!result?.geometry?.location || !result.place_id) throw new Error('No map location');
              selected = { placeId: result.place_id, name: prediction.mainText?.toString() || result.formatted_address, address: result.formatted_address, latitude: result.geometry.location.lat(), longitude: result.geometry.location.lng() };
              }
            }
            input.value = ['departure-search', 'arrival-search'].includes(inputId) ? selected.name : ''; token = null;
            await onSelect(selected);
            status(inputId === 'destination' ? 'home-status' : 'trip-status');
          } catch (error) {
            const serviceUnavailable = Date.now() < state.detailCooldownUntil || /REQUEST_DENIED|OVER_QUERY_LIMIT/.test(error?.message || '');
            const message = serviceUnavailable ? 'Location lookup is unavailable. Check Google Maps billing and quotas.' : 'Could not open that place. Try another result.';
            if (inputId === 'plan-location-search') $('plan-error').textContent = message; else status(inputId === 'destination' ? 'home-status' : 'trip-status', message);
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
    timer = setTimeout(() => search(query, id), 300);
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
  if (view !== 'transportation') scheduleMapSuggestions();
  if (view === 'explore') scheduleAreaSearch();
  else { clearTimeout(state.nearbyTimer); state.nearbyRequest++; state.nearbyAreaKey = null; $('search-map-area').hidden = true; $('nearby-results').setAttribute('aria-busy', 'false'); }
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
const dayRoutes = createDayRoutes({ state, commit: commitTrip, icon, cancelCamera: () => { cancelAnimationFrame(state.animation); state.animation = 0; state.cameraMoving = false; } });
const itinerary = createItineraryUI({ state, commit: commitTrip,
  explore: () => { updateDayContext(state.day); setWorkspaceView('explore'); },
  onDayChange: updateDayContext,
  onRendered: () => { pruneDayDetails(); dayRoutes.render(); drawMarkers(); },
  onModeChange: mode => { if ($('plan-controls').dataset.mode === mode) return; $('plan-controls').dataset.mode = mode; if (state.map) requestAnimationFrame(() => google.maps.event.trigger(state.map, 'resize')); },
  chooseDates: () => { $('edit-date-picker').hidden = true; openCalendar(); $('save-dates').focus({ preventScroll: true }); },
  focusPlace: place => { animateMap(place, 15); document.querySelectorAll('[data-place-id]').forEach(element => element.classList.toggle('selected', element.dataset.placeId === place.placeId)); }, hydratePlace, icon });
enhanceDropdowns();
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
$('clear-dates').addEventListener('click', () => { $('edit-date-picker').hidden = true; $('edit-dates').focus({ preventScroll: true }); });
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
updateAccountBar();
const tripId = new URLSearchParams(location.search).get('trip');
window.addEventListener('trippilot-cloud-save-error', event => status(state.trip ? 'trip-status' : 'home-status', event.detail || 'Your change could not sync to Supabase.'));
async function initializeAccountWorkspace() {
  try {
    const session = await restoreSession();
    if (session) await loadCloudTrips();
  } catch { status('home-status', 'Could not load your Supabase trips. Your saved browser copy is still available.'); }
  updateAccountBar();
  const current = readTrips().find(trip => trip.id === tripId);
  if (current) openTrip(current);
}
initializeAccountWorkspace();
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
    state.maps = maps; state.places = places; state.markerClass = marker.AdvancedMarkerElement; resolveMapsReady(true);
    if (state.selected) { showMap(state.selected, true, true); loadDestinationPhoto(state.selected); dayRoutes.render(); }
    if (state.pendingNearby) { const category = state.pendingNearby; state.pendingNearby = null; exploreNearby(category); }
  })
  .catch(() => { resolveMapsReady(false); status('home-status', 'Place search is unavailable right now.'); $('map-loading').textContent = 'Map unavailable'; if (state.pendingNearby) $('nearby-results').textContent = 'Suggestions are unavailable right now.'; });

let cancellingTitle = false;
$('edit-trip-title').addEventListener('click', () => {
  $('trip-title-input').value = tripTitle(state.trip); $('edit-trip-title').hidden = true; $('trip-title-input').hidden = false;
  $('trip-title-input').focus({ preventScroll: true }); $('trip-title-input').select();
});
function finishTitle(cancel = false) {
  if ($('trip-title-input').hidden) return;
  if (!cancel) {
    try { commitTrip(renameTrip(state.trip, $('trip-title-input').value)); status('trip-status'); }
    catch (error) { status('trip-status', error.message); $('trip-title-input').focus({ preventScroll: true }); return; }
  }
  $('trip-title-input').hidden = true; $('edit-trip-title').hidden = false;
}
$('trip-title-input').addEventListener('blur', () => { if (!cancellingTitle) finishTitle(); });
$('trip-title-input').addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === 'Escape') { event.preventDefault(); cancellingTitle = event.key === 'Escape'; finishTitle(cancellingTitle); $('edit-trip-title').focus({ preventScroll: true }); cancellingTitle = false; }
});
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('edit-date-picker').hidden) { $('edit-date-picker').hidden = true; $('edit-dates').focus({ preventScroll: true }); } });
document.addEventListener('pointerdown', event => {
  if (!$('edit-date-picker').hidden && !$('edit-date-picker').contains(event.target) && !$('edit-dates').contains(event.target)) $('edit-date-picker').hidden = true;
  if (!$('trip-menu').hidden && !$('trip-menu').contains(event.target) && !$('trip-menu-button').contains(event.target)) $('trip-menu').hidden = true;
});

// A small photographic camera shift responds to the pointer; controls themselves stay still.
const hero = $('destination-hero'); let heroPointerFrame = 0;
hero.addEventListener('pointermove', event => {
  if (reducedMotion() || event.pointerType !== 'mouse' || $('workspace').classList.contains('banner-compact')) return;
  cancelAnimationFrame(heroPointerFrame);
  heroPointerFrame = requestAnimationFrame(() => {
    const rect = hero.getBoundingClientRect();
    hero.style.setProperty('--photo-x', `${((event.clientX - rect.left) / rect.width - .5) * 10}px`);
    hero.style.setProperty('--photo-y', `${((event.clientY - rect.top) / rect.height - .5) * 6}px`);
  });
});
hero.addEventListener('pointerleave', () => { cancelAnimationFrame(heroPointerFrame); hero.style.setProperty('--photo-x', '0px'); hero.style.setProperty('--photo-y', '0px'); });
