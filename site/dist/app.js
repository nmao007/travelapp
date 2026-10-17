import { phoneMediaQuery, phoneViewport } from './phone-devices.js';
import { phonePlaceSymbol } from './phone-motion.js';
import { paintPlaceArt, placeArt } from './place-art.js';
import { createPlaceTargets } from './place-targets.js';
import { createWallet } from './wallet-ui.js';
import { createTravelEssentials } from './travel-essentials.js';
import { placeMapsURL, mapViewURL, directionsMapsURL } from './maps-links.js';
import { createPlaceSearch, createPlaceDetails, placeSearchGroups, mixedMapPlaces, createQuotaMemory, placeIcon, createSearchSelection, quotaFailure, boundedPlaceRequest } from './place-search.js';
import { isTourOperator } from './tour-model.js';
import { playMotion, closeDialogSmooth, revealSequence, reducedMotion, installButtonMotion, installSurfaceMotion } from './motion.js';
import { createTripBanner } from './trip-banner.js';
import { readTrips, saveTrip, deleteTrip, addPlace, removePlace, movePlace, addStop, moveStop, removeStop, tripStops, stopSchedule, datesForStop, setStopDates, tripTitle, renameTrip, currentAccount, createAccount, signIn, signOut, restoreSession, loadCloudTrips, loadPersonalIdeas, savePersonalIdea, deletePersonalIdea } from './trip-store.js';
import { isPlaced, unplacedItems, persistableBoardTrip, withBoardChange, createBoardObject, placeExistingIdea, assignToFrame, movePlacedItems, suggestedFrame, readBoardViewport, writeBoardViewport, boardSnapshotData, libraryRecord, defaultSize, FRAME_TYPE, BOARD_SCALE_MIN, BOARD_SCALE_MAX } from './board-model.js';
import { calendarMonth, presetRange } from './date-range.js';
import { datesForTrip, eventsForDay, mappedPlace, makePlan } from './itinerary-model.js';
import { createDayRoutes } from './day-routes.js';
import { createItineraryUI } from './itinerary-ui.js';
import { mapEntries, scheduleUnassigned, googlePlaceRecord, destinationForDay, googlePlaceSummary, googleRatingLabel, mergeGoogleContent, mapLabelPosition } from './place-model.js';
import { enhanceDropdowns, refreshDropdowns } from './dropdowns.js';
import { viewportSearchArea, inSearchArea, createSearchAreaTracker } from './explore-model.js';
import { createPhotoLookup, resolvePlacePhoto, createPhotoDisplayCache } from './place-photos.js';
import { downloadTripGuide } from './trip-guide.js';
import { downloadTripCalendar } from './calendar-export.js';
import { createTransientNotice } from './notices.js';
import { enhanceTimePickers } from './time-picker.js';
import { enhanceDisclosures } from './expansion.js';
import { enablePhoneTouch } from './phone-touch.js';
import { calendarStops, calendarStopOnDay, renderCalendarStops } from './calendar-stops.js';
import { changeTripDates, shiftTripDays, dateOffset, offsetDate } from './trip-dates.js';


const $ = id => document.getElementById(id);
enablePhoneTouch(document);
const phoneHeaderLayout = matchMedia(phoneMediaQuery);
// Credits open outside the photo strip so the narrow header cannot clip them.
function positionHeroCredits() {
  if (phoneHeaderLayout.matches) $('trip-masthead').append($('hero-photo-credits'));
  else $('hero-credits-toggle').after($('hero-photo-credits'));
}
positionHeroCredits();
phoneHeaderLayout.addEventListener('change', positionHeroCredits);
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
let resolveMapsReady;
const mapsReady = new Promise(resolve => { resolveMapsReady = resolve; });
let quotaStorage; try { quotaStorage = sessionStorage; } catch { /* Storage is optional. */ }
const quotaMemory = createQuotaMemory(quotaStorage);
const state = { maps: null, places: null, markerClass: null, map: null, mapUnavailable: false, marker: null, stopMarkers: [], placeMarkers: [], suggestionMarkers: [], suggestions: [], selected: null, trip: null, day: 'ideas', animation: 0, config: null, pendingNearby: null, nearbyRequest: 0, photoRequest: 0, calendarRange: { start: null, end: null }, calendarYear: 0, calendarMonth: 0, routeEditing: false, stopFilter: null, planMode: 'list', workspaceView: 'itinerary', nearbyCategory: 'see', detailCooldownUntil: quotaMemory.read('selection-details'), photoCooldownUntil: quotaMemory.read('photo-details'), detailCache: new Map(), imageCache: new Map(), infoWindow: null, activePlaceId: null, discoveryPlace: null, mapSuggestions: [], mapAreaKey: null, mapSearchVersion: 0, mapSearchTimer: null, placeClickVersion: 0, nearbyAreaKey: null, nearbyTimer: null, cameraMoving: false, boardScale: 1, boardX: 0, boardY: 0, boardConnect: false, boardSource: null, boardGroupMode: false, boardSelection: [], boardDrawMode: false, boardPenColor: 'sun', boardPenWidth: 12, boardDrawing: null, boardPointer: null, boardEditing: null, boardHistory: [], boardFuture: [], boardSnapshot: null, boardView: 'canvas', boardSaveTimer: null, boardLibrary: [] };
let workspaceTrail = [];
const boardPointers = new Map();
const tripBanner = createTripBanner({ workspace: $('workspace'), header: $('trip-masthead'), hero: $('destination-hero'), onResize: () => { if (state.map) requestAnimationFrame(() => google.maps.event.trigger(state.map, 'resize')); } });
const dateLabel = value => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
const dateLong = value => new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
const tripDateLabel = trip => trip.startDate && trip.endDate ? `${dateLabel(trip.startDate)} – ${dateLabel(trip.endDate)}` : 'Add dates';
const coordinates = place => ({ lat: place.latitude, lng: place.longitude });
const notices = new Map(['home-status', 'trip-status'].map(id => [id, createTransientNotice($(id), { onHide: () => { $(id).textContent = ''; } })]));
const status = (id, text = '') => { if (!text) { notices.get(id).clear(); return; } $(id).textContent = text; notices.get(id).show(); };
window.addEventListener('trippilot-cloud-save-ok', event => { if(state.trip?.id===event.detail?.id) $('board-save-state').textContent='Synced'; });
window.addEventListener('trippilot-cloud-save-error', event => { if(state.workspaceView==='ideas') $('board-save-state').textContent='Sync paused · saved on this device'; });

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
    { opacity: .4 },
    { opacity: 1 },
  ], { duration: 220 });
}

function updateRecent() {
  const trips = readTrips();
  $('my-trips').hidden = !trips.length && !currentAccount();
  $('my-trips').firstChild.textContent = currentAccount() ? 'My trips ' : 'Trips ';
  $('trip-count').textContent = String(trips.length);
  $('recent').hidden = !trips.length;
  // The home screen is rebuilt when opened, not on every edit behind a sheet.
  if ($('home-view').hidden) return;
  $('recent-items').replaceChildren();
  for (const trip of trips.slice(0, 6)) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'recent-trip';
    button.innerHTML = `${placeArt('guide')}<span class="recent-trip-copy"><strong></strong><small></small></span>${icon('arrow')}`;
    button.querySelector('strong').textContent = tripTitle(trip);
    button.querySelector('small').textContent = trip.startDate ? tripDateLabel(trip) : '';
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
  $('phone-account').textContent = account ? 'Sign out' : 'Sign in';
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
$('account-close').addEventListener('click', () => closeDialogSmooth($('account-dialog')));
$('account-dialog').addEventListener('click', event => { if (event.target === $('account-dialog')) closeDialogSmooth($('account-dialog')); });
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
  workspaceTrail = [];
  clearMapSearch(); selection.invalidate();
  itinerary.clearRemoval(); dayRoutes.clear();
  $('trip-title-input').hidden = true; $('edit-trip-title').hidden = false;
  cancelAnimationFrame(state.animation);
  state.photoRequest++; state.nearbyRequest++; clearTimeout(state.nearbyTimer); state.cameraMoving = false;
  state.selected = null; state.trip = null; state.infoWindow?.close(); $('place-dialog').close(); $('plan-dialog').close(); $('route-search').close();
  wallet.close();
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
  selectStop(stop);
  $('day-content').scrollTop = 0; $('day-tabs').scrollLeft = 0;
}
let routeSnapshot = null;
function renderRoute() {
  const entries = stopSchedule(state.trip);
  const snapshot = JSON.stringify([state.trip.id, state.stopFilter, entries.map(entry => [entry.stop.placeId, entry.stop.name, entry.start, entry.end])]);
  if (routeSnapshot === snapshot) return;
  routeSnapshot = snapshot;
  const list = $('route-list'), scroll = list.scrollLeft;
  const focusedStop = list.contains(document.activeElement) ? document.activeElement.dataset.stopId : null;
  $('route-bar').dataset.stopCount = String(entries.length);
  $('destination-hero').dataset.stopCount = String(entries.length);
  list.replaceChildren(); list.hidden = entries.length < 2;
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
  const destinationPicker = $('mobile-stop-selector');
  const options = [];
  for (const entry of entries) {
    const option = new Option(entry.stop.name, entry.stop.placeId);
    option.label = `${entry.stop.name} · ${stopRangeLabel(entry)}`;
    options.push(option);
  }
  destinationPicker.replaceChildren(...options);
  destinationPicker.disabled = entries.length < 2;
  destinationPicker.value = state.stopFilter || entries[0]?.stop.placeId || '';
  refreshDropdowns(destinationPicker);
}

function selectStop(stop, syncDay = true) {
  if (!stop || !state.trip) return;
  state.stopFilter = stop.placeId;
  state.infoWindow?.close(); state.activePlaceId = null; state.nearbyAreaKey = null; clearTimeout(state.nearbyTimer); $('search-map-area').hidden = true;
  const firstDay = datesForStop(state.trip, stop.placeId)[0];
  if (syncDay && firstDay) state.day = firstDay;
  clearMapSearch(); selection.invalidate();
  state.selected = stop; state.photoRequest++; state.nearbyRequest++; state.suggestions = [];
  $('nearby-results').replaceChildren();
  updateTripTitle();
  $('trip-address').textContent = stop.address || '';
  $('map-caption').textContent = stop.name;

  renderPlan(); showMap(stop, true);
  if (state.places?.Place || matchMedia(phoneMediaQuery).matches) loadDestinationPhoto(stop);
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
  workspaceTrail = [];
  clearMapSearch(); selection.invalidate();
  if (trip) place = tripStops(trip)[0] || place;
  $('trip-title-input').hidden = true; $('edit-trip-title').hidden = false;
  $('place-dialog').close(); $('plan-dialog').close(); $('transport-dialog').close();
  state.selected = place; state.trip = trip ? scheduleUnassigned(trip) : trip;
  const savedBoardView = state.trip ? readBoardViewport(state.trip.id, localStorage) : { x: 0, y: 0, scale: 1 }; state.boardX = savedBoardView.x; state.boardY = savedBoardView.y; state.boardScale = savedBoardView.scale; state.boardHistory = []; state.boardFuture = []; if (state.trip) state.trip = persistableBoardTrip(state.trip); state.boardSnapshot = state.trip ? boardSnapshot() : null; state.boardView = 'canvas'; state.boardInboxOpen = false; setBoardView('canvas');
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
  $('edit-date-picker').close();
  $('route-search').close();
  state.routeEditing = false; state.stopFilter = place.placeId;
  status('trip-status');
  $('hero-gallery').replaceChildren();
  if (trip) {
    state.planMode = 'list';
    itinerary.resetNavigation();
    renderRoute();
    state.day = datesForStop(trip, place.placeId)[0] || 'ideas';
    renderPlan(); setWorkspaceView('itinerary', { remember: false });
    ensureTripZone(trip);
    updateTripURL(trip.id);
  }
  tripBanner.reset();
  showMap(place, true, true);
  if (state.places?.Place || matchMedia(phoneMediaQuery).matches) loadDestinationPhoto(place);
}

function openTrip(trip) { showWorkspace(trip, trip); }

function createOrOpenTrip(place) {
  const existing = readTrips().find(trip => trip.placeId === place.placeId);
  if (existing) { openTrip(existing); return; }
  const tripId = crypto.randomUUID();
  const arrivalDraft = { id: crypto.randomUUID(), trip_id: tripId, mode: 'Flight', service_id: '', departure_location: 'Starting point', arrival_location: place.name, departure_date: '', departure_time: '', departure_time_zone: 'UTC', arrival_date: '', arrival_time: '', arrival_time_zone: place.timeZone || 'UTC', notes: '', draft: true, leg: 'arrival', toPlaceId: place.placeId };
  const trip = { id: tripId, ...place, stops: [place], startDate: null, endDate: null, items: [], transport: [arrivalDraft], createdAt: new Date().toISOString() };
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
  if (!state.trip || phoneHeaderLayout.matches) return;
  // The first destination supplies one continuous cover, independent of the active stop.
  const gallery = $('hero-gallery'), stops = tripStops(state.trip).slice(0, 1), route = `${state.trip.id}:${stops[0].placeId}`;
  if (gallery.dataset.route === route && gallery.childNodes.length) return;
  gallery.dataset.route = route; gallery.replaceChildren(); $('hero-photo-credits').replaceChildren(); $('hero-credits-toggle').hidden = true; $('menu-photo-credits').hidden = true; $('hero-photo-credits').hidden = true; $('hero-credits-toggle').setAttribute('aria-expanded', 'false');
  for (const [index, stop] of stops.entries()) {
    const segment = document.createElement('figure'); segment.className = 'hero-segment';
    segment.style.setProperty('--segment-delay', `${Math.min(index * 90, 360)}ms`);
    const image = document.createElement('img'); image.className = 'hero-photo'; image.alt = stop.name; image.hidden = true;
    const credit = document.createElement('figcaption'); credit.className = 'hero-credit'; credit.hidden = true;
    segment.append(image, credit); gallery.append(segment);
    destinationPhoto(stop).then(source => {
      if (!source?.src || !segment.isConnected || gallery.dataset.route !== route) return;
      const loaded = source.image.cloneNode(true); loaded.className = 'hero-photo'; loaded.alt = stop.name; loaded.hidden = false; image.replaceWith(loaded);
      if (source.googlePhoto) { credit.dataset.google = 'true'; photoCredits(credit, source.googlePhoto); } else wikimediaCredits(credit, source);
      if (!credit.hidden) { const group = document.createElement('div'), title = document.createElement('strong'); title.textContent = stop.name; group.append(title, ...Array.from(credit.childNodes, node => node.cloneNode(true))); $('hero-photo-credits').append(group); $('hero-credits-toggle').hidden = false; $('menu-photo-credits').hidden = false; }
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
  pin.append(symbol, label); pinTargets.add(pin.dataset.placeId, pin); return pin;
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
        playMotion(surface, [
          { opacity: .2, translate: '0 12px', scale: '.94' },
          { opacity: 1, translate: '0 -2px', scale: '1.015', offset: .72 },
          { opacity: 1, translate: '0 0', scale: '1' },
        ], { duration: 360 });
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
      const keepMobileMap = matchMedia(phoneMediaQuery).matches && $('plan-controls').dataset.mobileSurface === 'map';
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

let markerSnapshot = null, markerMap = null;
function drawMarkers() {
  // Editing the phone itinerary should not rebuild an offscreen Google scene.
  if (phoneHeaderLayout.matches && $('plan-controls').dataset.mobileSurface !== 'map') return;
  if (!state.map || state.mapUnavailable || !state.markerClass || !state.selected) return;
  try {
  const optional = google.maps.CollisionBehavior.OPTIONAL_AND_HIDES_LOWER_PRIORITY;
  // Planned places take priority. Suggestions for those places never get a second pin.
  const dayOnly = state.workspaceView === 'itinerary' && state.planMode === 'day';
  const stopDays = state.stopFilter && state.trip ? datesForStop(state.trip, state.stopFilter) : null;
  const items = dayOnly && state.trip ? eventsForDay(state.trip, state.day).filter(event => event.kind === 'activity').map(event => event.item) : stopDays ? state.trip.items.filter(item => stopDays.includes(item.day)) : state.trip?.items;
  const area = currentSearchArea();
  const recommendations = state.mapSuggestions.filter(place => !area || inSearchArea(area, { lat: place.latitude, lng: place.longitude }));
  const entries = mapEntries(items, recommendations, { timeZone: state.trip?.timeZone || 'UTC' });
  const snapshot = JSON.stringify([state.trip?.id, state.selected.placeId, entries]);
  if (markerMap === state.map && markerSnapshot === snapshot) return;
  hideMapLabel();
  if (state.marker) state.marker.map = null;
  for (const marker of [...state.stopMarkers, ...state.placeMarkers, ...state.suggestionMarkers]) marker.map = null;
  state.stopMarkers = []; state.placeMarkers = []; state.suggestionMarkers = []; pinTargets.clear();
  for (const entry of entries) {
    const pin = pinContent(entry), priority = entry.planned ? 1000 : Math.round((entry.rating || 0) * 100) + Math.min(99, Math.round(Math.log10((entry.ratingCount || 0) + 1) * 20));
    const marker = new state.markerClass({ map: state.map, position: coordinates(entry), title: entry.name, content: pin, gmpClickable: true, collisionBehavior: entry.planned ? google.maps.CollisionBehavior.REQUIRED_AND_HIDES_OPTIONAL : optional, zIndex: priority });
    const showLabel = () => { if (!phoneHeaderLayout.matches) showMapLabel(marker, pin, entry, priority); };
    pin.addEventListener('pointerenter', showLabel); marker.addEventListener('focusin', showLabel);
    pin.addEventListener('pointerleave', () => { if (hoveredMapPin?.marker === marker) hideMapLabel(); });
    marker.addEventListener('focusout', () => { if (hoveredMapPin?.marker === marker) hideMapLabel(); });
    marker.addEventListener('gmp-click', () => showMapEntry(entry));
    (entry.planned ? state.placeMarkers : state.suggestionMarkers).push(marker);
  }
  markerMap = state.map; markerSnapshot = snapshot;
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
  if (phoneHeaderLayout.matches && $('plan-controls').dataset.mobileSurface !== 'map') return;
  if (state.planMode === 'calendar' && !matchMedia(phoneMediaQuery).matches) return;
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
  try {
    const next = addPlace(state.trip, item);
    if (next === state.trip) { status('trip-status', 'Already on this day.'); return; }
    state.infoWindow?.close(); commitTrip(next); animateMap(place, 15); status('trip-status', `Added to ${dateLong(state.day)}`); syncDiscovery(); }
  catch (error) { status('trip-status', error.message || 'Could not save this place.'); }
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
    image.decoding = 'async';
    image.onload = async () => { clearTimeout(timeout); try { await image.decode(); } catch { /* A loaded image can still be displayed. */ } resolve(image); };
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

function mountPlacePhoto(container, record, source, className) {
  if (container.dataset.photoSrc === source.src && container.querySelector('img')) return;
  const image = source.image.cloneNode(true); image.alt = record.name;
  image.width = source.image.naturalWidth || 900; image.height = source.image.naturalHeight || 600;
  if (className === 'detail-photo') {
    const credit = document.createElement('figcaption');
    if (source.googlePhoto) photoCredits(credit, source.googlePhoto); else wikimediaCredits(credit, source);
    const figure = document.createElement('figure'); figure.className = className; figure.append(image, credit);
    const existing = container.querySelector('.detail-photo'); if (existing) existing.replaceWith(figure); else container.prepend(figure);
  } else {
    container.replaceChildren(image);
    // Credits stay with the full photo in the opened place details.
  }
  container.dataset.photoSrc = source.src;
}
async function showPlacePhoto(container, record, className = 'detail-photo') {
  const request = crypto.randomUUID(); container.dataset.photoRequest = request;
  const width = className === 'detail-photo' ? 900 : 160;
  // Mount session images synchronously, before waiting for details or a sharper photo.
  const cached = displayedPhotos.peek(record, width);
  if (cached) mountPlacePhoto(container, record, cached, className);
  const source = await displayedPhotos(record, width);
  if (!container.isConnected || container.dataset.photoRequest !== request || container.dataset.photoPlace !== record.placeId) return;
  if (source) mountPlacePhoto(container, record, source, className);
  else if (!cached) container.querySelector('.photo-pending')?.remove();
}
const photoObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    photoObserver.unobserve(entry.target);
    const record = placeSearch.find(entry.target.dataset.photoPlace) || state.suggestions.find(place => place.placeId === entry.target.dataset.photoPlace);
    if (record) showPlacePhoto(entry.target, record, 'recommendation-photo').catch(() => {});
  }
}, { rootMargin: '240px 0px' });

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
    const rating = googleRatingLabel(place);
    meta.textContent = [rating ? place.rating.toFixed(1) : '', place.category].filter(Boolean).join(' · ');
    meta.setAttribute('aria-label', [rating, place.category].filter(Boolean).join(' · '));
    if (rating) meta.insertAdjacentHTML('afterbegin', icon('star')); copy.append(title, meta); open.append(photo, copy);
    open.addEventListener('click', () => { animateMap(place, 15); openDiscovery(place); });
    const add = document.createElement('button'); add.type = 'button'; add.className = 'recommendation-add'; add.innerHTML = icon('plus'); add.setAttribute('aria-label', `Add ${place.name} to day`); add.addEventListener('click', () => planDiscoveredPlace(place));
    row.append(open, add); container.append(row); recommendationMotion.observe(row);
    photo.dataset.photoPlace = place.placeId;
    const cached = displayedPhotos.peek(place, 160);
    if (cached) mountPlacePhoto(photo, place, cached, 'recommendation-photo');
    photoObserver.observe(photo);
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
function renderPlaceContent(container, record, { contactOnly = false, compact = false, daySummary = false } = {}) {
  refreshItineraryPlaceIcons(record);
  const photo = container.querySelector('.detail-photo'); container.replaceChildren();
  if (daySummary) {
    const line = (className, text) => { if (!text) return; const element = document.createElement('p'); element.className = className; element.textContent = text; container.append(element); };
    line('day-place-category', record.category || (record.kind !== 'Activity' ? record.kind : ''));
    line('place-address', record.address);
    const descriptions = record.regularOpeningHours?.weekdayDescriptions || record.currentOpeningHours?.weekdayDescriptions;
    if (record.day && descriptions?.length) {
      const weekday = new Intl.DateTimeFormat('en', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${record.day}T12:00:00Z`));
      const hours = descriptions.find(text => text.startsWith(`${weekday}:`));
      if (hours) line('day-place-hours', hours.slice(weekday.length + 1).trim());
    }
    const summary = googlePlaceSummary(record);
    // Keep provider summaries with their disclosure in the full place editor.
    if (summary.text && !summary.disclosureText) line('day-place-description', summary.text);
    const links = document.createElement('div'); links.className = 'day-place-actions';
    const destinations = [[record.address || mappedPlace(record) ? 'Directions' : null, directionsMapsURL(record, null, 'DRIVE'), 'directions'], ['Website', record.websiteURI, 'external']];
    for (const [label, url, symbol] of destinations) {
      if (!label || !/^https?:/i.test(url || '')) continue;
      const link = document.createElement('a'); link.className = 'day-place-link'; link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
      link.innerHTML = icon(symbol); link.append(document.createTextNode(label)); link.setAttribute('aria-label', `${label} for ${record.name}`); links.append(link);
    }
    const actions = container.closest('.day-place-card')?.querySelector('.day-card-links');
    if (actions) actions.replaceChildren(links);
    else if (links.childElementCount) container.append(links);
    return;
  }
  if (photo && !compact && !contactOnly) container.append(photo);
  const rating = googleRatingLabel(record);
  if (rating) {
    const meta = document.createElement(compact ? 'span' : 'a'); meta.className = 'detail-rating'; meta.innerHTML = icon('star'); meta.append(document.createTextNode(compact ? String(record.rating) : rating));
    if (!compact) { meta.href = placeMapsURL(record); meta.target = '_blank'; meta.rel = 'noopener noreferrer'; }
    meta.setAttribute('aria-label', `${rating} on Google Maps`); container.append(meta);
  }
  if (compact) {
    if (record.category) { const category = document.createElement('span'); category.className = 'glance-category'; category.textContent = record.category; container.append(category); }
    if (record.businessStatus && record.businessStatus !== 'OPERATIONAL') { const closed = document.createElement('span'); closed.className = 'closed-status'; closed.textContent = 'Closed'; container.append(closed); }
    return;
  }
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
    const link = document.createElement('a'); link.innerHTML = icon(url.startsWith('tel:') ? 'phone' : label === 'Directions' ? 'directions' : label === 'Google Maps' ? 'map' : 'external'); const text = document.createElement('span'); text.textContent = label; link.append(text); link.setAttribute('aria-label', label); link.title = label; link.href = url; link.className = 'detail-chip'; if (!url.startsWith('tel:')) { link.target = '_blank'; link.rel = 'noopener noreferrer'; } links.append(link);
  }
  const dayLinks = container.closest('.day-place-card')?.querySelector('.day-card-links');
  if (dayLinks) dayLinks.replaceChildren(links); else container.append(links);
  const features = document.createElement('div'); features.className = 'place-features';
  if (record.priceLevel) { const price = document.createElement('span'); price.textContent = String(record.priceLevel).replaceAll('_', ' ').toLowerCase(); features.append(price); }
  if (record.accessibilityOptions?.hasWheelchairAccessibleEntrance === true) { const accessible = document.createElement('span'); accessible.textContent = 'Step-free entrance'; features.append(accessible); }
  if (features.childNodes.length) container.append(features);
  for (const provider of record.attributions || []) { if (!/^https?:/i.test(provider.providerURI || '')) continue; const link = document.createElement('a'); link.className = 'provider-credit'; link.href = provider.providerURI; link.textContent = provider.provider; link.target = '_blank'; link.rel = 'noopener noreferrer'; container.append(link); }
}
const pendingDayDetails = new Map(), iconTargets = createPlaceTargets(), pinTargets = createPlaceTargets();
function refreshItineraryPlaceIcons(record) {
  if (!record.placeId) return;
  for (const svg of iconTargets.get(record.placeId)) {
    if (!svg.isConnected) continue;
    const available = { ...record, kind: svg.dataset.planKind };
    const symbol = placeIcon(available);
    paintPlaceArt(svg, phonePlaceSymbol(available, symbol));
  }
  for (const pin of pinTargets.get(record.placeId)) {
    const symbol = placeIcon({ ...record, kind: pin.dataset.planKind });
    pin.dataset.symbol = symbol; pin.querySelector('.pin-symbol use')?.setAttribute('href', `#i-${symbol}`);
  }
}
function decoratePlaceIcon(svg, record) {
  const available = knownGoogleContent(record);
  const symbol = placeIcon(available);
  paintPlaceArt(svg, phonePlaceSymbol(available, symbol));
  if (!record.placeId) return;
  svg.dataset.iconPlaceId = record.placeId; svg.dataset.planKind = record.kind || ''; iconTargets.add(record.placeId, svg);
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
  iconTargets.prune();
  for (const element of pendingDayDetails.keys()) if (!element.isConnected) { pendingDayDetails.delete(element); dayDetailObserver.unobserve(element); }
}
async function hydratePlace(container, record, { contactOnly = false, compact = false, visible = false, daySummary = false } = {}) {
  const request = crypto.randomUUID(); container.dataset.request = request; container.dataset.photoPlace = record.placeId;
  let available = knownGoogleContent(record);
  renderPlaceContent(container, available, { contactOnly, compact, daySummary });
  // Day cards reuse saved/cached details and the existing lightweight rating
  // request; revealing a day never starts full place-detail or photo requests.
  if (daySummary) return;
  if (!compact && !contactOnly) {
    const cached = displayedPhotos.peek(available, 900);
    if (cached) mountPlacePhoto(container, available, cached, 'detail-photo');
    else if (!container.querySelector('.detail-photo')) { const placeholder = document.createElement('figure'); placeholder.className = 'detail-photo photo-pending'; placeholder.setAttribute('aria-hidden', 'true'); container.prepend(placeholder); }
    // Search results already include photo metadata; do not wait for another details request.
    if (available.photos?.length || available.photo || available.photosLoaded) showPlacePhoto(container, available).catch(() => {});
  }
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
    for (const detail of document.querySelectorAll('.day-card-details')) if (detail.dataset.photoPlace === record.placeId) {
      renderPlaceContent(detail, mergeGoogleContent({ ...record, day: detail.closest('[data-day]')?.dataset.day }, fresh), { daySummary: true });
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
  const days = daysForTrip(state.trip), daySelect = $('phone-discovery-day');
  daySelect.replaceChildren(...days.map(day => { const option = document.createElement('option'); option.value = day; option.textContent = dateLong(day); return option; }));
  daySelect.value = state.day; refreshDropdowns(daySelect); $('phone-discovery-day-label').hidden = !days.length;
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
$('phone-discovery-day').addEventListener('change', event => { state.day = event.target.value; renderPlan(); syncDiscovery(); });
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

function renderPlan() { $('trip-dates').textContent = tripDateLabel(state.trip); renderRoute(); updateTripTitle(); $('trip-heading').setAttribute('aria-label', tripTitle(state.trip)); itinerary.render(); syncSuggestionCards(); }

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
  next = scheduleUnassigned(next); saveTrip(next); state.trip = next; renderPlan(); updateRecent();
}
const boardPalette = { sun: '#fff0b8', rose: '#ffd9d0', mint: '#d9f3e4', sky: '#dcecff', lilac: '#eee2ff' };
function boardItems() { return Array.isArray(state.trip?.boardItems) ? state.trip.boardItems : []; }
function boardLinks() { return Array.isArray(state.trip?.boardLinks) ? state.trip.boardLinks : []; }
function boardSnapshot() { return boardSnapshotData(state.trip); }
function phoneBoard() { return phoneHeaderLayout.matches; }
function saveBoard(next, { history = true, debounce = false } = {}) {
  if (!state.trip) return;
  const before = state.boardSnapshot ?? boardSnapshot();
  state.trip = withBoardChange(state.trip, next);
  if (history) { const after = boardSnapshot(); if (before !== after) { state.boardHistory.push(before); if (state.boardHistory.length > 50) state.boardHistory.shift(); state.boardFuture = []; } }
  state.boardSnapshot = boardSnapshot();
  $('board-save-state').textContent = currentAccount() ? 'Saved on this device · syncing…' : 'Saving…';
  const persist = () => {
    try {
      saveTrip(state.trip); updateRecent();
      $('board-save-state').textContent = currentAccount() ? 'Saved on this device · syncing…' : 'Saved on this device';
      if (!currentAccount()) { clearTimeout(state.boardSaveTimer); state.boardSaveTimer = setTimeout(() => { $('board-save-state').textContent = 'Saved on this device'; }, 450); }
    } catch {
      $('board-save-state').textContent = 'Could not save. Your edits are still on this device.';
      status('trip-status', 'The idea board could not be saved. Your latest change is still on screen.');
    }
  };
  clearTimeout(state.boardSaveTimer);
  if (debounce) state.boardSaveTimer = setTimeout(persist, 180);
  else persist();
}
function restoreBoardSnapshot(snapshot) {
  if (!state.trip || !snapshot) return;
  const value = JSON.parse(snapshot); state.trip = persistableBoardTrip({ ...state.trip, boardItems: value.boardItems, boardLinks: value.boardLinks });
  saveTrip(state.trip); state.boardSnapshot = boardSnapshot(); updateRecent(); renderBoard();
}
function undoBoard() { const previous = state.boardHistory.pop(); if (!previous) return; state.boardFuture.push(boardSnapshot()); restoreBoardSnapshot(previous); }
function redoBoard() { const next = state.boardFuture.pop(); if (!next) return; state.boardHistory.push(boardSnapshot()); restoreBoardSnapshot(next); }
function persistBoardViewport() { if (!state.trip) return; writeBoardViewport(state.trip.id, { x: state.boardX, y: state.boardY, scale: state.boardScale }, localStorage); }
function applyBoardTransform() { $('ideas-world').style.transform = `translate(${state.boardX}px,${state.boardY}px) scale(${state.boardScale})`; }
function canvasMetrics() { return { viewport: { x: state.boardX, y: state.boardY, scale: state.boardScale }, canvas: { width: $('ideas-canvas').clientWidth, height: $('ideas-canvas').clientHeight } }; }
function worldPoint(event) { const bounds = $('ideas-canvas').getBoundingClientRect(); return { x: (event.clientX - bounds.left - state.boardX) / state.boardScale, y: (event.clientY - bounds.top - state.boardY) / state.boardScale }; }
function setBoardView(view) {
  state.boardView = view; const browse = view === 'browse';
  $('board-browse').hidden = !browse; $('ideas-canvas').hidden = browse;
  $('board-canvas-view').setAttribute('aria-pressed', String(!browse)); $('board-browse-view').setAttribute('aria-pressed', String(browse));
  for (const button of document.querySelectorAll('#board-sticker,#board-connect,#board-group,#board-draw,#board-zoom-out,#board-zoom-in,#board-fit,#board-tool-select,#board-tool-pan,#board-duplicate,#board-delete-selected')) button.hidden = browse;
  setBoardPenControls(!browse&&state.boardDrawMode);
  renderBoardBrowse();
}
function setBoardPenControls(visible){for(const id of ['board-pen-color','board-pen-width']){const select=$(id);if(!select)continue;select.hidden=!visible;const trigger=select.nextElementSibling;if(trigger?.classList.contains('dropdown-trigger'))trigger.hidden=!visible;}}
function duplicateBoardSelection() {
  const selected = boardItems().filter(item => state.boardSelection.includes(item.id)); if (!selected.length) return;
  const ids = new Map(selected.map(item => [item.id, crypto.randomUUID()]));
  const copies = selected.map(item => item.type==='draw'?{...structuredClone(item),id:ids.get(item.id),points:item.points.map(point=>({x:point.x+34,y:point.y+34}))}:{ ...structuredClone(item), id: ids.get(item.id), x: item.x + 34, y: item.y + 34, ...(item.memberIds ? { memberIds: item.memberIds.map(id => ids.get(id) || id) } : {}), ...(item.groupId ? { groupId: ids.get(item.groupId) || item.groupId } : {}) });
  const internalLinks = boardLinks().filter(link => ids.has(link.from) && ids.has(link.to)).map(link => ({ ...link, id: crypto.randomUUID(), from: ids.get(link.from), to: ids.get(link.to) }));
  saveBoard({ boardItems: [...boardItems(), ...copies], boardLinks: [...boardLinks(), ...internalLinks] }); state.boardSelection = copies.map(item => item.id); renderBoard();
}
function deleteBoardSelection() {
  if (!state.boardSelection.length) return;
  const ids = new Set(state.boardSelection); let items = boardItems().filter(item => !ids.has(item.id)).map(item => ({ ...item }));
  for (const group of items.filter(item => item.type === 'group')) { group.memberIds = (group.memberIds || []).filter(id => !ids.has(id)); if (!group.memberIds.length) items = items.filter(item => item.id !== group.id); }
  items = items.map(item => { if (!ids.has(item.groupId)) return item; const { groupId, ...rest } = item; return rest; });
  saveBoard({ boardItems: items, boardLinks: boardLinks().filter(link => !ids.has(link.from) && !ids.has(link.to)) }); state.boardSelection = []; renderBoard();
}
async function retrieveLinkPreview(rawUrl) {
  try { const response=await fetch(`/api/idea-preview?url=${encodeURIComponent(rawUrl)}`,{signal:AbortSignal.timeout(6500)});if(!response.ok)return null;const data=await response.json();return data.preview?{title:String(data.preview.title||'').slice(0,120),image:/^https:\/\//i.test(data.preview.image||'')?data.preview.image:'',site:data.preview.site||''}:null; } catch { return null; }
}
function renderBoardBrowse() {
  const grid = $('board-browse-grid'); if (!grid) return;
  const source=$('board-browse-source').value,query = $('board-search').value.trim().toLowerCase(), category = $('board-category-filter').value, group = $('board-group-filter').value;
  const groups = boardItems().filter(item => item.type === 'group'),groupFilter=$('board-group-filter'); groupFilter.replaceChildren(new Option('All groups',''), ...groups.map(item => new Option(item.title || 'Group', item.id)));groupFilter.value=groups.some(item=>item.id===group)?group:'';refreshDropdowns(groupFilter);
  const selectedGroup = groupFilter.value; groupFilter.hidden=true; const groupTrigger=groupFilter.nextElementSibling;if(groupTrigger?.classList.contains('dropdown-trigger'))groupTrigger.hidden=source==='library';
  grid.replaceChildren();
  const ideas = (source==='library'?state.boardLibrary:boardItems()).filter(item => ['card','photo','note'].includes(item.type)).filter(item => !query || [item.title,item.location,item.category,item.notes,item.url].some(value => String(value || '').toLowerCase().includes(query))).filter(item => !category || item.category === category).filter(item => source==='library'||!selectedGroup || item.groupId === selectedGroup);
  for (const item of ideas) {
    const card = document.createElement('article'); card.className = 'board-browse-card';
    if (item.image) { const image = document.createElement('img'); image.src = item.image; image.alt = ''; image.loading = 'lazy'; image.onerror = () => image.remove(); card.append(image); }
    const title = document.createElement('strong'); title.textContent = item.title || (item.type === 'note' ? 'Sticky note' : 'Untitled place'); card.append(title);
    const meta = document.createElement('span'); meta.textContent = [item.category,item.location].filter(Boolean).join(' · '); card.append(meta);
    if (item.notes) { const notes = document.createElement('p'); notes.textContent = item.notes; card.append(notes); }
    const actions = document.createElement('div'); actions.className = 'board-browse-actions';
    if(source==='library') { const add=document.createElement('button');add.type='button';add.textContent='Add to this board';add.addEventListener('click',()=>{const count=boardItems().length,copy={...item,id:crypto.randomUUID(),libraryIdeaId:item.id,x:($('ideas-canvas').clientWidth/2-state.boardX)/state.boardScale-140+(count%3)*24,y:($('ideas-canvas').clientHeight/2-state.boardY)/state.boardScale-140+(count%4)*24,width:280,height:item.type==='note'?200:300};saveBoard({boardItems:[...boardItems(),copy]});setBoardView('canvas');renderBoard();});actions.append(add);const remove=document.createElement('button');remove.type='button';remove.textContent='Remove';remove.addEventListener('click',()=>{deletePersonalIdea(item.id);state.boardLibrary=state.boardLibrary.filter(idea=>idea.id!==item.id);renderBoardBrowse();});actions.append(remove); }
    else { const open = document.createElement('button'); open.type = 'button'; open.textContent = 'Open on canvas'; open.addEventListener('click', () => { setBoardView('canvas'); state.boardX = Math.round($('ideas-canvas').clientWidth / 2 - (item.x + item.width / 2) * state.boardScale); state.boardY = Math.round($('ideas-canvas').clientHeight / 2 - (item.y + item.height / 2) * state.boardScale); applyBoardTransform(); }); actions.append(open);
      const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = 'Edit'; edit.addEventListener('click', () => openIdeaEditor(item)); actions.append(edit);
      if(boardItems().some(entry=>entry.type==='group')){const move=document.createElement('select');move.setAttribute('aria-label',`Move ${title.textContent} to a group`);move.add(new Option('Move to group…',''));for(const entry of boardItems().filter(value=>value.type==='group'))move.add(new Option(entry.title||'Group',entry.id));move.value=item.groupId||'';move.addEventListener('change',()=>{const target=move.value,items=boardItems().map(entry=>({...entry}));if(item.groupId){const old=items.find(entry=>entry.id===item.groupId);if(old)old.memberIds=(old.memberIds||[]).filter(id=>id!==item.id);}const updated=items.find(entry=>entry.id===item.id);if(target){updated.groupId=target;const group=items.find(entry=>entry.id===target);group.memberIds=[...new Set([...(group.memberIds||[]),item.id])];fitBoardGroup(group);}else delete updated.groupId;saveBoard({boardItems:items});renderBoard();});actions.append(move);}
      if (item.type !== 'note') { const day = document.createElement('select'); day.setAttribute('aria-label', `Add ${title.textContent} to an itinerary day`); day.innerHTML = '<option value="">Add to day…</option>' + daysForTrip(state.trip).map(date => `<option value="${date}">${dateLabel(date)}</option>`).join(''); day.addEventListener('change', () => addBoardIdeaToDay(item, day.value)); actions.append(day); } }
    card.append(actions); grid.append(card);
  }
  if (!ideas.length) { const empty = document.createElement('p'); empty.className = 'board-browse-empty'; empty.textContent = query || category || selectedGroup ? 'No ideas match those filters.' : source==='library'?'Your personal idea library is empty. Saved ideas from your boards will appear here.':'Your saved ideas will appear here. Add a place, link, or note to get started.'; grid.append(empty); }
}
function addBoardIdeaToDay(item, dayValue) {
  if (!dayValue) return;
  try { const ideaId=item.libraryIdeaId||item.id;if((state.trip.items||[]).some(entry=>entry.ideaId===ideaId&&entry.day===dayValue)){status('trip-status',`${item.title||'Idea'} is already on ${dateLabel(dayValue)}.`);return;}const kind = ['Food','Stay','Activity','Flight','Train','Transport','Tour'].includes(item.category) ? item.category : 'Activity'; const plan = { ...makePlan(state.trip, { name: item.title || 'Travel idea', day: dayValue, kind, address: item.location || '', notes: item.notes || '' }), ideaId }; saveBoard({ items: [...(state.trip.items || []), plan] }); status('trip-status', `Added ${item.title || 'idea'} to ${dateLabel(dayValue)}.`); }
  catch (error) { status('trip-status', error.message || 'Could not add that idea to the itinerary.'); }
  renderBoard();
}
function renderBoard() {
  if (!state.trip) return;
  const items = boardItems(), wrapper = $('ideas-objects'); wrapper.replaceChildren();
  for (const item of items) {
    const card = document.createElement('article'); card.className = `idea-object idea-${item.type} idea-${item.color || 'sun'}${state.boardSelection.includes(item.id) ? ' idea-selected' : ''}`; card.dataset.boardId = item.id;
    card.style.left = `${item.x || 120}px`; card.style.top = `${item.y || 120}px`; card.style.width = `${item.width || (item.type === 'group' ? 430 : item.type === 'note' ? 220 : 280)}px`; card.style.height = `${item.height || (item.type === 'group' ? 320 : item.type === 'note' ? 200 : 310)}px`;
    if (item.type === 'draw') continue;
    if (item.type === 'sticker') {
      const glyph = document.createElement('span'); glyph.className = 'idea-sticker-glyph'; glyph.textContent = item.sticker || '✨'; card.append(glyph);
      const editSticker = document.createElement('button'); editSticker.type = 'button'; editSticker.className = 'idea-edit'; editSticker.textContent = '•••'; editSticker.setAttribute('aria-label', 'Change sticker'); editSticker.addEventListener('click', event => { event.stopPropagation(); openIdeaEditor(item); }); card.append(editSticker);
      const resizeSticker = document.createElement('span'); resizeSticker.className = 'idea-resize'; resizeSticker.setAttribute('aria-hidden', 'true'); card.append(resizeSticker); wrapper.append(card); continue;
    }
    const head = document.createElement('div'); head.className = 'idea-object-head';
    const title = document.createElement('strong'); title.textContent = item.title || (item.type === 'group' ? 'Group' : item.type === 'note' ? 'Sticky note' : 'Untitled place'); head.append(title);
    const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'idea-edit'; edit.textContent = '•••'; edit.setAttribute('aria-label', `Edit ${title.textContent}`); edit.addEventListener('click', event => { event.stopPropagation(); openIdeaEditor(item); }); head.append(edit); card.append(head);
    if (item.type === 'card' || item.type === 'photo') {
      if (item.image) { const img = document.createElement('img'); img.src = item.image; img.alt = ''; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer'; img.className = 'idea-image'; img.onerror = () => img.remove(); card.append(img); }
      else if (item.type === 'photo') { const placeholder = document.createElement('div'); placeholder.className = 'idea-photo-placeholder'; placeholder.innerHTML = '<span>▧</span><small>Add a travel photo</small>'; card.append(placeholder); }
      const meta = document.createElement('div'); meta.className = 'idea-meta'; meta.textContent = [item.category, item.location].filter(Boolean).join(' · '); card.append(meta);
      if (item.notes) { const notes = document.createElement('p'); notes.className = 'idea-copy'; notes.textContent = item.notes; card.append(notes); }
      if (item.url) { const link = document.createElement('a'); link.href = item.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.className = 'idea-link'; link.textContent = 'Open link ↗'; card.append(link); }
      const actions = document.createElement('div'); actions.className = 'idea-card-actions';
      const day = document.createElement('select'); day.setAttribute('aria-label', `Add ${title.textContent} to a trip day`); const dates = daysForTrip(state.trip); day.innerHTML = '<option value="">Add to plan…</option>' + dates.map(date => `<option value="${date}">${dateLabel(date)}</option>`).join('');
      day.addEventListener('change', () => { addBoardIdeaToDay(item, day.value); day.value = ''; }); actions.append(day); card.append(actions);
    } else if (item.type === 'note') { const body = document.createElement('p'); body.className = 'idea-copy'; body.textContent = item.notes || 'Double-click to add a thought…'; card.append(body); }
    else { const body = document.createElement('p'); body.className = 'idea-group-copy'; body.textContent = item.notes || 'Drop related ideas here'; card.append(body); }
    const resize = document.createElement('span'); resize.className = 'idea-resize'; resize.setAttribute('aria-hidden', 'true'); card.append(resize); wrapper.append(card);
  }
  const drawings = $('ideas-drawings'); drawings.setAttribute('width', '2600'); drawings.setAttribute('height', '1800'); drawings.replaceChildren();
  const pointsToPath = points => points?.length ? `M ${points.map(point => `${point.x} ${point.y}`).join(' L ')}` : '';
  for (const item of items.filter(entry => entry.type === 'draw')) { const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.dataset.boardId = item.id; path.setAttribute('d', pointsToPath(item.points)); path.setAttribute('class', `idea-marker-stroke${state.boardSelection.includes(item.id) ? ' idea-draw-selected' : ''}`); path.setAttribute('stroke', boardPalette[item.color] || boardPalette.sun);path.setAttribute('stroke-width',String(item.strokeWidth||12)); drawings.append(path); }
  const svg = $('ideas-links'); svg.setAttribute('width', '2600'); svg.setAttribute('height', '1800'); svg.replaceChildren();
  for (const link of boardLinks()) { const from = items.find(item => item.id === link.from), to = items.find(item => item.id === link.to); if (!from || !to) continue; const x1=(from.x||120)+(from.width||280)/2,y1=(from.y||120)+(from.height||250)/2,x2=(to.x||120)+(to.width||280)/2,y2=(to.y||120)+(to.height||250)/2,line=document.createElementNS('http://www.w3.org/2000/svg','line'); line.setAttribute('x1',String(x1));line.setAttribute('y1',String(y1));line.setAttribute('x2',String(x2));line.setAttribute('y2',String(y2));line.setAttribute('class','idea-connector');line.setAttribute('marker-end','url(#idea-arrow)');line.setAttribute('aria-label','Connector; double-click to label, click to delete');line.addEventListener('click',()=>{clearTimeout(line._deleteTimer);line._deleteTimer=setTimeout(()=>{saveBoard({boardLinks:boardLinks().filter(entry=>entry.id!==link.id)});renderBoard();},450);});line.addEventListener('dblclick',event=>{event.stopPropagation();clearTimeout(line._deleteTimer);const label=prompt('Connector label',link.label||'');if(label===null)return;saveBoard({boardLinks:boardLinks().map(entry=>entry.id===link.id?{...entry,label:label.trim()}:entry)});renderBoard();});svg.append(line); if(link.label){const label=document.createElementNS('http://www.w3.org/2000/svg','text');label.setAttribute('x',String((x1+x2)/2));label.setAttribute('y',String((y1+y2)/2-8));label.setAttribute('class','idea-connector-label');label.textContent=link.label;svg.append(label);} }
  if (!svg.querySelector('defs')) { const defs=document.createElementNS('http://www.w3.org/2000/svg','defs'),marker=document.createElementNS('http://www.w3.org/2000/svg','marker'),arrow=document.createElementNS('http://www.w3.org/2000/svg','path');marker.id='idea-arrow';marker.setAttribute('markerWidth','9');marker.setAttribute('markerHeight','9');marker.setAttribute('refX','8');marker.setAttribute('refY','4.5');marker.setAttribute('orient','auto');arrow.setAttribute('d','M0,0 L9,4.5 L0,9 z');arrow.setAttribute('fill','#8472b8');marker.append(arrow);defs.append(marker);svg.prepend(defs); }
  applyBoardTransform(); $('ideas-hint').hidden = items.length > 0; if(state.boardView==='browse')renderBoardBrowse();
}
function createBoardItem(type) {
  if (!state.trip) return;
  const count = boardItems().length, width=type === 'group' ? 430 : type === 'note' ? 220 : type === 'photo' ? 260 : 280,height=type === 'group' ? 320 : type === 'note' ? 220 : type === 'photo' ? 250 : 310,canvas=$('ideas-canvas'),x=Math.max(40,(canvas.clientWidth/2-state.boardX)/state.boardScale-width/2),y=Math.max(40,(canvas.clientHeight/2-state.boardY)/state.boardScale-height/2),item = { id: crypto.randomUUID(), type, title: type === 'card' ? '' : type === 'photo' ? 'Travel photo' : type === 'note' ? 'New thought' : 'New group', x:x+(count%4)*28, y:y+(count%5)*26, width, height, category: 'Activity', color: ['sun','rose','mint','sky','lilac'][count % 5], image: '', url: '', location: '', notes: '' };
  saveBoard({ boardItems: [...boardItems(), item] }); renderBoard(); openIdeaEditor(item);
}
function createBoardSticker() { const count = boardItems().length, sticker = ['😍','❤️','✨','🌴','📍','✈️','☀️','🌊'][count % 8]; const item = { id: crypto.randomUUID(), type: 'sticker', title: sticker, sticker, x: 140 + (count % 5) * 35, y: 130 + (count % 4) * 35, width: 82, height: 82, color: 'sun' }; saveBoard({ boardItems: [...boardItems(), item] }); renderBoard(); }
function openIdeaEditor(item) {
  state.boardEditing = item.id; const form = $('idea-form'); form.elements.title.value = item.title || ''; form.elements.image.value = item.image || ''; form.elements.url.value = item.url || ''; form.elements.location.value = item.location || ''; form.elements.category.value = item.category || 'Activity'; form.elements.notes.value = item.notes || ''; form.elements.color.value = item.color || 'sun'; form.elements.sticker.value = item.sticker || '✨';
  const sticker = item.type === 'sticker', place = item.type === 'card' || item.type === 'photo';
  $('idea-editor-title').textContent = item.type === 'card' ? 'Place idea' : item.type === 'photo' ? 'Photo' : item.type === 'note' ? 'Sticky note' : item.type === 'sticker' ? 'Sticker' : 'Group label'; $('idea-title-wrap').hidden = sticker; $('idea-title-wrap').querySelector('input').required = false; $('idea-sticker-wrap').hidden = !sticker; $('idea-color-wrap').hidden = sticker;
  for (const id of ['idea-image-wrap','idea-url-wrap','idea-location-wrap','idea-category-wrap']) $(id).hidden = !place;
  $('idea-notes-wrap').hidden = sticker; $('idea-delete').hidden = false; $('idea-error').textContent = ''; $('idea-editor').showModal();
}
async function saveIdeaForm(event) { event.preventDefault(); const item = boardItems().find(entry => entry.id === state.boardEditing); if (!item) return; const form = event.currentTarget, sticker = item.type === 'sticker', url = form.elements.url.value.trim(); let title = sticker ? form.elements.sticker.value : form.elements.title.value.trim(), image = form.elements.image.value.trim(); if (!sticker && url && (!title || !image)) { $('idea-error').textContent = 'Checking for a link preview…'; const preview = await retrieveLinkPreview(url); if (preview) { if(!title)title=preview.title;if(!image)image=preview.image; } if (!title) title = new URL(url).hostname.replace(/^www\./,''); } if (!title) { $('idea-error').textContent = 'Add a title or a link first.'; return; } const fields = Object.fromEntries(['location','category','notes','color'].map(name => [name, form.elements[name].value.trim()])); const provider = url ? new URL(url).hostname : image ? new URL(image).hostname : ''; const libraryIdeaId=item.libraryIdeaId||item.id,updated = { ...item, title, image, url, ...(sticker ? { sticker: title } : {}), ...fields, sourceUrl: url || item.sourceUrl || '', preview: image ? { image, provider } : null, ...(['card','photo','note'].includes(item.type)?{libraryIdeaId}: {}) }; saveBoard({ boardItems: boardItems().map(entry => entry.id === item.id ? updated : entry) }); if(['card','photo','note'].includes(item.type)){savePersonalIdea({...updated,id:libraryIdeaId});state.boardLibrary=[{...updated,id:libraryIdeaId},...state.boardLibrary.filter(idea=>idea.id!==libraryIdeaId)];} $('idea-editor').close(); renderBoard(); }
function createBoardGroup() {
  const members = boardItems().filter(item => state.boardSelection.includes(item.id) && item.type !== 'draw' && item.type !== 'group'); if (members.length < 2) return;
  const left = Math.min(...members.map(item => item.x || 0)) - 24, top = Math.min(...members.map(item => item.y || 0)) - 48;
  const right = Math.max(...members.map(item => (item.x || 0) + (item.width || 280))) + 24, bottom = Math.max(...members.map(item => (item.y || 0) + (item.height || 240))) + 24;
  const group = { id: crypto.randomUUID(), type: 'group', title: 'New group', x: left, y: top, width: right - left, height: bottom - top, color: 'lilac', notes: '', memberIds: members.map(item => item.id) };
  const selectedIds=new Set(members.map(item=>item.id));
  saveBoard({ boardItems: [...boardItems().filter(item=>!selectedIds.has(item.id)||!item.groupId).map(item => selectedIds.has(item.id)?{...item,groupId:group.id,groupOffset:{x:item.x-left,y:item.y-top}}:item).map(item=>{if(item.type==='group'){item.memberIds=(item.memberIds||[]).filter(id=>!selectedIds.has(id));}return item;}), group] });
  state.boardSelection = []; state.boardGroupMode = false; $('board-group').setAttribute('aria-pressed', 'false'); $('board-group').textContent = '▧ Group items'; $('board-mode-instructions').textContent = 'Drag to arrange · Long-press an item for options'; renderBoard(); openIdeaEditor(group);
}
function fitBoardGroup(group) {
  const members = boardItems().filter(item => group.memberIds?.includes(item.id)); if (!members.length) return;
  const left = Math.min(...members.map(item => item.x)) - 24, top = Math.min(...members.map(item => item.y)) - 48;
  const right = Math.max(...members.map(item => item.x + item.width)), bottom = Math.max(...members.map(item => item.y + item.height));
  group.x = left; group.y = top; group.width = right - left + 48; group.height = bottom - top + 24;
  for(const member of members)member.groupOffset={x:member.x-group.x,y:member.y-group.y};
}
function deleteBoardObject(id) {
  const target = boardItems().find(item => item.id === id); if (!target) return;
  let items = boardItems().filter(item => item.id !== id).map(item => ({ ...item }));
  if (target.type === 'group') items = items.map(item => { if (item.groupId !== id) return item; const { groupId, groupOffset, ...ungrouped } = item; return ungrouped; });
  else if (target.groupId) { const group = items.find(item => item.id === target.groupId); if (group) { group.memberIds = (group.memberIds || []).filter(memberId => memberId !== id); if (group.memberIds.length) fitBoardGroup(group); else items = items.filter(item => item.id !== group.id); } }
  saveBoard({ boardItems: items, boardLinks: boardLinks().filter(link => link.from !== id && link.to !== id) }); $('idea-editor').close(); renderBoard();
}
function boardPointerDown(event) {
  if (event.button !== 0 && event.pointerType !== 'touch') return;
  if (event.pointerType === 'touch') { boardPointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); if (boardPointers.size >= 2) { const [a, b] = [...boardPointers.values()],rect=$('ideas-canvas').getBoundingClientRect(),cx=(a.x+b.x)/2-rect.left,cy=(a.y+b.y)/2-rect.top; state.boardPointer = { mode: 'pinch', distance: Math.hypot(a.x - b.x, a.y - b.y), scale: state.boardScale, worldX:(cx-state.boardX)/state.boardScale, worldY:(cy-state.boardY)/state.boardScale }; $('ideas-canvas').setPointerCapture(event.pointerId); event.preventDefault(); return; } }
  if (event.target.closest('button,a,select,input,textarea')) return;
  const stroke = event.target.closest('.idea-marker-stroke:not(.idea-marker-draft)');
  if (stroke && !state.boardDrawMode) { const id=stroke.dataset.boardId; state.boardSelection=event.shiftKey?(state.boardSelection.includes(id)?state.boardSelection.filter(value=>value!==id):[...state.boardSelection,id]):[id]; const item=boardItems().find(entry=>entry.id===id); state.boardPointer={id,mode:'draw-move',startX:event.clientX,startY:event.clientY,points:structuredClone(item?.points||[])}; $('ideas-canvas').setPointerCapture(event.pointerId); renderBoard(); event.preventDefault(); return; }
  const object = event.target.closest('.idea-object');
  if (state.boardDrawMode) {
    const bounds = $('ideas-canvas').getBoundingClientRect(), point = { x: (event.clientX - bounds.left - state.boardX) / state.boardScale, y: (event.clientY - bounds.top - state.boardY) / state.boardScale };
    state.boardDrawing = { pointerId: event.pointerId, points: [point], path: document.createElementNS('http://www.w3.org/2000/svg', 'path') };
    state.boardDrawing.path.setAttribute('class', 'idea-marker-stroke idea-marker-draft'); state.boardDrawing.path.setAttribute('stroke', boardPalette[state.boardPenColor]||boardPalette.sun);state.boardDrawing.path.setAttribute('stroke-width',String(state.boardPenWidth)); $('ideas-drawings').append(state.boardDrawing.path); $('ideas-canvas').setPointerCapture(event.pointerId); event.preventDefault(); return;
  }
  if (object && (state.boardConnect || state.boardGroupMode)) {
    const id = object.dataset.boardId;
    if (state.boardConnect) {
      if (!state.boardSource) { state.boardSource = id; object.classList.add('idea-selected'); $('board-mode-instructions').textContent = 'Now tap the second item to connect'; }
      else if (id !== state.boardSource) { saveBoard({ boardLinks: [...boardLinks(), { id: crypto.randomUUID(), from: state.boardSource, to: id }] }); state.boardSource = null; state.boardConnect = false; $('board-connect').setAttribute('aria-pressed', 'false'); $('board-connect').textContent = '↗ Connect two'; $('board-mode-instructions').textContent = 'Connected! Tap Connect two to add another link.'; renderBoard(); }
    } else {
      state.boardSelection = state.boardSelection.includes(id) ? state.boardSelection.filter(value => value !== id) : [...state.boardSelection, id];
      $('board-group').textContent = state.boardSelection.length >= 2 ? `Create group (${state.boardSelection.length})` : `Select items (${state.boardSelection.length})`; renderBoard();
    }
    return;
  }
  if (object) {
    const id = object.dataset.boardId;
    if (event.shiftKey) state.boardSelection = state.boardSelection.includes(id) ? state.boardSelection.filter(value => value !== id) : [...state.boardSelection, id];
    else if (!state.boardSelection.includes(id)) state.boardSelection = [id];
    const resize = event.target.closest('.idea-resize'), model = boardItems().find(entry => entry.id === id), selected = boardItems().filter(entry => state.boardSelection.includes(entry.id));
    const moveItems = model?.type === 'group' ? boardItems().filter(entry => entry.type!=='draw' && (model.memberIds?.includes(entry.id) || state.boardSelection.includes(entry.id))) : selected.filter(entry=>entry.type!=='draw');
    const drag = { id, mode: resize ? 'resize' : 'move', startX: event.clientX, startY: event.clientY, x: parseFloat(object.style.left), y: parseFloat(object.style.top), width: object.offsetWidth, height: object.offsetHeight, memberPositions: moveItems.map(entry => ({ id: entry.id, x: entry.x, y: entry.y })), longPressTimer: null };
    if (event.pointerType === 'touch' && !resize) drag.longPressTimer = setTimeout(() => { if (state.boardPointer !== drag) return; drag.mode = 'options'; openIdeaEditor(boardItems().find(item => item.id === drag.id)); }, 520);
    state.boardPointer = drag; event.preventDefault();
  }
  else if (event.target === $('ideas-canvas') || event.target === $('ideas-world') || event.target === $('ideas-objects') || event.target === $('ideas-links')) { state.boardPointer = { mode: event.shiftKey || state.boardTool === 'select' ? 'marquee' : 'pan', startX: event.clientX, startY: event.clientY, x: state.boardX, y: state.boardY }; if (state.boardPointer.mode === 'marquee') { const rect = $('ideas-canvas').getBoundingClientRect(); state.boardPointer.localX = event.clientX - rect.left; state.boardPointer.localY = event.clientY - rect.top; const box = $('board-selection-rect'); box.hidden = false; box.style.left = `${state.boardPointer.localX}px`; box.style.top = `${state.boardPointer.localY}px`; box.style.width = '0'; box.style.height = '0'; } else $('ideas-canvas').classList.add('panning'); }
  if (state.boardPointer) $('ideas-canvas').setPointerCapture(event.pointerId);
}
function boardPointerMove(event) { if (event.pointerType === 'touch' && boardPointers.has(event.pointerId)) boardPointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); if (state.boardDrawing?.pointerId === event.pointerId) { const bounds = $('ideas-canvas').getBoundingClientRect(); state.boardDrawing.points.push({ x: (event.clientX - bounds.left - state.boardX) / state.boardScale, y: (event.clientY - bounds.top - state.boardY) / state.boardScale }); state.boardDrawing.path.setAttribute('d', `M ${state.boardDrawing.points.map(point => `${point.x} ${point.y}`).join(' L ')}`); return; } const drag = state.boardPointer; if (!drag) return; if (drag.mode === 'pinch') { const points = [...boardPointers.values()]; if (points.length >= 2) { const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),rect=$('ideas-canvas').getBoundingClientRect(),cx=(points[0].x+points[1].x)/2-rect.left,cy=(points[0].y+points[1].y)/2-rect.top; state.boardScale = Math.max(.3, Math.min(2.4, drag.scale * distance / Math.max(drag.distance, 1)));state.boardX=cx-drag.worldX*state.boardScale;state.boardY=cy-drag.worldY*state.boardScale;applyBoardTransform(); } return; } const rawX = event.clientX - drag.startX, rawY = event.clientY - drag.startY; if (drag.longPressTimer && Math.hypot(rawX, rawY) > 9) { clearTimeout(drag.longPressTimer); drag.longPressTimer = null; } if (drag.mode === 'options') return; const dx = rawX / state.boardScale, dy = rawY / state.boardScale; if (drag.mode === 'pan') { state.boardX = drag.x + rawX; state.boardY = drag.y + rawY; applyBoardTransform(); return; } if (drag.mode === 'marquee') { const rect = $('ideas-canvas').getBoundingClientRect(), box = $('board-selection-rect'), left = Math.min(drag.localX, event.clientX - rect.left), top = Math.min(drag.localY, event.clientY - rect.top); box.style.left = `${left}px`; box.style.top = `${top}px`; box.style.width = `${Math.abs(rawX)}px`; box.style.height = `${Math.abs(rawY)}px`; return; } if (drag.mode === 'draw-move') { const item=boardItems().find(entry=>entry.id===drag.id); if(item){item.points=drag.points.map(point=>({x:point.x+dx,y:point.y+dy}));renderBoard();} return; } const item = boardItems().find(entry => entry.id === drag.id); if (!item) return; if (drag.mode === 'resize') { item.width = Math.max(190, drag.width + dx); item.height = Math.max(130, drag.height + dy); } else { for (const position of drag.memberPositions) { const member = boardItems().find(entry => entry.id === position.id); if (member) { member.x = position.x + dx; member.y = position.y + dy; } } if (item.type === 'group') { item.x = drag.x + dx; item.y = drag.y + dy; } for (const member of boardItems().filter(entry => entry.groupId)) { const group = boardItems().find(entry => entry.id === member.groupId); if (group && group.id !== item.id && member.id === item.id) fitBoardGroup(group); } } renderBoard(); }
function boardPointerUp(event) { if (event?.pointerType === 'touch') boardPointers.delete(event.pointerId); if (state.boardDrawing?.pointerId === event?.pointerId) { const stroke = state.boardDrawing; state.boardDrawing = null; if (stroke.points.length > 1) { saveBoard({ boardItems: [...boardItems(), { id: crypto.randomUUID(), type: 'draw', points: stroke.points, color: state.boardPenColor, strokeWidth:state.boardPenWidth }] }); renderBoard(); } else stroke.path.remove(); return; } if (state.boardPointer?.longPressTimer) clearTimeout(state.boardPointer.longPressTimer); if (state.boardPointer?.mode === 'pinch') { const remaining=[...boardPointers.values()];if(remaining.length){state.boardPointer={mode:'pan',startX:remaining[0].x,startY:remaining[0].y,x:state.boardX,y:state.boardY};}else{state.boardPointer=null;persistBoardViewport();}return; } const drag = state.boardPointer; if (drag?.mode === 'marquee' && event) { const rect = $('ideas-canvas').getBoundingClientRect(), x1 = Math.min(drag.localX, event.clientX - rect.left), x2 = Math.max(drag.localX, event.clientX - rect.left), y1 = Math.min(drag.localY, event.clientY - rect.top), y2 = Math.max(drag.localY, event.clientY - rect.top); state.boardSelection = boardItems().filter(item => { if(item.type==='draw'){const xs=item.points.map(point=>state.boardX+point.x*state.boardScale),ys=item.points.map(point=>state.boardY+point.y*state.boardScale);return Math.max(...xs)>=x1&&Math.min(...xs)<=x2&&Math.max(...ys)>=y1&&Math.min(...ys)<=y2;}const left = state.boardX + item.x * state.boardScale, top = state.boardY + item.y * state.boardScale, right = left + item.width * state.boardScale, bottom = top + item.height * state.boardScale; return right >= x1 && left <= x2 && bottom >= y1 && top <= y2; }).map(item => item.id); $('board-selection-rect').hidden = true; renderBoard(); } else if (drag?.mode === 'pan') {if(boardPointers.size) {const remaining=[...boardPointers.values()][0];state.boardPointer={mode:'pan',startX:remaining.x,startY:remaining.y,x:state.boardX,y:state.boardY};}else{state.boardPointer=null;persistBoardViewport();}} else if (drag?.mode === 'draw-move') saveBoard({boardItems:boardItems()}); else if (drag && drag.mode !== 'options') { if (drag.mode === 'move') { const item = boardItems().find(entry => entry.id === drag.id); if (item && item.type !== 'group' && item.type !== 'draw') { const centerX = item.x + item.width / 2, centerY = item.y + item.height / 2; const group = boardItems().filter(entry => entry.type === 'group' && entry.id !== item.id).find(entry => centerX > entry.x && centerX < entry.x + entry.width && centerY > entry.y && centerY < entry.y + entry.height); if (group) { if (item.type === 'group') { for (const member of boardItems()) if (member.groupId === item.id) delete member.groupId; } else item.groupId = group.id; group.memberIds = [...new Set([...(group.memberIds || []), item.id])]; fitBoardGroup(group); } else if (item.groupId) { const old = boardItems().find(entry => entry.id === item.groupId); if (old) { old.memberIds = (old.memberIds || []).filter(id => id !== item.id); fitBoardGroup(old); } delete item.groupId; } } } saveBoard({ boardItems: boardItems() }); } state.boardPointer = null; $('ideas-canvas').classList.remove('panning'); renderBoard(); }
function boardZoom(factor) { const canvas=$('ideas-canvas'),x=canvas.clientWidth/2,y=canvas.clientHeight/2,worldX=(x-state.boardX)/state.boardScale,worldY=(y-state.boardY)/state.boardScale;state.boardScale = Math.max(.3, Math.min(2.4, state.boardScale * factor));state.boardX=x-worldX*state.boardScale;state.boardY=y-worldY*state.boardScale;applyBoardTransform(); clearTimeout(state.boardViewportTimer);state.boardViewportTimer=setTimeout(persistBoardViewport,350); }
for (const button of document.querySelectorAll('[data-board-create]')) button.addEventListener('click', () => createBoardItem(button.dataset.boardCreate));
$('board-sticker').addEventListener('click', createBoardSticker);
$('board-draw').addEventListener('click', () => { state.boardDrawMode = !state.boardDrawMode; $('board-draw').setAttribute('aria-pressed', String(state.boardDrawMode));setBoardPenControls(state.boardDrawMode&&state.boardView==='canvas'); $('ideas-canvas').classList.toggle('drawing', state.boardDrawMode); $('board-mode-instructions').textContent = state.boardDrawMode ? 'Draw a highlight or circle · Choose color and width' : 'Arrange freely · Long-press an item for options'; });
$('idea-form').elements.title.required = false;
$('idea-form').addEventListener('submit', saveIdeaForm);
$('idea-delete').addEventListener('click', () => deleteBoardObject(state.boardEditing));
$('board-connect').addEventListener('click', () => { state.boardConnect = !state.boardConnect; state.boardGroupMode = false; state.boardSelection = []; state.boardSource = null; $('board-group').setAttribute('aria-pressed', 'false'); $('board-group').textContent = '▧ Group items'; $('board-connect').setAttribute('aria-pressed', String(state.boardConnect)); $('board-connect').textContent = state.boardConnect ? 'Cancel connect' : '↗ Connect two'; $('ideas-canvas').classList.toggle('connecting', state.boardConnect); $('board-mode-instructions').textContent = state.boardConnect ? 'Tap one item, then tap another' : 'Drag to arrange · Long-press an item for options'; renderBoard(); });
$('board-group').addEventListener('click', () => { if (state.boardGroupMode && state.boardSelection.length >= 2) { createBoardGroup(); return; } state.boardGroupMode = !state.boardGroupMode; state.boardConnect = false; state.boardSource = null; $('board-connect').setAttribute('aria-pressed', 'false'); $('board-connect').textContent = '↗ Connect two'; state.boardSelection = []; $('board-group').setAttribute('aria-pressed', String(state.boardGroupMode)); $('board-group').textContent = state.boardGroupMode ? 'Select items (0)' : '▧ Group items'; $('board-mode-instructions').textContent = state.boardGroupMode ? 'Tap each item to include it, then create the group' : 'Drag to arrange · Long-press an item for options'; renderBoard(); });
$('board-zoom-in').addEventListener('click', () => boardZoom(1.15)); $('board-zoom-out').addEventListener('click', () => boardZoom(.87));
$('board-fit').addEventListener('click', () => { const items=boardItems().filter(item=>item.type!=='draw'); if(!items.length){state.boardScale=1;state.boardX=0;state.boardY=0;}else{const left=Math.min(...items.map(item=>item.x)),top=Math.min(...items.map(item=>item.y)),right=Math.max(...items.map(item=>item.x+item.width)),bottom=Math.max(...items.map(item=>item.y+item.height)),canvas=$('ideas-canvas'),scale=Math.max(.3,Math.min(1.35,(canvas.clientWidth-100)/(right-left),(canvas.clientHeight-100)/(bottom-top)));state.boardScale=scale;state.boardX=(canvas.clientWidth-(right-left)*scale)/2-left*scale;state.boardY=(canvas.clientHeight-(bottom-top)*scale)/2-top*scale;} applyBoardTransform(); persistBoardViewport(); });
$('board-canvas-view').addEventListener('click',()=>setBoardView('canvas')); $('board-browse-view').addEventListener('click',()=>setBoardView('browse'));
for(const id of ['board-search','board-category-filter','board-group-filter','board-browse-source']) $(id).addEventListener('input',async()=>{if(id==='board-browse-source'&&$('board-browse-source').value==='library')state.boardLibrary=await loadPersonalIdeas();renderBoardBrowse();});
$('board-add-link').addEventListener('click',()=>{createBoardItem('card');formFocusUrl();});
function formFocusUrl(){requestAnimationFrame(()=>{const field=$('idea-form').elements.url;field.focus({preventScroll:true});});}
const boardActions=$('.ideas-actions');
function addBoardAction(id,label,afterId){const button=document.createElement('button');button.type='button';button.id=id;button.textContent=label;$(afterId).after(button);return button;}
const boardSelect=addBoardAction('board-tool-select','Select','board-browse-view'), boardPan=addBoardAction('board-tool-pan','Pan','board-tool-select'), boardDuplicate=addBoardAction('board-duplicate','Duplicate','board-redo'), boardDelete=addBoardAction('board-delete-selected','Delete','board-duplicate');
const boardPenColor=document.createElement('select');boardPenColor.id='board-pen-color';boardPenColor.setAttribute('aria-label','Pen color');for(const [value,label] of [['sun','Yellow'],['rose','Coral'],['mint','Mint'],['sky','Blue'],['lilac','Lilac']])boardPenColor.add(new Option(label,value));boardPenColor.value='sun';
const boardPenWidth=document.createElement('select');boardPenWidth.id='board-pen-width';boardPenWidth.setAttribute('aria-label','Pen width');for(const [value,label] of [['6','Fine'],['12','Medium'],['20','Bold']])boardPenWidth.add(new Option(label,value));boardPenWidth.value='12';
$('board-draw').after(boardPenColor,boardPenWidth);boardPenColor.hidden=boardPenWidth.hidden=true;boardPenColor.addEventListener('change',()=>state.boardPenColor=boardPenColor.value);boardPenWidth.addEventListener('change',()=>state.boardPenWidth=Number(boardPenWidth.value));
function positionBoardActions(){const mobile=phoneHeaderLayout.matches;const link=$('board-add-link'),place=document.querySelector('[data-board-create="card"]'),note=document.querySelector('[data-board-create="note"]');link.textContent=mobile?'＋ Link':'＋ Add link';link.setAttribute('aria-label','Add link');if(place){place.textContent=mobile?'＋ Place':'＋ Place';place.setAttribute('aria-label','Add place idea');}if(note){note.textContent=mobile?'＋ Note':'＋ Sticky note';note.setAttribute('aria-label','Add sticky note');}}
positionBoardActions();phoneHeaderLayout.addEventListener('change',positionBoardActions);
boardSelect.addEventListener('click',()=>{state.boardTool='select';boardSelect.setAttribute('aria-pressed','true');boardPan.setAttribute('aria-pressed','false');$('board-mode-instructions').textContent='Drag to select · Shift-click to add to selection';});
boardPan.addEventListener('click',()=>{state.boardTool='pan';boardPan.setAttribute('aria-pressed','true');boardSelect.setAttribute('aria-pressed','false');$('board-mode-instructions').textContent='Drag empty space to pan · Drag items to arrange';});
$('board-undo').addEventListener('click',undoBoard); $('board-redo').addEventListener('click',redoBoard); boardDuplicate.addEventListener('click',duplicateBoardSelection); boardDelete.addEventListener('click',deleteBoardSelection);
document.addEventListener('keydown',event=>{if(state.workspaceView!=='ideas'||$('idea-editor').open||event.target.closest('input,textarea,select,[contenteditable="true"]'))return;const mod=event.metaKey||event.ctrlKey;if(mod&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redoBoard():undoBoard();return;}if(mod&&event.key.toLowerCase()==='y'){event.preventDefault();redoBoard();return;}if(mod&&event.key.toLowerCase()==='d'){event.preventDefault();duplicateBoardSelection();return;}if((event.key==='Delete'||event.key==='Backspace')&&state.boardSelection.length){event.preventDefault();deleteBoardSelection();}});
$('ideas-canvas').addEventListener('pointerdown', boardPointerDown); $('ideas-canvas').addEventListener('pointermove', boardPointerMove); $('ideas-canvas').addEventListener('pointerup', boardPointerUp); $('ideas-canvas').addEventListener('pointercancel', boardPointerUp);
$('ideas-canvas').addEventListener('wheel', event => { event.preventDefault(); const rect=$('ideas-canvas').getBoundingClientRect(), px=event.clientX-rect.left,py=event.clientY-rect.top,worldX=(px-state.boardX)/state.boardScale,worldY=(py-state.boardY)/state.boardScale; boardZoom(Math.exp(-event.deltaY*.001));state.boardX=px-worldX*state.boardScale;state.boardY=py-worldY*state.boardScale;applyBoardTransform();clearTimeout(state.boardViewportTimer);state.boardViewportTimer=setTimeout(persistBoardViewport,350); }, { passive: false });
for (const button of document.querySelectorAll('[data-workspace-view]')) { const art = button.querySelector('svg'); if (art) paintPlaceArt(art, { itinerary: 'list', explore: 'map', transportation: 'plane' }[button.dataset.workspaceView]); }
installButtonMotion(document);
installSurfaceMotion(document);
function setWorkspaceView(view, { keepMobileMap = false, showPlaces = false, remember = true } = {}) {
  const previousView = state.workspaceView;
  if (remember && previousView !== view) {
    workspaceTrail.push({ view: previousView, scroll: $(previousView === 'itinerary' ? 'day-content' : previousView === 'explore' ? 'nearby-results' : 'transport-panel').scrollTop });
    if (workspaceTrail.length > 16) workspaceTrail.shift();
  }
  $('trip-menu').hidden = true;
  state.workspaceView = view;
  positionPlanToolbar();
  if (view !== 'itinerary') $('trip-masthead').classList.remove('header-scrolled-away');
  setMobileMap(keepMobileMap || (phoneHeaderLayout.matches && view === 'explore' && !showPlaces));
  $('plan-controls').dataset.view = view;
  const desktopIdeaBoard = view === 'ideas' && desktopToolbarLayout.matches && !phoneHeaderLayout.matches;
  $('plan-panel').hidden = view !== 'itinerary' && !desktopIdeaBoard;
  $('discover-panel').hidden = view !== 'explore';
  $('transport-panel').hidden = view !== 'transportation';
  $('ideas-panel').hidden = view !== 'ideas';
  $('map-column').hidden = view === 'transportation' || view === 'ideas';
  const selectedNavigation = view;
  for (const button of document.querySelectorAll('[data-workspace-view]')) button.setAttribute('aria-pressed', String(button.dataset.workspaceView === selectedNavigation));
  if (view !== 'transportation' && state.map) requestAnimationFrame(() => google.maps.event.trigger(state.map, 'resize'));
  renderPlan();
  if (view === 'itinerary') scheduleMapSuggestions();
  else { clearTimeout(state.mapSearchTimer); state.mapSearchVersion++; state.mapAreaKey = null; }
  if (view === 'explore') scheduleAreaSearch();
  else { clearTimeout(state.nearbyTimer); selection.invalidate(); state.nearbyRequest++; state.nearbyAreaKey = null; $('search-map-area').hidden = true; $('nearby-results').setAttribute('aria-busy', 'false'); }
  const panel = view === 'explore' ? $('discover-panel') : view === 'transportation' ? $('transport-panel') : view === 'ideas' ? $('ideas-panel') : $('plan-panel');
  if (previousView && previousView !== view) {
    const order = ['itinerary', 'explore', 'transportation', 'ideas'];
    const direction = order.indexOf(view) > order.indexOf(previousView) ? 1 : -1;
    playMotion(panel, [
      { opacity: .55, translate: `${direction * 22}px 0` },
      { opacity: 1, translate: `${-direction * 2}px 0`, offset: .78 },
      { opacity: 1, translate: '0 0' },
    ], { duration: 260 });
  }
  if (view === 'ideas') renderBoard();
}
function setMobileMap(show) {
  const button = $('mobile-map-toggle'), controls = $('plan-controls');
  const changed = controls.dataset.mobileSurface !== (show ? 'map' : 'content');
  controls.dataset.mobileSurface = show ? 'map' : 'content';
  if (show) { drawMarkers(); scheduleMapSuggestions(); }
  button.setAttribute('aria-pressed', String(show));
  button.setAttribute('aria-label', show ? (state.workspaceView === 'explore' ? 'Search places' : 'Back to day') : 'Show map');
  button.querySelector('use').setAttribute('href', show ? (state.workspaceView === 'explore' ? '#i-search' : '#i-back') : '#i-map');
  button.querySelector('span').textContent = show ? (state.workspaceView === 'explore' ? 'Search places' : 'Back to day') : 'Map';
  button.hidden = state.workspaceView === 'transportation' || state.workspaceView === 'ideas' || (phoneHeaderLayout.matches && state.workspaceView === 'itinerary' && !show);
  if (state.map) requestAnimationFrame(() => google.maps.event.trigger(state.map, 'resize'));
  if (changed && matchMedia(phoneMediaQuery).matches) {
    const surface = show ? $('map-column') : $(state.workspaceView === 'explore' ? 'discover-panel' : state.workspaceView === 'transportation' ? 'transport-panel' : 'plan-panel');
    playMotion(surface, [{ opacity: .55, translate: '0 8px' }, { opacity: 1, translate: '0 0' }], { duration: 230 });
  }
}
$('mobile-map-toggle').addEventListener('click', () => { const show = $('plan-controls').dataset.mobileSurface !== 'map'; setMobileMap(show); if (phoneHeaderLayout.matches && state.workspaceView === 'explore' && !show) $('place-search').focus({ preventScroll: true }); });
// Safari's keyboard changes the visual viewport rather than the layout height.
// Keep sheets and their primary actions above it without disabling page zoom.
let phoneViewportFrame = 0;
function syncPhoneKeyboard() {
  phoneViewportFrame = 0;
  const viewport = window.visualViewport, phone = matchMedia(phoneMediaQuery).matches;
  const focused = document.activeElement;
  const editing = Boolean(focused?.matches('textarea,[contenteditable="true"],input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=button])'));
  const metrics = phoneViewport({ layoutHeight: innerHeight, visualHeight: viewport?.height, offsetTop: viewport?.offsetTop, scale: viewport?.scale, editing: phone && editing });
  document.documentElement.classList.toggle('phone-keyboard-open', metrics.keyboard);
  document.documentElement.style.setProperty('--keyboard-rise', `${metrics.rise}px`);
  document.documentElement.style.setProperty('--visual-height', `${metrics.height}px`);
}
function schedulePhoneViewport() {
  if (!phoneViewportFrame) phoneViewportFrame = requestAnimationFrame(syncPhoneKeyboard);
}
window.visualViewport?.addEventListener('resize', schedulePhoneViewport);
window.visualViewport?.addEventListener('scroll', schedulePhoneViewport);
window.addEventListener('resize', schedulePhoneViewport);
document.addEventListener('focusin', schedulePhoneViewport);
document.addEventListener('focusout', schedulePhoneViewport);
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
const dayRoutes = createDayRoutes({ state, commit: commitTrip, icon, editPlan: item => { itinerary.openPlan(item); $('plan-time-button').click(); }, showMap: () => setMobileMap(true), cancelCamera: () => { cancelAnimationFrame(state.animation); state.animation = 0; state.cameraMoving = false; } });
const essentials = createTravelEssentials({ state, getDestination: () => state.selected || state.trip, icon });
const wallet = createWallet({ state, commit: commitTrip, icon });
const planToolbar = document.querySelector('.plan-toolbar');
const toolbarAnchor = document.createComment('Phone plan controls');
planToolbar.before(toolbarAnchor);
const mapToggle = $('mobile-map-toggle');
const mapToggleAnchor = document.createComment('Discover map control');
mapToggle.before(mapToggleAnchor);
const desktopToolbarLayout = matchMedia('(min-width:901px)');
const backPlan = $('back-to-plan'), viewToggle = document.querySelector('.itinerary-toggle'), addPlan = $('add-plan'), editDates = $('edit-dates');
const dateAnchor = document.createComment('Desktop trip dates'); editDates.before(dateAnchor);
const backAnchor = document.createComment('Desktop back'); backPlan.before(backAnchor);
const toggleAnchor = document.createComment('Desktop view switch'); viewToggle.before(toggleAnchor);
const addAnchor = document.createComment('Desktop add'); addPlan.before(addAnchor);
const exploreDayLabel = $('explore-day').closest('label'), exploreDayAnchor = document.createComment('Desktop explore day'); exploreDayLabel.before(exploreDayAnchor);
$('back-button').innerHTML = icon('back');
function positionPlanToolbar() {
  const phone = phoneHeaderLayout.matches, dock = desktopToolbarLayout.matches && !phone;
  const host = $('workspace-tools'), phoneHost = $('phone-plan-tools');
  const day = phone && state.workspaceView === 'itinerary' && state.planMode === 'day';
  const calendar = phone && state.workspaceView === 'itinerary' && state.planMode === 'calendar';
  if (phone) {
    $('phone-discover-options').prepend(exploreDayLabel);
    $('phone-place-category').value = state.nearbyCategory; refreshDropdowns($('phone-place-category'));
    $('phone-leading').append($('back-button'), backPlan);
    phoneHost.append(addPlan);
    $('phone-view-switch').append(viewToggle);
    mapToggleAnchor.before(mapToggle);
    planToolbar.hidden = true;
    $('back-button').hidden = day || calendar;
    const previousView = workspaceTrail.at(-1)?.view || 'itinerary';
    $('back-button').setAttribute('aria-label', state.workspaceView === 'itinerary' ? 'Back to trips' : `Back to ${previousView === 'explore' ? 'map' : previousView === 'transportation' ? 'travel' : state.planMode === 'day' ? 'day' : state.planMode === 'calendar' ? 'calendar' : 'plan'}`);
    backPlan.hidden = !day && !calendar;
    $('phone-day-picker').hidden = !day;
    phoneHost.hidden = state.workspaceView !== 'itinerary';
    viewToggle.hidden = day || calendar || state.workspaceView !== 'itinerary';
  } else {
    exploreDayAnchor.before(exploreDayLabel);
    backAnchor.before(backPlan); toggleAnchor.before(viewToggle); addAnchor.before(addPlan); dateAnchor.before(editDates);
    $('destination-hero').append($('back-button'));
    $('back-button').hidden = true; $('phone-day-picker').hidden = true;
    mapToggleAnchor.before(mapToggle);
    if (dock) host.append(planToolbar); else toolbarAnchor.before(planToolbar);
    planToolbar.hidden = state.workspaceView !== 'itinerary'; phoneHost.hidden = true;
  }
  host.hidden = !dock || state.workspaceView !== 'itinerary';
  mapToggle.hidden = state.workspaceView === 'transportation' || state.workspaceView === 'ideas' || (phone && state.workspaceView === 'itinerary' && $('plan-controls').dataset.mobileSurface !== 'map');
  for (const button of viewToggle.querySelectorAll('button')) button.title = phone ? '' : button.getAttribute('aria-label');
}

desktopToolbarLayout.addEventListener('change', positionPlanToolbar);
phoneHeaderLayout.addEventListener('change', positionPlanToolbar);
positionPlanToolbar();
const itinerary = createItineraryUI({ state, commit: commitTrip,
  closeMobileMap: () => { if (phoneHeaderLayout.matches && $('plan-controls').dataset.mobileSurface === 'map') { setMobileMap(false); return true; } return false; },
  explore: () => { updateDayContext(state.day); setWorkspaceView('explore', { showPlaces: true }); },
  onDayChange: updateDayContext,
  editTripDates: trigger => openCalendar('trip', 'start', trigger),
  editStopDates: stop => openStopEditor(stop?.placeId ? stop : tripStops(state.trip).find(stop => stop.placeId === state.stopFilter) || state.selected),
  onRendered: () => { pruneDayDetails(); dayRoutes.render(); drawMarkers(); essentials.render(); wallet.render(); },
  onModeChange: mode => {
    positionPlanToolbar();
    const selectedNavigation = state.workspaceView;
    for (const button of document.querySelectorAll('[data-workspace-view]')) button.setAttribute('aria-pressed', String(button.dataset.workspaceView === selectedNavigation));
    if ($('plan-controls').dataset.mode === mode) return;
    $('plan-controls').dataset.mode = mode;
    scheduleMapSuggestions();
    if (state.map) requestAnimationFrame(() => google.maps.event.trigger(state.map, 'resize'));
  },
  chooseDates: () => { $('edit-date-picker').close(); openCalendar(); $('save-dates').focus({ preventScroll: true }); },
  focusPlace: place => { animateMap(place, 15); document.querySelectorAll('[data-place-id]').forEach(element => element.classList.toggle('selected', element.dataset.placeId === place.placeId)); }, hydratePlace, decoratePlaceIcon, icon });
enhanceTimePickers(); enhanceDropdowns(); enhanceDisclosures();setBoardPenControls(false);
new MutationObserver(records => {
  for (const record of records) for (const added of record.addedNodes) if (added.nodeType === 1 && !added.closest('.gm-style, .day-transition-snapshot')) enhanceDisclosures(added);
}).observe(document.body, { childList: true, subtree: true });
for (const button of document.querySelectorAll('[data-workspace-view]')) button.addEventListener('click', () => {
  const view = button.dataset.workspaceView;
  if (view === 'itinerary' && state.workspaceView === view && state.planMode !== 'list') { setMobileMap(false); itinerary.showOverview(); return; }
  setWorkspaceView(view);
});
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
let pendingStop = null, editingStopId = null, stopCalendarReturn = null;
function renderStopDraft(place, existing = false) {
  pendingStop = place; $('destination-picker-status').textContent = ''; $('destination-picker-status').classList.remove('error');
  $('stop-date-panel').hidden = false; $('stop-suggestions').hidden = true;
  $('stop-search').closest('.search-field').hidden = true;
  $('stop-selection-name').textContent = place.name; $('stop-selection-address').textContent = place.address || '';
  $('destination-picker-title').textContent = existing ? 'Edit stop' : 'Add stop';
  $('save-stop').firstChild.textContent = existing ? 'Save changes' : 'Add stop';
  const entries = stopSchedule(state.trip);
  const entry = entries.find(item => item.stop.placeId === place.placeId);
  const initial = entry?.start || entries.at(-1)?.end || '';
  $('stop-date-fields').hidden = false;
  $('stop-arrival').value = initial;
  $('stop-departure').value = entry?.end || initial;
  updateStopDateFields();
  $('stop-route-actions').hidden = !existing; $('change-stop-place').hidden = existing;
  $('back-to-trip-calendar').hidden = !existing;
  const index = entries.findIndex(item => item.stop.placeId === place.placeId);
  $('stop-earlier').disabled = index <= 0; $('stop-later').disabled = index >= entries.length - 1;
  $('remove-stop').disabled = entries.length < 2;
  revealSequence($('stop-date-panel').children, { step: 45 });
  $('stop-arrival').focus({ preventScroll: true });
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
    if (!editingStopId && next !== state.trip) {
      const stops = tripStops(next), destination = stops.at(-1), origin = stops.at(-2);
      if (origin) next = { ...next, transport: [...(next.transport || []), { id: crypto.randomUUID(), trip_id: next.id, mode: 'Flight', service_id: '', departure_location: origin.name, arrival_location: destination.name, departure_date: '', departure_time: '', departure_time_zone: origin.timeZone || next.timeZone || 'UTC', arrival_date: '', arrival_time: '', arrival_time_zone: destination.timeZone || next.timeZone || 'UTC', notes: '', draft: true, leg: 'transfer', fromPlaceId: origin.placeId, toPlaceId: destination.placeId }] };
    }
    if ($('stop-arrival').value || $('stop-departure').value) next = setStopDates(next, pendingStop.placeId, $('stop-arrival').value, $('stop-departure').value, { extendTrip: true });
    const stop = tripStops(next).find(stop => stop.placeId === pendingStop.placeId);
    saveTrip(next); state.trip = next; state.stopFilter = stop.placeId; updateRecent(); $('route-search').close(); selectStop(stop);
    status('trip-status', editingStopId ? 'Stop dates updated' : `Added ${stop.name}`);
    if (stopCalendarReturn) returnToTripCalendar(true);
    if (!stop.timeZone) placeZone(stop).then(timeZone => {
      if (!timeZone || state.trip?.id !== next.id || !tripStops(state.trip).some(item => item.placeId === stop.placeId)) return;
      const updated = { ...state.trip, stops: tripStops(state.trip).map(item => item.placeId === stop.placeId ? { ...item, timeZone } : item) };
      saveTrip(updated); state.trip = updated; if (state.selected?.placeId === stop.placeId) state.selected = { ...state.selected, timeZone };
    }).catch(() => {});
  } catch (error) { $('destination-picker-status').textContent = error.message || 'Could not save this stop.'; $('destination-picker-status').classList.add('error'); }
});
function updateStopDateFields() {
  for (const [id, label] of [['stop-arrival', 'Arrival'], ['stop-departure', 'Departure']]) {
    const button = $(id);
    button.innerHTML = `${icon('calendar')}<span>${button.value ? dateLong(button.value) : 'Set date'}</span>`;
    button.setAttribute('aria-label', `${label}: ${button.value ? dateLong(button.value) : 'Set date'}`);
  }
  const start = $('stop-arrival').value, end = $('stop-departure').value;
  const extendsTrip = start && end && (!state.trip.startDate || start < state.trip.startDate || !state.trip.endDate || end > state.trip.endDate);
  $('stop-date-effect').textContent = extendsTrip ? `Trip dates will extend to ${dateLabel(state.trip.startDate && state.trip.startDate < start ? state.trip.startDate : start)} – ${dateLabel(state.trip.endDate && state.trip.endDate > end ? state.trip.endDate : end)}.` : '';
  const saved = stopSchedule(state.trip).find(entry => entry.stop.placeId === editingStopId);
  const changed = saved && (start !== (saved.start || '') || end !== (saved.end || ''));
  const returnLabel = stopCalendarReturn ? 'trip dates' : 'calendar';
  $('back-to-trip-calendar').querySelector('span').textContent = `${changed ? 'Cancel & back' : 'Back'} to ${returnLabel}`;
}
$('stop-arrival').addEventListener('click', () => openCalendar('stop', 'start', $('stop-arrival')));
$('stop-departure').addEventListener('click', () => openCalendar('stop', 'end', $('stop-departure')));
$('change-stop-place').addEventListener('click', () => {
  if (editingStopId) { $('route-search').close(); openDestinationPicker(); return; }
  pendingStop = null; $('stop-date-panel').hidden = true; $('stop-search').closest('.search-field').hidden = false;
  stopAutocomplete.reset(); $('stop-search').focus({ preventScroll: true });
});
function openStopEditor(stop, calendarReturn = null) {
  if (!stop || !state.trip) return;
  stopCalendarReturn = calendarReturn;
  editingStopId = stop.placeId; $('trip-menu').hidden = true;
  stopAutocomplete.reset(); $('route-search').showModal(); renderStopDraft(stop, true);
}
function returnToTripCalendar(saved = false) {
  const previous = stopCalendarReturn; stopCalendarReturn = null;
  $('route-search').close();
  if (!previous) { state.planMode = 'calendar'; setWorkspaceView('itinerary'); return; }
  openCalendar();
  if (previous) {
    state.calendarRange = { ...previous.range };
    if (saved) {
      if (state.trip.startDate < state.calendarRange.start) state.calendarRange.start = state.trip.startDate;
      if (state.trip.endDate > state.calendarRange.end) state.calendarRange.end = state.trip.endDate;
    }
    calendarEndpoint = previous.endpoint;
    state.calendarYear = previous.year; state.calendarMonth = previous.month;
    renderCalendar();
    $('edit-date-picker').querySelector('.calendar-scroll-body').scrollTop = previous.scrollTop;
    $('date-summary').querySelector(`[data-calendar-endpoint="${calendarEndpoint}"]`).focus({ preventScroll: true });
  }
}
$('back-to-trip-calendar').addEventListener('click', () => returnToTripCalendar());
for (const [id, direction] of [['stop-earlier', -1], ['stop-later', 1]]) $(id).addEventListener('click', () => {
  const index = tripStops(state.trip).findIndex(stop => stop.placeId === editingStopId);
  commitRoute(moveStop(state.trip, index, direction), editingStopId);
  renderStopDraft(tripStops(state.trip).find(stop => stop.placeId === editingStopId), true);
});
$('remove-stop').addEventListener('click', () => {
  const removedId = editingStopId, stop = tripStops(state.trip).find(stop => stop.placeId === removedId);
  if (commitRoute(removeStop(state.trip, removedId))) { $('route-search').close(); status('trip-status', `Removed ${stop.name}`); }
});

$('stop-search').addEventListener('input', () => { $('clear-destination-query').hidden = !$('stop-search').value; });
$('clear-destination-query').addEventListener('click', () => {
  stopAutocomplete.reset(); $('clear-destination-query').hidden = true;
  $('stop-search').focus({ preventScroll: true });
});

function toggleHeroCredits() {
  const panel = $('hero-photo-credits'); panel.hidden = !panel.hidden;
  $('hero-credits-toggle').setAttribute('aria-expanded', String(!panel.hidden));
  if (!panel.hidden) playMotion(panel, [{opacity:0,transform:'scale(.98)'},{opacity:1,transform:'none'}], {duration:180});
}
$('hero-credits-toggle').addEventListener('click', toggleHeroCredits);
$('menu-photo-credits').addEventListener('click', () => { $('trip-menu').hidden = true; toggleHeroCredits(); });
document.addEventListener('pointerdown', event => { if (!$('hero-photo-credits').hidden && !event.target.closest('#hero-photo-credits,#hero-credits-toggle,#menu-photo-credits')) { $('hero-photo-credits').hidden = true; $('hero-credits-toggle').setAttribute('aria-expanded','false'); } });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && !$('hero-photo-credits').hidden) { $('hero-photo-credits').hidden = true; $('hero-credits-toggle').setAttribute('aria-expanded','false'); (phoneHeaderLayout.matches ? $('trip-menu-button') : $('hero-credits-toggle')).focus({preventScroll:true}); } });
$('back-button').addEventListener('click', () => {
  if (state.workspaceView !== 'itinerary') {
    const previous = workspaceTrail.pop() || { view: 'itinerary', scroll: 0 };
    setWorkspaceView(previous.view, { remember: false });
    $(previous.view === 'itinerary' ? 'day-content' : previous.view === 'explore' ? 'nearby-results' : 'transport-panel').scrollTop = previous.scroll;
  } else if (phoneHeaderLayout.matches && $('plan-controls').dataset.mobileSurface === 'map') setMobileMap(false);
  else if (state.planMode !== 'list') itinerary.back();
  else showHome();
});
$('mobile-back').addEventListener('click', () => showHome());
$('my-trips').addEventListener('click', () => showHome());
document.querySelector('.brand').addEventListener('click', event => {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
  event.preventDefault(); showHome();
});
function openDestinationPicker() {
  $('trip-menu').hidden = true;
  editingStopId = null; pendingStop = null; stopCalendarReturn = null; stopAutocomplete.reset();
  $('destination-picker-title').textContent = 'Add stop'; $('stop-date-panel').hidden = true; $('stop-search').closest('.search-field').hidden = false;
  $('clear-destination-query').hidden = true;
  $('route-search').showModal();
  $('stop-search').focus({ preventScroll: true });
}
$('add-stop').addEventListener('click', openDestinationPicker);
$('mobile-add-stop').addEventListener('click', openDestinationPicker);
$('close-destination-picker').addEventListener('click', () => closeDialogSmooth($('route-search')));
$('route-search').addEventListener('close', () => stopAutocomplete.reset());
$('mobile-stop-selector').addEventListener('change', event => {
  const stop = tripStops(state.trip).find(stop => stop.placeId === event.target.value);
  if (stop) navigateStop(stop);
});
phoneHeaderLayout.addEventListener('change', () => { if (state.trip) { renderRoute(); drawMarkers(); scheduleMapSuggestions(); } });
function renderCalendar() {
  const { start, end } = state.calendarRange;
  $('date-summary').innerHTML = `<button type="button" data-calendar-endpoint="start" aria-pressed="${calendarEndpoint === 'start'}"><span>${calendarContext === 'stop' ? 'Arrival' : 'Start'}</span><strong>${start ? dateLong(start) : 'Choose a day'}</strong></button><button type="button" data-calendar-endpoint="end" aria-pressed="${calendarEndpoint === 'end'}"><span>${calendarContext === 'stop' ? 'Departure' : 'End'}</span><strong>${end ? dateLong(end) : 'Choose a day'}</strong></button>`;
  for (const button of $('date-summary').querySelectorAll('button')) button.addEventListener('click', () => {
    calendarEndpoint = button.dataset.calendarEndpoint;
    const value = state.calendarRange[calendarEndpoint];
    if (value) { const date = new Date(`${value}T12:00:00Z`); state.calendarYear = date.getUTCFullYear(); state.calendarMonth = date.getUTCMonth(); }
    renderCalendar(); $('date-summary').querySelector(`[data-calendar-endpoint="${calendarEndpoint}"]`).focus({ preventScroll: true });
  });
  const shift = calendarContext === 'trip' && $('shift-trip-plans').checked ? dateOffset(state.trip.startDate, start) : 0;
  $('trip-date-shift').hidden = calendarContext !== 'trip' || !state.trip.startDate || start === state.trip.startDate;
  $('trip-date-effect').textContent = shift ? `Plans, stops & flight dates move ${Math.abs(shift)} ${Math.abs(shift) === 1 ? 'day' : 'days'} ${shift > 0 ? 'later' : 'earlier'}.` : 'Existing plans keep their dates.';
  const calendarTrip = calendarContext === 'trip' ? { ...shiftTripDays(state.trip, shift), startDate: start, endDate: end } : state.trip;
  const stopEntries = calendarStops(calendarTrip);
  renderCalendarStops($('calendar-stops'), calendarContext === 'trip' ? stopEntries : [], { rangeLabel: stopRangeLabel, icon, onEdit: stop => {
    const previous = { range: { ...state.calendarRange }, endpoint: calendarEndpoint, year: state.calendarYear, month: state.calendarMonth, scrollTop: $('edit-date-picker').querySelector('.calendar-scroll-body').scrollTop };
    $('edit-date-picker').close(); openStopEditor(stop, previous);
  } });
  $('date-stop-disclosure').hidden = calendarContext !== 'trip' || stopEntries.length < 2;
  for (const button of $('calendar-stops').querySelectorAll('button')) {
    button.disabled = Boolean(shift);
    if (shift) button.title = 'Save the trip dates before editing an individual stop.';
  }
  const month = new Date(Date.UTC(state.calendarYear, state.calendarMonth, 1));
  $('calendar-month').textContent = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(month);
  const grid = $('calendar-grid'); grid.replaceChildren();
  for (const label of ['M', 'T', 'W', 'T', 'F', 'S', 'S']) {
    const heading = document.createElement('span'); heading.className = 'calendar-weekday'; heading.textContent = label; heading.setAttribute('aria-hidden', 'true'); grid.append(heading);
  }
  for (const date of calendarMonth(state.calendarYear, state.calendarMonth)) {
    if (!date) { const blank = document.createElement('span'); grid.append(blank); continue; }
    const button = document.createElement('button'); button.type = 'button'; button.dataset.date = date; button.textContent = String(Number(date.slice(-2)));
    button.setAttribute('aria-label', new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`)));
    const entry = stopEntries.length > 1 ? calendarStopOnDay(calendarTrip, date, stopEntries) : null;
    if (entry) { button.dataset.stopId = entry.stop.placeId; button.dataset.stopNumber = String(entry.index + 1); button.title = entry.stop.name; button.setAttribute('aria-label', `${button.getAttribute('aria-label')}, ${entry.stop.name}`); }
    button.setAttribute('aria-pressed', String(date === start || date === end));
    if (date === start || date === end) button.classList.add('selected');
    if (start && end && date > start && date < end) button.classList.add('in-range');
    button.addEventListener('click', () => {
      if (calendarEndpoint === 'start' || !state.calendarRange.start) {
        const previous = state.calendarRange;
        const shiftedEnd = calendarContext === 'trip' && $('shift-trip-plans').checked && previous.start && previous.end ? offsetDate(previous.end, dateOffset(previous.start, date)) : null;
        state.calendarRange = { start: date, end: shiftedEnd || (previous.end >= date ? previous.end : null) };
        calendarEndpoint = 'end';
      } else if (date < state.calendarRange.start) {
        $('calendar-message').textContent = 'Choose an end date on or after the start.'; return;
      } else state.calendarRange.end = date;
      $('calendar-message').replaceChildren(); renderCalendar();
      $('calendar-grid').querySelector(`[data-date="${date}"]`)?.focus({ preventScroll: true });
    });
    grid.append(button);
  }
  $('save-dates').disabled = !start || !end;
}
let calendarContext = 'trip', calendarEndpoint = 'start', calendarTrigger = null;
function openCalendar(context = 'trip', endpoint = 'start', trigger = $('trip-menu-button')) {
  const picker = $('edit-date-picker');
  if (picker.open) { closeDialogSmooth(picker); return; }
  calendarContext = context; calendarEndpoint = endpoint; calendarTrigger = trigger;
  $('date-stop-disclosure').open = false;
  $('shift-trip-plans').checked = true;
  state.calendarRange = context === 'stop' ? { start: $('stop-arrival').value || null, end: $('stop-departure').value || null } : { start: state.trip?.startDate || null, end: state.trip?.endDate || null };
  const value = state.calendarRange[endpoint] || state.calendarRange.start;
  const focusDate = value ? new Date(`${value}T12:00:00Z`) : new Date();
  state.calendarYear = focusDate.getUTCFullYear(); state.calendarMonth = focusDate.getUTCMonth();
  $('date-picker-title').textContent = context === 'stop' ? `${pendingStop.name} dates` : 'Trip dates';
  $('save-dates').firstChild.textContent = context === 'stop' ? 'Use dates ' : 'Save dates ';
  $('calendar-message').replaceChildren(); renderCalendar(); picker.showModal();
  picker.querySelector('.calendar-scroll-body').scrollTop = 0;
  $('date-summary').querySelector(`[data-calendar-endpoint="${endpoint}"]`).focus({ preventScroll: true });
}
$('edit-dates').addEventListener('click', () => openCalendar());
$('shift-trip-plans').addEventListener('change', renderCalendar);
$('edit-date-picker').addEventListener('close', () => calendarTrigger?.focus({ preventScroll: true }));
function saveDates(startDate, endDate) {
  if (!state.trip) return;
  let next;
  try { next = changeTripDates(state.trip, startDate, endDate, { movePlans: $('shift-trip-plans').checked }); }
  catch (error) { $('calendar-message').textContent = error.message; return; }
  try {
    const delta = dateOffset(state.trip.startDate, next.startDate);
    const scheduled = scheduleUnassigned(next); saveTrip(scheduled);
    state.day = $('shift-trip-plans').checked ? offsetDate(state.day, delta) : state.day;
    state.trip = scheduled; itinerary.resetNavigation();
    if (!datesForStop(scheduled, state.stopFilter).includes(state.day)) state.day = datesForStop(scheduled, state.stopFilter)[0] || 'ideas';
    closeDatePicker(); $('trip-dates').textContent = tripDateLabel(next);
    renderRoute(); renderPlan(); status('trip-status', 'Trip dates updated');
  } catch { $('calendar-message').textContent = 'Could not save dates on this device.'; }
}
$('save-dates').addEventListener('click', () => {
  const { start, end } = state.calendarRange;
  if (calendarContext === 'trip') { saveDates(start, end); return; }
  try {
    const draft = editingStopId ? state.trip : addStop(state.trip, pendingStop);
    setStopDates(draft, pendingStop.placeId, start, end, { extendTrip: true });
    $('stop-arrival').value = start; $('stop-departure').value = end;
    updateStopDateFields(); $('destination-picker-status').textContent = ''; closeDatePicker();
  } catch (error) { $('calendar-message').textContent = error.message; }
});
function closeDatePicker() {
  const picker = $('edit-date-picker');
  return closeDialogSmooth(picker);
}
$('clear-dates').addEventListener('click', closeDatePicker);
$('edit-date-picker').addEventListener('cancel', event => {
  event.preventDefault(); closeDatePicker();
});
document.querySelectorAll('[data-date-preset]').forEach(button => button.addEventListener('click', () => {
  const range = presetRange(button.dataset.datePreset);
  if (range) { state.calendarRange = range; calendarEndpoint = 'start'; const date = new Date(`${range.start}T12:00:00Z`); state.calendarYear = date.getUTCFullYear(); state.calendarMonth = date.getUTCMonth(); $('calendar-message').replaceChildren(); renderCalendar(); }
}));
function moveCalendarMonth(delta) {
  const date = new Date(Date.UTC(state.calendarYear, state.calendarMonth + delta, 1));
  state.calendarYear = date.getUTCFullYear(); state.calendarMonth = date.getUTCMonth(); renderCalendar();
}
$('previous-month').addEventListener('click', () => moveCalendarMonth(-1));
$('next-month').addEventListener('click', () => moveCalendarMonth(1));
$('trip-menu-button').addEventListener('click', () => { $('trip-menu').hidden = !$('trip-menu').hidden; $('delete-trip').textContent = 'Delete trip'; $('delete-trip').dataset.confirm = 'false'; });
$('save-trip-guide').addEventListener('click', () => {
  try {
    downloadTripGuide(state.trip);
    $('trip-menu').hidden = true;
    $('trip-menu-button').focus({ preventScroll: true });
    status('trip-status', 'Itinerary saved. Open the downloaded file to read it offline.');
  } catch (error) { status('trip-status', error.message); }
});
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
  if (current && state.trip?.id !== current.id) openTrip(current);
  else if (current) { state.trip = current; renderPlan(); drawMarkers(); }
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
document.addEventListener('pointerdown', event => {
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

// Phone actions are explicit taps, grouped in one menu rather than exposed on every row.
$('phone-account').addEventListener('click', () => { $('trip-menu').hidden = true; $(currentAccount() ? 'account-signout' : 'account-button').click(); });
$('phone-place-category').addEventListener('change', event => document.querySelector(`[data-nearby="${event.target.value}"]`)?.click());
$('phone-rename').addEventListener('click', () => { $('trip-menu').hidden = true; if (state.planMode === 'day' && state.workspaceView === 'itinerary') itinerary.showOverview(); $('edit-trip-title').click(); });
editDates.addEventListener('click', () => { if (phoneHeaderLayout.matches) $('trip-menu').hidden = true; });
phoneHeaderLayout.addEventListener('change', () => { if (!phoneHeaderLayout.matches && state.trip && state.places) loadDestinationPhoto(); });
