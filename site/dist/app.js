import { placeMapsURL, mapViewURL, directionsMapsURL } from './maps-links.js';
import { createPlaceSearch, createPlaceDetails, placeSearchGroups, mixedMapPlaces, createQuotaMemory, placeIcon, createSearchSelection, quotaFailure, boundedPlaceRequest } from './place-search.js';
import { isTourOperator } from './tour-model.js';
import { playMotion, revealSequence, reducedMotion } from './motion.js';
import { createTripBanner } from './trip-banner.js';
import { readTrips, saveTrip, deleteTrip, addPlace, removePlace, movePlace, addStop, moveStop, removeStop, tripStops, stopSchedule, datesForStop, setStopDates, tripTitle, renameTrip, currentAccount, createAccount, signIn, signOut, restoreSession, loadCloudTrips } from './trip-store.js';
import { calendarMonth, presetRange, rangeLength, selectDateRange } from './date-range.js';
import { datesForTrip, eventsForDay, mappedPlace, fixedItem } from './itinerary-model.js';
import { createDayRoutes } from './day-routes.js';
import { createItineraryUI } from './itinerary-ui.js';
import { mapEntries, scheduleUnassigned, googlePlaceRecord, destinationForDay, googlePlaceSummary, googleRatingLabel, mergeGoogleContent, mapLabelPosition } from './place-model.js';
import { enhanceDropdowns, refreshDropdowns } from './dropdowns.js';
import { viewportSearchArea, inSearchArea, createSearchAreaTracker } from './explore-model.js';
import { createPhotoLookup, resolvePlacePhoto, createPhotoDisplayCache } from './place-photos.js';
import { downloadTripCalendar } from './calendar-export.js';
import { createTransientNotice } from './notices.js';
import { enhanceTimePickers } from './time-picker.js';
import { enhanceDisclosures } from './expansion.js';
import { enablePhoneTouch } from './phone-touch.js';


const $ = id => document.getElementById(id);
enablePhoneTouch(document);
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
let resolveMapsReady;
const mapsReady = new Promise(resolve => { resolveMapsReady = resolve; });
let quotaStorage; try { quotaStorage = sessionStorage; } catch { /* Storage is optional. */ }
const quotaMemory = createQuotaMemory(quotaStorage);
const state = { maps: null, places: null, markerClass: null, map: null, mapUnavailable: false, marker: null, stopMarkers: [], placeMarkers: [], suggestionMarkers: [], suggestions: [], selected: null, trip: null, day: 'ideas', animation: 0, config: null, pendingNearby: null, nearbyRequest: 0, photoRequest: 0, calendarRange: { start: null, end: null }, calendarYear: 0, calendarMonth: 0, routeEditing: false, stopFilter: null, planMode: 'list', workspaceView: 'itinerary', nearbyCategory: 'see', detailCooldownUntil: quotaMemory.read('selection-details'), photoCooldownUntil: quotaMemory.read('photo-details'), detailCache: new Map(), imageCache: new Map(), infoWindow: null, activePlaceId: null, discoveryPlace: null, mapSuggestions: [], mapAreaKey: null, mapSearchVersion: 0, mapSearchTimer: null, placeClickVersion: 0, nearbyAreaKey: null, nearbyTimer: null, cameraMoving: false };
const tripBanner = createTripBanner({ workspace: $('workspace'), header: $('trip-masthead'), hero: $('destination-hero'), onResize: () => { if (state.map) requestAnimationFrame(() => google.maps.event.trigger(state.map, 'resize')); } });
const dateLabel = value => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
const dateLong = value => new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
const tripDateLabel = trip => trip.startDate && trip.endDate ? `${dateLabel(trip.startDate)} – ${dateLabel(trip.endDate)}` : 'Add dates';
const coordinates = place => ({ lat: place.latitude, lng: place.longitude });
const notices = new Map(['home-status', 'trip-status'].map(id => [id, createTransientNotice($(id), { onHide: () => { $(id).textContent = ''; } })]));
const status = (id, text = '') => { if (!text) { notices.get(id).clear(); return; } $(id).textContent = text; notices.get(id).show(); };

const daysForTrip = datesForTrip;

function updateTripURL(tripId = null) {
  const url = new URL(location.href);
  url.pathname = window.parent !== window ? '/app' : '/';
  if (tripId) url.searchParams.set('trip', tripId); else url.searchParams.delete('trip');
  history.replaceState(null, '', url);
  if (window.parent !== window) window.parent.postMessage({ type: 'trippilot-navigation', tripId }, location.origin);
}

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
  state.selected = null; state.trip = null; state.infoWindow?.close(); $('place-dialog').close(); $('plan-dialog').close(); $('day-preview').close(); $('route-search').close();
  $('home-view').hidden = false;
  $('workspace').hidden = true;
  $('destination').value = '';
  $('suggestions').hidden = true;
  $('suggestions').replaceChildren();
  status('home-status');
  updateTripURL();
  updateRecent();
  if (focus) $('destination').focus();
}

function stopRangeLabel(entry) {
  if (!entry?.start) return 'Set dates';
  return entry.start === entry.end ? dateLabel(entry.start) : entry.start.slice(0, 7) === entry.end.slice(0, 7) ? `${dateLabel(entry.start)} – ${Number(entry.end.slice(-2))}` : `${dateLabel(entry.start)} – ${dateLabel(entry.end)}`;
}
function navigateStop(stop) {
  state.stopFilter = stop.placeId; selectStop(stop);
  $('day-content').scrollTop = 0; $('day-tabs').scrollLeft = 0;
}
function renderRoute() {
  const entries = stopSchedule(state.trip), list = $('route-list'), scroll = list.scrollLeft;
  const focusedStop = list.contains(document.activeElement) ? document.activeElement.dataset.stopId : null;
  $('route-bar').dataset.stopCount = String(entries.length);
  $('destination-hero').dataset.stopCount = String(entries.length);
  list.replaceChildren(); list.hidden = entries.length < 2;
  const all = document.createElement('button'); all.type = 'button'; all.className = 'route-all';
  all.dataset.stopId = 'all'; all.innerHTML = `${icon('list')}<span>All stops</span>`; all.setAttribute('aria-pressed', String(!state.stopFilter));
  all.addEventListener('click', () => { state.stopFilter = null; renderRoute(); renderPlan(); $('day-content').scrollTop = 0; });
  list.append(all);
  for (const entry of entries) {
    const { stop, index } = entry;
    const select = document.createElement('button'); select.type = 'button'; select.className = 'route-stop';
    select.dataset.stopId = stop.placeId;
    const active = state.stopFilter === stop.placeId; select.classList.toggle('active', active); select.setAttribute('aria-pressed', String(active));
    select.setAttribute('aria-label', `${stop.name}, ${stopRangeLabel(entry)}, stop ${index + 1} of ${entries.length}`);
    select.innerHTML = '<span class="route-index"></span><span class="route-copy"><strong></strong><span class="route-range"></span></span>';
    select.querySelector('.route-index').textContent = String(index + 1);
    select.querySelector('strong').textContent = stop.name;
    select.querySelector('.route-range').textContent = stopRangeLabel(entry);
    select.addEventListener('click', () => navigateStop(stop)); list.append(select);
  }
  list.scrollLeft = scroll;
  const activeCard = list.querySelector('.route-stop.active');
  if (activeCard && activeCard.offsetLeft + activeCard.offsetWidth > list.scrollLeft + list.clientWidth) list.scrollLeft = activeCard.offsetLeft + activeCard.offsetWidth - list.clientWidth;
  if (activeCard && activeCard.offsetLeft < list.scrollLeft) list.scrollLeft = activeCard.offsetLeft;
  if (focusedStop && !list.hidden) Array.from(list.querySelectorAll('button')).find(button => button.dataset.stopId === focusedStop)?.focus({ preventScroll:true });
  $('edit-route').hidden = entries.length < 2;
  $('edit-route').innerHTML = icon('calendar'); $('edit-route').setAttribute('aria-label', `Edit ${state.selected?.name || entries[0].stop.name} stop dates`);
  refreshDropdowns(list);
}

function selectStop(stop, syncDay = true) {
  if (!stop || !state.trip) return;
  state.infoWindow?.close(); state.activePlaceId = null; state.nearbyAreaKey = null; clearTimeout(state.nearbyTimer); $('search-map-area').hidden = true;
  const firstDay = datesForStop(state.trip, stop.placeId)[0];
  if (syncDay && firstDay) state.day = firstDay;
  clearMapSearch(); selection.invalidate();
  state.selected = stop; state.photoRequest++; state.nearbyRequest++; state.suggestions = [];
  $('nearby-results').replaceChildren();
  updateTripTitle();
  $('trip-address').textContent = stop.address || '';
  $('map-caption').textContent = stop.name;

  renderRoute(); renderPlan(); showMap(stop, true); drawMarkers();
  if (state.places?.Place) loadDestinationPhoto(stop);
  if (state.workspaceView === 'explore') { state.pendingNearby = state.nearbyCategory; scheduleAreaSearch(); }
}

function commitRoute(next, selectedId) {
  try { saveTrip(next); }
  catch { status('trip-status', 'Could not save this route.'); return false; }
  state.trip = next; updateRecent();
  selectStop(tripStops(next).find(stop => stop.placeId === selectedId) || tripStops(next)[0]);
  return true;
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
  $('route-search').close();
  state.routeEditing = false; state.stopFilter = null;
  status('trip-status');
  $('hero-gallery').replaceChildren();
  if (trip) {
    renderRoute();
    const days = daysForTrip(trip);
    if (state.day !== 'ideas' && !days.includes(state.day)) state.day = days[0] || 'ideas';
    if (state.day === 'ideas' && days.length && !trip.items?.length) state.day = days[0];
    renderPlan(); setWorkspaceView('itinerary');
    ensureTripZone(trip);
    updateTripURL(trip.id);
  }
  tripBanner.reset();
  showMap(place, true, true);
  if (state.places?.Place) loadDestinationPhoto(place);
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

const destinationPhoto = destination => displayedPhotos(destination, 1200, true);

async function loadDestinationPhoto() {
  if (!state.trip) return;
  const gallery = $('hero-gallery'), stops = tripStops(state.trip), route = stops.map(stop => stop.placeId).join('|');
  if (gallery.dataset.route === route && gallery.childNodes.length) return;
  gallery.dataset.route = route; gallery.replaceChildren(); $('hero-photo-credits').replaceChildren(); $('hero-credits-toggle').hidden = true; $('hero-photo-credits').hidden = true; $('hero-credits-toggle').setAttribute('aria-expanded', 'false');
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
      if (source.googlePhoto) { credit.dataset.google = 'true'; photoCredits(credit, source.googlePhoto); } else wikimediaCredits(credit, source);
      if (!credit.hidden) { const group = document.createElement('div'), title = document.createElement('strong'); title.textContent = stop.name; group.append(title, ...Array.from(credit.childNodes, node => node.cloneNode(true))); $('hero-photo-credits').append(group); $('hero-credits-toggle').hidden = false; }
    });
  }
}

function animateMap(target, zoom = 12, onSettled = () => {}) {
  if (!state.map || state.mapUnavailable) return;
  cancelAnimationFrame(state.animation);
  state.cameraMoving = true; clearTimeout(state.nearbyTimer); state.nearbyRequest++;
  const to = coordinates(target);
  const fromPoint = state.map.getCenter();
  const from = fromPoint ? { lat: fromPoint.lat(), lng: fromPoint.lng() } : to;
  const fromZoom = state.map.getZoom() || 5;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { state.map.moveCamera({ center: to, zoom }); state.cameraMoving = false; onSettled(); scheduleAreaSearch(); scheduleMapSuggestions(); return; }
  let lngDelta = to.lng - from.lng;
  if (lngDelta > 180) lngDelta -= 360;
  if (lngDelta < -180) lngDelta += 360;
  const start = performance.now();
  const duration = 850;
  const frame = now => {
    if (state.mapUnavailable) { state.cameraMoving = false; return; }
    const t = Math.min(1, (now - start) / duration);
    const ease = 1 - Math.pow(1 - t, 3);
    state.map.moveCamera({ center: { lat: from.lat + (to.lat - from.lat) * ease, lng: from.lng + lngDelta * ease }, zoom: fromZoom + (zoom - fromZoom) * ease });
    if (t < 1) state.animation = requestAnimationFrame(frame);
    else { state.cameraMoving = false; state.animation = 0; onSettled(); scheduleAreaSearch(); scheduleMapSuggestions(); }
  };
  state.animation = requestAnimationFrame(frame);
}

function pinContent(entry) {
  const symbolName = placeIcon(knownGoogleContent(entry));
  const pin = document.createElement('span'); pin.dataset.symbol = symbolName; pin.dataset.planKind = entry.kind || ''; pin.className = `map-place-pin ${entry.planned ? 'planned-pin' : 'recommended-pin'}`;
  pin.dataset.placeId = entry.placeId || entry.id; pin.classList.toggle('selected', pin.dataset.placeId === state.activePlaceId);
  const symbol = document.createElement('span'); symbol.className = 'pin-symbol';
  symbol.innerHTML = icon(symbolName);
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

function openMapCard(entry, title, content, { native = false, recenter = true, version = state.placeClickVersion } = {}) {
  const show = () => {
    if (version !== state.placeClickVersion) return;
    if (!state.infoWindow) {
      state.infoWindow = new state.maps.InfoWindow();
      state.infoWindow.addListener('closeclick', () => { state.placeClickVersion++; scheduleAreaSearch(); scheduleMapSuggestions(); });
      state.infoWindow.addListener('domready', () => {
        const surface = state.infoWindow.getContent()?.closest?.('.gm-style-iw-c');
        playMotion(surface, [{ opacity: 0, translate: '0 6px', scale: '.98' }, { opacity: 1, translate: '0 0', scale: '1' }], { duration: 200 });
      });
    }
    clearTimeout(state.nearbyTimer); clearTimeout(state.mapSearchTimer);
    state.infoWindow.close();
    state.infoWindow.setOptions({ disableAutoPan: false, maxWidth: 284, pixelOffset: new google.maps.Size(0, native ? -28 : -48), ariaLabel: title.textContent });
    content.style.width = `${Math.max(160, Math.min(244, $('map-column').clientWidth - 64))}px`;
    state.infoWindow.setHeaderContent(title); state.infoWindow.setContent(content); state.infoWindow.setPosition(coordinates(entry));
    state.infoWindow.open({ map: state.map, shouldFocus: false });
  };
  if (recenter) animateMap(entry, 15, show); else show();
}
function mapCardLink(entry) {
  const link = document.createElement('a'); link.className = 'detail-chip'; link.href = placeMapsURL(entry); link.target = '_blank'; link.rel = 'noopener noreferrer'; link.innerHTML = icon('external'); link.append(document.createTextNode('Google Maps')); return link;
}
function mapAddLabel() {
  const day = daysForTrip(state.trip).includes(state.day) ? state.day : daysForTrip(state.trip)[0];
  return day ? `Add to ${dateLabel(day)}` : 'Choose dates';
}
function showMapEntry(entry, options = {}) {
  hideMapLabel();
  const version = ++state.placeClickVersion;
  state.activePlaceId = entry.placeId || entry.id;
  if (entry.planned) {
    const item = state.trip.items.find(item => item.placeId === entry.placeId && item.day === state.day) || state.trip.items.find(item => item.id === entry.id);
    if (item) {
      const keepMobileMap = matchMedia('(max-width:580px)').matches && $('plan-controls').dataset.mobileSurface === 'map';
      setWorkspaceView('itinerary', { keepMobileMap }); itinerary.selectItem(item);
    }
  }
  document.querySelectorAll('[data-place-id]').forEach(element => element.classList.toggle('selected', element.dataset.placeId === entry.placeId));
  const content = document.createElement('div'); content.className = 'map-entry-info';
  const title = document.createElement('strong'); title.className = 'map-entry-title';
  if (entry.planned) title.textContent = entry.name;
  else {
    const details = document.createElement('button'); details.type = 'button'; details.className = 'map-entry-name'; details.textContent = entry.name; details.setAttribute('aria-label', `View ${entry.name} details`);
    details.addEventListener('click', () => { state.infoWindow?.close(); openDiscovery(entry); }); title.append(details);
  }
  const metadata = document.createElement('div'); metadata.className = 'map-entry-meta';
  const category = document.createElement('span'); category.className = 'map-entry-category'; category.hidden = true;
  const score = document.createElement('span'); score.className = 'map-entry-rating'; score.setAttribute('role', 'status'); metadata.append(category, score); content.append(metadata);
  const renderCategory = record => { category.textContent = record.category || ''; category.hidden = !category.textContent; };
  const renderRating = record => {
    score.replaceChildren(); score.removeAttribute('aria-busy');
    const rating = googleRatingLabel(record);
    score.classList.toggle('rating-unavailable', !rating);
    if (rating) { score.innerHTML = icon('star'); score.append(document.createTextNode(rating)); }
    else score.textContent = 'Rating unavailable';
  };
  const available = knownGoogleContent(entry);
  renderCategory(available);
  if (googleRatingLabel(available)) renderRating(available);
  else { score.textContent = 'Loading rating…'; score.setAttribute('aria-busy', 'true'); }
  if (!googleRatingLabel(available) || !available.category) {
    detailedGooglePlace(available, { compact: true }).then(fresh => {
      if (version !== state.placeClickVersion) return;
      const merged = mergeGoogleContent(available, fresh); renderCategory(merged); renderRating(merged);
    }, () => { if (version === state.placeClickVersion) renderRating(available); });
  }
  const actions = document.createElement('div'); actions.className = 'map-entry-actions';
  const button = document.createElement('button'); button.type = 'button'; button.textContent = entry.planned ? 'Open plan' : isTourOperator(entry) ? 'Plan a tour' : mapAddLabel();
  button.addEventListener('click', () => {
    if (entry.planned) { state.infoWindow?.close(); itinerary.openPlan(state.trip.items.find(item => item.placeId === entry.placeId && item.day === state.day) || state.trip.items.find(item => item.id === entry.id)); }
    else planDiscoveredPlace(entry);
  });
  actions.append(button, mapCardLink(entry)); content.append(actions);
  openMapCard(entry, title, content, { ...options, version });
}
function showLimitedMapEntry(placeId, point) {
  if (!point) return;
  const entry = { placeId, latitude: point.lat, longitude: point.lng };
  const title = document.createElement('strong'); title.className = 'map-entry-title'; title.textContent = 'Add a place';
  const content = document.createElement('form'); content.className = 'map-entry-info map-entry-fallback';
  const note = document.createElement('p'); note.className = 'map-entry-note'; note.textContent = 'Google details are unavailable. You can still add this location by name.';
  const label = document.createElement('label'); label.className = 'map-entry-field'; label.textContent = 'Place name';
  const name = document.createElement('input'); name.type = 'text'; name.required = true; name.maxLength = 240; name.autocomplete = 'off'; label.append(name);
  const actions = document.createElement('div'); actions.className = 'map-entry-actions';
  const add = document.createElement('button'); add.type = 'submit'; add.textContent = mapAddLabel(); add.disabled = true;
  name.addEventListener('input', () => { add.disabled = !name.value.trim(); });
  content.addEventListener('submit', event => { event.preventDefault(); if (name.value.trim()) addToDay({ ...entry, name: name.value.trim() }); });
  actions.append(add, mapCardLink(entry)); content.append(note, label, actions);
  openMapCard(entry, title, content, { native: true, recenter: false });
}

function drawMarkers() {
  hideMapLabel();
  if (!state.map || state.mapUnavailable || !state.markerClass || !state.selected) return;
  try {
  if (state.marker) state.marker.map = null;
  for (const marker of [...state.stopMarkers, ...state.placeMarkers, ...state.suggestionMarkers]) marker.map = null;
  state.stopMarkers = []; state.placeMarkers = []; state.suggestionMarkers = [];
  const optional = google.maps.CollisionBehavior.OPTIONAL_AND_HIDES_LOWER_PRIORITY;
  // Planned places take priority. Suggestions for those places never get a second pin.
  const dayOnly = state.workspaceView === 'itinerary' && state.planMode === 'day';
  const stopDays = state.stopFilter && state.trip ? datesForStop(state.trip, state.stopFilter) : null;
  const items = dayOnly && state.trip ? eventsForDay(state.trip, state.day).filter(event => event.kind === 'activity').map(event => event.item) : stopDays ? state.trip.items.filter(item => stopDays.includes(item.day)) : state.trip?.items;
  const area = currentSearchArea();
  const recommendations = state.mapSuggestions.filter(place => !area || inSearchArea(area, { lat: place.latitude, lng: place.longitude }));
  for (const entry of mapEntries(items, recommendations, { timeZone: state.trip?.timeZone || 'UTC' })) {
    const pin = pinContent(entry), priority = entry.planned ? 1000 : Math.round((entry.rating || 0) * 100) + Math.min(99, Math.round(Math.log10((entry.ratingCount || 0) + 1) * 20));
    const marker = new state.markerClass({ map: state.map, position: coordinates(entry), title: entry.name, content: pin, gmpClickable: true, collisionBehavior: entry.planned ? google.maps.CollisionBehavior.REQUIRED_AND_HIDES_OPTIONAL : optional, zIndex: priority });
    const showLabel = () => showMapLabel(marker, pin, entry, priority);
    pin.addEventListener('pointerenter', showLabel); marker.addEventListener('focusin', showLabel);
    pin.addEventListener('pointerleave', () => { if (hoveredMapPin?.marker === marker) hideMapLabel(); });
    marker.addEventListener('focusout', () => { if (hoveredMapPin?.marker === marker) hideMapLabel(); });
    marker.addEventListener('gmp-click', () => showMapEntry(entry));
    (entry.planned ? state.placeMarkers : state.suggestionMarkers).push(marker);
  }
  } catch {
    // An unavailable Google renderer must never interrupt local trip editing.
    state.mapUnavailable = true; state.cameraMoving = false; clearMapSearch();
    $('map-loading').hidden = false; $('map-loading').textContent = 'Map unavailable';
    updateMapLink();
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
  if (!state.trip || state.workspaceView !== 'explore' || state.cameraMoving || state.infoWindow?.isOpen || $('place-dialog').open || $('plan-dialog').open) return;
  const area = currentSearchArea();
  if (!area || `${state.nearbyCategory}:${area.key}` === state.nearbyAreaKey) return;
  state.nearbyTimer = setTimeout(() => exploreNearby(state.nearbyCategory), 1400);
}
function clearMapSearch() {
  searchAreaTracker.reset(); clearTimeout(state.mapSearchTimer); state.mapSearchVersion++; state.mapAreaKey = null; state.mapSuggestions = []; state.placeClickVersion++;
}
function scheduleMapSuggestions() {
  clearTimeout(state.mapSearchTimer);
  if (!state.trip || !state.places || !state.map || state.cameraMoving || state.workspaceView !== 'itinerary' || state.infoWindow?.isOpen || $('place-dialog').open || $('plan-dialog').open) return;
  const area = currentSearchArea();
  if (!area || state.mapAreaKey === `${state.trip.id}:${area.key}`) return;
  state.mapSearchTimer = setTimeout(() => updateMapSuggestions(area), 1400);
}
async function updateMapSuggestions(area, force = false) {
  const tripId = state.trip?.id, version = ++state.mapSearchVersion;
  if (!tripId || state.cameraMoving) return;
  state.mapAreaKey = `${tripId}:${area.key}`;
  try {
    const places = await placeSearch.search('mixed', area, { force, isCurrent: () => version === state.mapSearchVersion && state.workspaceView === 'itinerary' && state.trip?.id === tripId });
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
  if (!state.trip || state.workspaceView !== 'explore' || !nearbyTypes[category]) return;
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
    const places = await placeSearch.search(category, area, { force, isCurrent: () => selection.current(ticket) && state.workspaceView === 'explore' });
    if (!selection.current(ticket) || requestId !== state.nearbyRequest || ticket.tripId !== state.trip?.id || category !== state.nearbyCategory) return;
    state.suggestions = places; container.dataset.areaKey = area.key;
    state.mapSuggestions = mixedMapPlaces([...state.mapSuggestions.filter(place => inSearchArea(area, coordinates(place))), ...places]);
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
  if (!days.length) { state.infoWindow?.close(); $('place-dialog').close(); openCalendar(); $('save-dates').focus({ preventScroll: true }); status('trip-status', 'Choose a day for your trip first.'); return; }
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
  return [];

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
const displayedPhotos = createPhotoDisplayCache((record, width, destination) => resolvePlacePhoto(record, { width, lookup: lookupGooglePhotos, load: loadPhotoImage, fallback: async (place, size) => {
    const key = `${place.placeId}:photo:${size}:${destination}`;
    const cached = state.imageCache.get(key);
    if (!cached || cached.expires < Date.now()) state.imageCache.set(key, { expires: Date.now() + 60000, promise: wikimediaImage(place, size, destination).catch(() => null) });
    return state.imageCache.get(key).promise;
  } }));

async function showPlacePhoto(container, record, className = 'detail-photo') {
  const request = crypto.randomUUID(); container.dataset.photoRequest = request;
  const width = className === 'detail-photo' ? 900 : 420;
  const source = await displayedPhotos(record, width);
  if (!source || !container.isConnected || container.dataset.photoRequest !== request || container.dataset.photoPlace !== record.placeId) return;
  const image = source.image.cloneNode(true); image.alt = record.name;
  if (className === 'detail-photo') {
    const credit = document.createElement('figcaption');
    if (source.googlePhoto) photoCredits(credit, source.googlePhoto); else wikimediaCredits(credit, source);
    const figure = document.createElement('figure'); figure.className = className; figure.append(image, credit);
    const existing = container.querySelector('.detail-photo'); if (existing) existing.replaceWith(figure); else container.prepend(figure);
  } else {
    container.replaceChildren(image);
    // Credits stay with the full photo in the opened place details.
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
  if (quotaFailure(error)) { state.detailCooldownUntil = quotaMemory.block('selection-details'); return true; }
  return false;
}
const placeDetails = createPlaceDetails({
  fetch: async (id, fields) => {
    if (!state.places?.Place) throw new Error('Google Maps unavailable');
    const place = new state.places.Place({ id, requestedLanguage: 'en' });
    await place.fetchFields({ fields });
    return place;
  },
  text: request => state.places.Place.searchByText(request), record: googlePlaceRecord,
  quotaMemory, cache: state.detailCache,
});
const detailedGooglePlace = (record, options) => placeDetails.load(record, options);

async function tourOperatorContacts(record) {
  const available = knownGoogleContent(record);
  if (available.websiteURI || available.internationalPhoneNumber) return available;
  return detailedGooglePlace(record, { contactOnly: true });
}

function knownGoogleContent(record) {
  return mergeGoogleContent(mergeGoogleContent(record, placeSearch.find(record.placeId) || state.suggestions.find(place => place.placeId === record.placeId) || state.mapSuggestions.find(place => place.placeId === record.placeId)), placeDetails.peek(record.placeId));
}
function renderPlaceContent(container, record, { contactOnly = false, compact = false } = {}) {
  refreshItineraryPlaceIcons(record);
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
  const summary = googlePlaceSummary(record);
  if (!contactOnly && summary.text) {
    const text = document.createElement('p'); text.className = 'place-description'; text.textContent = summary.text; container.append(text);
    if (summary.disclosureText) {
      const credit = document.createElement('div'); credit.className = 'summary-disclosure'; credit.textContent = summary.disclosureText;
      if (/^https?:/i.test(summary.flagContentURI || '')) { const report = document.createElement('a'); report.href = summary.flagContentURI; report.textContent = 'Report'; report.target = '_blank'; report.rel = 'noopener noreferrer'; credit.append(report); }
      container.append(credit);
    }
  }
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
function refreshItineraryPlaceIcons(record) {
  if (!record.placeId) return;
  for (const svg of document.querySelectorAll('svg[data-icon-place-id]')) {
    if (svg.dataset.iconPlaceId !== record.placeId) continue;
    svg.querySelector('use')?.setAttribute('href', `#i-${placeIcon({ ...record, kind: svg.dataset.planKind })}`);
  }
  for (const pin of document.querySelectorAll('.map-place-pin')) {
    if (pin.dataset.placeId !== record.placeId) continue;
    const symbol = placeIcon({ ...record, kind: pin.dataset.planKind });
    pin.dataset.symbol = symbol; pin.querySelector('.pin-symbol use')?.setAttribute('href', `#i-${symbol}`);
  }
}
function decoratePlaceIcon(svg, record) {
  const available = knownGoogleContent(record);
  svg.querySelector('use').setAttribute('href', `#i-${placeIcon(available)}`);
  if (!record.placeId) return;
  svg.dataset.iconPlaceId = record.placeId; svg.dataset.planKind = record.kind || '';
  if (available.primaryType || available.category || available.types?.length || ['Flight', 'Train', 'Food', 'Stay', 'Tour', 'Transport'].includes(record.kind)) return;
  // Visible calendar icons share the same coalesced, lightweight request as
  // timeline ratings; never fetch full details or photos just for an icon.
  pendingDayDetails.set(svg, async () => {
    if (!svg.isConnected) return;
    try {
      if (!state.places) await boundedPlaceRequest(() => mapsReady);
      if (svg.isConnected) refreshItineraryPlaceIcons(mergeGoogleContent(record, await detailedGooglePlace(available, { compact: true })));
    } catch { /* Keep the generic icon for unknown places. */ }
  });
  dayDetailObserver.observe(svg);
}
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
  if (compact && googleRatingLabel(available)) { container.setAttribute('aria-busy', 'false'); return; }
  if (compact) container.setAttribute('aria-busy', 'true');
  if (!visible && (compact || container.classList.contains('day-card-details'))) {
    pendingDayDetails.set(container, () => { if (container.isConnected && container.dataset.request === request) hydratePlace(container, record, { contactOnly, compact, visible: true }); });
    dayDetailObserver.observe(container); return;
  }
  try {
    if (!state.places) await boundedPlaceRequest(() => mapsReady);
    if (!container.isConnected || container.dataset.request !== request) return;
    const operator = contactOnly ? await tourOperatorContacts(record) : null;
    const fresh = operator || await detailedGooglePlace(available, { compact });
    // Publish to every mounted timeline occurrence, including other days.
    for (const rating of document.querySelectorAll('.timeline-rating')) if (rating.dataset.photoPlace === record.placeId) {
      renderPlaceContent(rating, mergeGoogleContent(record, fresh), { compact: true }); rating.setAttribute('aria-busy', 'false');
    }
    if (!container.isConnected || container.dataset.request !== request) return;
    available = mergeGoogleContent(available, fresh);
    renderPlaceContent(container, available, { contactOnly, compact });
    container.setAttribute('aria-busy', 'false');
    if (!contactOnly && !compact) showPlacePhoto(container, available).catch(() => {});
  } catch (error) {
    container.setAttribute('aria-busy', 'false');
    if (!compact && !contactOnly && container.isConnected && container.dataset.request === request) showPlacePhoto(container, available).catch(() => {});
    if (!compact && !contactOnly && !googlePlaceSummary(available).text && container.isConnected && container.dataset.request === request) {
      const message = document.createElement('p'); message.className = 'place-details-status'; message.setAttribute('role', 'status');
      message.textContent = error?.message === 'PLACE_DETAILS_QUOTA' ? 'Google’s daily place-detail limit has been reached.' : 'Google place details could not load. Reopen to try again.';
      container.append(message);
    }
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
  $('place-dialog').showModal(); $('place-dialog').querySelector('.phone-sheet-body').scrollTop = 0; hydratePlace($('discovery-place-details'), place); syncDiscovery();
}
function planDiscoveredPlace(place) {
  state.infoWindow?.close();
  if (isTourOperator(place)) {
    if (!daysForTrip(state.trip).length) { $('place-dialog').close(); openCalendar(); return; }
    $('place-dialog').close(); itinerary.openTour(place);
  } else { addToDay(place); syncDiscovery(); }
}
$('add-discovery-place').addEventListener('click', () => planDiscoveredPlace(state.discoveryPlace));
$('search-map-area').addEventListener('click', () => { setWorkspaceView('explore'); exploreNearby(state.nearbyCategory, { force: true }); });
for (const id of ['place-dialog', 'plan-dialog']) $(id).addEventListener('close', () => { scheduleAreaSearch(); scheduleMapSuggestions(); });

function updateMapLink() {
  const center = state.mapUnavailable ? null : state.map?.getCenter();
  const href = mapViewURL(center ? { latitude: center.lat(), longitude: center.lng() } : state.selected, state.mapUnavailable ? 12 : state.map?.getZoom());
  $('open-google-map').hidden = !href;
  if (href) $('open-google-map').href = href; else $('open-google-map').removeAttribute('href');
}
function showMap(place, fly = false) {
  if (!state.maps || state.mapUnavailable) { updateMapLink(); return; }
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
      if (known) { event.stop(); state.infoWindow?.close(); showMapEntry({ ...known, planned: Boolean(item) }, { native: true, recenter: false }); return; }
      event.stop(); state.infoWindow?.close(); status('trip-status');
      const point = event.latLng?.toJSON();
      let match;
      try { match = await detailedGooglePlace({ placeId: event.placeId }); }
      catch {
        try { match = await detailedGooglePlace({ placeId: event.placeId }, { identityOnly: true }); }
        catch { try { match = await placeSearch.findAt(event.placeId, point); } catch { /* Keep adding available when Google cannot return details. */ } }
      }
      if (clickVersion !== state.placeClickVersion || tripId !== state.trip?.id) return;
      if (match) showMapEntry({ ...match, planned: false }, { native: true, recenter: false });
      else showLimitedMapEntry(event.placeId, point);
    });
  }
  // The map container was hidden on the start screen; allow layout to settle before moving its camera.
  requestAnimationFrame(() => {
    if (state.mapUnavailable) return;
    google.maps.event.trigger(state.map, 'resize');
    if (fly) animateMap(place);
    else state.map.moveCamera({ center: coordinates(place), zoom: 12 });
    drawMarkers(); updateMapLink();
  });
}

function renderPlan() { renderRoute(); updateTripTitle(); $('trip-heading').setAttribute('aria-label', tripTitle(state.trip)); itinerary.render(); syncSuggestionCards(); }

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
  const predictions = new Map(); let autocompleteBlockedUntil = 0;
  const report = message => inputId === 'stop-search' ? $('destination-picker-status').textContent = message || '' : status(inputId === 'destination' ? 'home-status' : 'trip-status', message);
  const hide = () => { list.hidden = true; list.replaceChildren(); input.setAttribute('aria-expanded', 'false'); };
  async function search(query, id) {
    if (inputId === 'stop-search' && !$('route-search').open) return;
    if (!state.places) { report('Search is unavailable right now.'); return; }
    try {
      token ||= new state.places.AutocompleteSessionToken();
      const request = { input: query, sessionToken: token, language: 'en' };
      if (inputId === 'destination' || inputId === 'stop-search') request.includedPrimaryTypes = ['(regions)'];
      if (biasToTrip && state.trip) request.locationBias = { center: coordinates(state.selected || state.trip), radius: 50000 };
      if (Date.now() < autocompleteBlockedUntil) { hide(); report('Search is temporarily unavailable. Try again shortly.'); return; }
      const key = `${state.selected?.placeId || ''}:${query.toLocaleLowerCase()}`;
      if (!predictions.has(key)) {
        const pending = state.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(request).catch(error => { predictions.delete(key); if (quotaFailure(error)) autocompleteBlockedUntil = Date.now() + 60000; throw error; });
        predictions.set(key, pending);
        if (predictions.size > 30) predictions.delete(predictions.keys().next().value);
      }
      const { suggestions } = await predictions.get(key);
      if (id !== requestId || input.value.trim() !== query) return;
      if (inputId === 'stop-search' && !$('route-search').open) return;
      report();
      list.replaceChildren();
      for (const suggestion of suggestions || []) {
        const prediction = suggestion.placePrediction;
        if (!prediction) continue;
        const button = document.createElement('button'); button.type = 'button'; button.className = 'suggestion'; button.setAttribute('role', 'option');
        if (inputId === 'stop-search') button.style.setProperty('--result-order', Math.min(list.children.length, 4));
        button.innerHTML = `<span class="suggestion-icon">${icon('pin')}</span><span class="suggestion-copy"><strong></strong><small></small></span>${icon('arrow')}`;
        button.querySelector('strong').textContent = prediction.mainText?.toString() || prediction.text?.toString() || '';
        button.querySelector('small').textContent = prediction.secondaryText?.toString() || '';
        button.addEventListener('click', async () => {
          hide();
          if (inputId === 'stop-search') report('Opening destination…');
          try {
            let selected;
            const known = placeSearch.find(prediction.placeId) || readTrips().flatMap(tripStops).find(place => place.placeId === prediction.placeId) || [...(state.trip?.items || []), ...state.suggestions, ...state.mapSuggestions].find(place => place.placeId === prediction.placeId && mappedPlace(place));
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
            if (inputId === 'stop-search' && !$('route-search').open) return;
            input.value = ['departure-search', 'arrival-search'].includes(inputId) ? selected.name : ''; token = null; predictions.clear();
            await onSelect(selected);
            if (inputId !== 'stop-search' || !$('route-search').open) report();
          } catch (error) {
            const serviceUnavailable = Date.now() < state.detailCooldownUntil || /REQUEST_DENIED|OVER_QUERY_LIMIT/.test(error?.message || '');
            const message = serviceUnavailable ? 'Location lookup is unavailable. Check Google Maps billing and quotas.' : 'Could not open that place. Try another result.';
            if (inputId === 'plan-location-search') $('plan-error').textContent = message; else report(message);
          }
        });
        list.append(button);
      }
      list.hidden = !list.children.length;
      input.setAttribute('aria-expanded', String(!list.hidden));
      if (list.hidden && inputId === 'stop-search') report('No destinations found. Try another name.');
    } catch { if (id === requestId) { hide(); report('Search is unavailable right now.'); } }
  }
  input.addEventListener('input', () => {
    clearTimeout(timer); const query = input.value.trim(); const id = ++requestId;
    if (inputId === 'stop-search') report();
    if (query.length < 2) { hide(); return; }
    timer = setTimeout(() => search(query, id), 450);
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
  document.addEventListener('pointerdown', event => {
    if (inputId === 'stop-search' && input.closest('.search-field')?.contains(event.target)) return;
    if (!list.contains(event.target) && event.target !== input) hide();
  });
  return { reset() { clearTimeout(timer); requestId++; hide(); input.value = ''; if (inputId === 'stop-search') report(); } };
}

function commitTrip(next) {
  state.infoWindow?.close();
  next = scheduleUnassigned(next); saveTrip(next); state.trip = next; renderPlan(); drawMarkers(); updateRecent();
}
function setWorkspaceView(view, { keepMobileMap = false } = {}) {
  state.workspaceView = view;
  setMobileMap(keepMobileMap);
  $('plan-controls').dataset.view = view;
  $('plan-panel').hidden = view !== 'itinerary';
  $('discover-panel').hidden = view !== 'explore';
  $('transport-panel').hidden = view !== 'transportation';
  $('map-column').hidden = view === 'transportation';
  for (const button of document.querySelectorAll('[data-workspace-view]')) button.setAttribute('aria-pressed', String(button.dataset.workspaceView === view));
  if (view !== 'transportation' && state.map) requestAnimationFrame(() => google.maps.event.trigger(state.map, 'resize'));
  renderPlan();
  if (view === 'itinerary') scheduleMapSuggestions();
  else { clearTimeout(state.mapSearchTimer); state.mapSearchVersion++; state.mapAreaKey = null; }
  if (view === 'explore') scheduleAreaSearch();
  else { clearTimeout(state.nearbyTimer); selection.invalidate(); state.nearbyRequest++; state.nearbyAreaKey = null; $('search-map-area').hidden = true; $('nearby-results').setAttribute('aria-busy', 'false'); }
  const panel = view === 'explore' ? $('discover-panel') : view === 'transportation' ? $('transport-panel') : $('plan-panel');
  revealSequence([...panel.children].filter(child => !child.hidden), { step: 35 });
}
function setMobileMap(show) {
  const button = $('mobile-map-toggle'), controls = $('plan-controls');
  controls.dataset.mobileSurface = show ? 'map' : 'content';
  button.setAttribute('aria-pressed', String(show));
  button.setAttribute('aria-label', show ? (state.workspaceView === 'explore' ? 'Show results' : 'Show itinerary') : 'Show map');
  button.querySelector('use').setAttribute('href', show ? '#i-list' : '#i-map');
  button.querySelector('span').textContent = show ? (state.workspaceView === 'explore' ? 'Results' : 'Itinerary') : 'Map';
  button.hidden = state.workspaceView === 'transportation';
  if (state.map) requestAnimationFrame(() => google.maps.event.trigger(state.map, 'resize'));
  if (matchMedia('(max-width:580px)').matches) {
    const surface = show ? $('map-column') : $(state.workspaceView === 'explore' ? 'discover-panel' : state.workspaceView === 'transportation' ? 'transport-panel' : 'plan-panel');
    playMotion(surface, [{ opacity: .55, translate: '0 8px' }, { opacity: 1, translate: '0 0' }], { duration: 230 });
  }
}
$('mobile-map-toggle').addEventListener('click', () => setMobileMap($('plan-controls').dataset.mobileSurface !== 'map'));
// Safari's keyboard changes the visual viewport rather than the layout height.
// Keep sheets and their primary actions above it without disabling page zoom.
function syncPhoneKeyboard() {
  const viewport = window.visualViewport;
  const phone = matchMedia('(max-width:580px)').matches;
  const keyboard = phone && viewport && viewport.scale === 1 ? Math.max(0, innerHeight - viewport.height - viewport.offsetTop) : 0;
  document.documentElement.classList.toggle('phone-keyboard-open', keyboard > 80);
  document.documentElement.style.setProperty('--keyboard-rise', `${keyboard}px`);
  document.documentElement.style.setProperty('--visual-height', `${phone && viewport ? viewport.height : innerHeight}px`);
}
window.visualViewport?.addEventListener('resize', syncPhoneKeyboard);
window.visualViewport?.addEventListener('scroll', syncPhoneKeyboard);
window.addEventListener('resize', syncPhoneKeyboard);
syncPhoneKeyboard();
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
  const scopedStop = state.stopFilter && datesForStop(state.trip, state.stopFilter).includes(day) ? tripStops(state.trip).find(stop => stop.placeId === state.stopFilter) : null;
  const stop = scopedStop || destinationForDay(state.trip, tripStops(state.trip), day);
  if (stop && state.stopFilter) state.stopFilter = stop.placeId;
  if (stop && stop.placeId !== state.selected?.placeId) selectStop(stop, false);
  else renderRoute();
}
const dayRoutes = createDayRoutes({ state, commit: commitTrip, icon, cancelCamera: () => { cancelAnimationFrame(state.animation); state.animation = 0; state.cameraMoving = false; } });
const itinerary = createItineraryUI({ state, commit: commitTrip,
  explore: () => { updateDayContext(state.day); setWorkspaceView('explore'); },
  onDayChange: updateDayContext,
  editStopDates: () => openStopEditor(tripStops(state.trip).find(stop => stop.placeId === state.stopFilter) || state.selected),
  onRendered: () => { pruneDayDetails(); dayRoutes.render(); drawMarkers(); },
  onModeChange: mode => { if ($('plan-controls').dataset.mode === mode) return; $('plan-controls').dataset.mode = mode; if (state.map) requestAnimationFrame(() => google.maps.event.trigger(state.map, 'resize')); },
  chooseDates: () => { $('edit-date-picker').hidden = true; openCalendar(); $('save-dates').focus({ preventScroll: true }); },
  focusPlace: place => { animateMap(place, 15); document.querySelectorAll('[data-place-id]').forEach(element => element.classList.toggle('selected', element.dataset.placeId === place.placeId)); }, hydratePlace, decoratePlaceIcon, icon });
enhanceTimePickers(); enhanceDropdowns(); enhanceDisclosures();
new MutationObserver(records => {
  for (const record of records) for (const added of record.addedNodes) if (added.nodeType === 1 && !added.closest('.gm-style, .day-transition-snapshot')) enhanceDisclosures(added);
}).observe(document.body, { childList: true, subtree: true });
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
    if (version === form.dataset.version && timeZone && form.elements[`${leg}_location`].dataset.placeId === selectedPlaceId && form.elements[`${leg}_time_zone`].value === previousZone) { form.elements[`${leg}_time_zone`].value = timeZone; refreshDropdowns(form); }
  } catch { /* Keep the editable time zone. */ }
  finally { if (version === form.dataset.version) { form.dataset.pendingZones = String(Math.max(0, Number(form.dataset.pendingZones) - 1)); form.querySelector('[type="submit"]').disabled = Number(form.dataset.pendingZones) > 0; } }
  });
}
setupAutocomplete('destination', 'suggestions', createOrOpenTrip);
setupAutocomplete('plan-location-search', 'plan-location-suggestions', place => { itinerary.attachPlace(place); animateMap(place, 15); }, true);
setupAutocomplete('place-search', 'place-suggestions', place => { animateMap(place, 15); openDiscovery(place); }, true);
let pendingStop = null, editingStopId = null;
function renderStopDraft(place, existing = false) {
  pendingStop = place; $('destination-picker-status').textContent = ''; $('destination-picker-status').classList.remove('error');
  $('stop-date-panel').hidden = false; $('stop-suggestions').hidden = true;
  $('stop-search').closest('.search-field').hidden = true;
  $('stop-selection-name').textContent = place.name; $('stop-selection-address').textContent = place.address || '';
  $('destination-picker-title').textContent = existing ? 'Edit stop' : 'Add stop';
  $('save-stop').firstChild.textContent = existing ? 'Save changes' : 'Add stop';
  const days = daysForTrip(state.trip), entries = stopSchedule(state.trip);
  const entry = entries.find(item => item.stop.placeId === place.placeId);
  const last = entries.at(-1);
  const initial = entry?.start || (last?.stop.endDate ? last.end : days[Math.min(days.length - 1, Math.max(0, days.indexOf(last?.start) + 1))]);
  $('stop-date-fields').hidden = !days.length;
  for (const [id, value] of [['stop-arrival', initial], ['stop-departure', entry?.end || state.trip.endDate]]) {
    const select = $(id); select.replaceChildren();
    for (const day of days) { const option = document.createElement('option'); option.value = day; option.textContent = dateLong(day); select.append(option); }
    if (value) select.value = value; refreshDropdowns(select);
  }
  $('stop-route-actions').hidden = !existing; $('change-stop-place').hidden = existing;
  const index = entries.findIndex(item => item.stop.placeId === place.placeId);
  $('stop-earlier').disabled = index <= 0; $('stop-later').disabled = index >= entries.length - 1;
  $('remove-stop').disabled = entries.length < 2;
  if (!days.length) $('destination-picker-status').textContent = 'Add trip dates to schedule this stop.';
  revealSequence($('stop-date-panel').children, { step: 45 });
}
const stopAutocomplete = setupAutocomplete('stop-search', 'stop-suggestions', place => {
  if (!state.trip || !$('route-search').open) return;
  if (tripStops(state.trip).some(stop => stop.placeId === place.placeId)) { $('destination-picker-status').textContent = 'That destination is already on this trip.'; return; }
  renderStopDraft(place);
});
$('save-stop').addEventListener('click', () => {
  if (!pendingStop || !state.trip) return;
  try {
    let next = editingStopId ? state.trip : addStop(state.trip, pendingStop);
    if (daysForTrip(state.trip).length) next = setStopDates(next, pendingStop.placeId, $('stop-arrival').value, $('stop-departure').value);
    const stop = tripStops(next).find(stop => stop.placeId === pendingStop.placeId);
    saveTrip(next); state.trip = next; state.stopFilter = stop.placeId; updateRecent(); $('route-search').close(); selectStop(stop);
    status('trip-status', editingStopId ? 'Stop dates updated' : `Added ${stop.name}`);
    if (!stop.timeZone) placeZone(stop).then(timeZone => {
      if (!timeZone || state.trip?.id !== next.id || !tripStops(state.trip).some(item => item.placeId === stop.placeId)) return;
      const updated = { ...state.trip, stops: tripStops(state.trip).map(item => item.placeId === stop.placeId ? { ...item, timeZone } : item) };
      saveTrip(updated); state.trip = updated; if (state.selected?.placeId === stop.placeId) state.selected = { ...state.selected, timeZone };
    }).catch(() => {});
  } catch (error) { $('destination-picker-status').textContent = error.message || 'Could not save this stop.'; $('destination-picker-status').classList.add('error'); }
});
$('stop-arrival').addEventListener('change', () => {
  if ($('stop-departure').value < $('stop-arrival').value) { $('stop-departure').value = $('stop-arrival').value; refreshDropdowns($('stop-departure')); }
  $('destination-picker-status').textContent = '';
});
$('stop-departure').addEventListener('change', () => { $('destination-picker-status').textContent = ''; });
$('change-stop-place').addEventListener('click', () => {
  if (editingStopId) { $('route-search').close(); openDestinationPicker(); return; }
  pendingStop = null; $('stop-date-panel').hidden = true; $('stop-search').closest('.search-field').hidden = false;
  stopAutocomplete.reset(); $('stop-search').focus({ preventScroll: true });
});
function openStopEditor(stop) {
  if (!stop || !state.trip) return;
  editingStopId = stop.placeId; $('trip-menu').hidden = true;
  stopAutocomplete.reset(); $('route-search').showModal(); renderStopDraft(stop, true);
}
for (const [id, direction] of [['stop-earlier', -1], ['stop-later', 1]]) $(id).addEventListener('click', () => {
  const index = tripStops(state.trip).findIndex(stop => stop.placeId === editingStopId);
  commitRoute(moveStop(state.trip, index, direction), editingStopId);
  renderStopDraft(tripStops(state.trip).find(stop => stop.placeId === editingStopId), true);
});
$('remove-stop').addEventListener('click', () => {
  const removedId = editingStopId, stop = tripStops(state.trip).find(stop => stop.placeId === removedId);
  if (state.stopFilter === removedId) state.stopFilter = null;
  if (commitRoute(removeStop(state.trip, removedId))) { $('route-search').close(); status('trip-status', `Removed ${stop.name}`); }
});

$('stop-search').addEventListener('input', () => { $('clear-destination-query').hidden = !$('stop-search').value; });
$('clear-destination-query').addEventListener('click', () => {
  stopAutocomplete.reset(); $('clear-destination-query').hidden = true;
  $('stop-search').focus({ preventScroll: true });
});

$('hero-credits-toggle').addEventListener('click', () => {
  const panel = $('hero-photo-credits'); panel.hidden = !panel.hidden;
  $('hero-credits-toggle').setAttribute('aria-expanded', String(!panel.hidden));
  if (!panel.hidden) playMotion(panel, [{opacity:0,transform:'scale(.98)'},{opacity:1,transform:'none'}], {duration:180});
});
document.addEventListener('pointerdown', event => { if (!$('hero-photo-credits').hidden && !event.target.closest('#hero-photo-credits,#hero-credits-toggle')) { $('hero-photo-credits').hidden = true; $('hero-credits-toggle').setAttribute('aria-expanded','false'); } });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('hero-photo-credits').hidden) { $('hero-photo-credits').hidden = true; $('hero-credits-toggle').setAttribute('aria-expanded','false'); $('hero-credits-toggle').focus({preventScroll:true}); } });
$('back-button').addEventListener('click', () => showHome());
$('mobile-back').addEventListener('click', () => showHome());
$('my-trips').addEventListener('click', () => showHome());
document.querySelector('.brand').addEventListener('click', event => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault(); showHome();
});
function openDestinationPicker() {
  $('trip-menu').hidden = true;
  editingStopId = null; pendingStop = null; stopAutocomplete.reset();
  $('destination-picker-title').textContent = 'Add stop'; $('stop-date-panel').hidden = true; $('stop-search').closest('.search-field').hidden = false;
  $('clear-destination-query').hidden = true;
  $('route-search').showModal();
  $('stop-search').focus({ preventScroll: true });
}
$('add-stop').addEventListener('click', openDestinationPicker);
$('mobile-add-stop').addEventListener('click', openDestinationPicker);
$('close-destination-picker').addEventListener('click', () => $('route-search').close());
$('route-search').addEventListener('close', () => stopAutocomplete.reset());
$('edit-route').addEventListener('click', () => openStopEditor(state.selected));
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
  const next = { ...state.trip, startDate, endDate, items, stops: tripStops(state.trip).map(stop => ({ ...stop, date: validDays.includes(stop.date) ? stop.date : null, endDate: validDays.includes(stop.endDate) ? stop.endDate : null })) };
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
$('export-calendar').addEventListener('click', () => {
  try {
    downloadTripCalendar(state.trip);
    $('trip-menu').hidden = true;
    $('trip-menu-button').focus({ preventScroll: true });
    status('trip-status', 'Calendar downloaded. Import it into your calendar; later trip edits need a new export.');
  } catch (error) { status('trip-status', error.message); }
});
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
