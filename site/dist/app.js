import { readTrips, saveTrip, deleteTrip, addPlace, removePlace, movePlace, addStop, moveStop, removeStop, tripStops } from './trip-store.js';
import { calendarMonth, presetRange, rangeLength, selectDateRange } from './date-range.js';
import { datesForTrip, mappedPlace, fixedItem } from './itinerary-model.js';
import { createItineraryUI } from './itinerary-ui.js';

const $ = id => document.getElementById(id);
const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
const state = { maps: null, places: null, markerClass: null, map: null, marker: null, stopMarkers: [], placeMarkers: [], suggestionMarkers: [], suggestions: [], selected: null, trip: null, day: 'ideas', animation: 0, config: null, pendingNearby: null, nearbyRequest: 0, photoRequest: 0, calendarRange: { start: null, end: null }, calendarYear: 0, calendarMonth: 0, routeEditing: false, planMode: 'list', workspaceView: 'itinerary' };
const dateLabel = value => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
const dateLong = value => new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
const tripDateLabel = trip => trip.startDate && trip.endDate ? `${dateLabel(trip.startDate)} – ${dateLabel(trip.endDate)}` : 'Add dates';
const coordinates = place => ({ lat: place.latitude, lng: place.longitude });
const status = (id, text = '') => { $(id).textContent = text; };

const daysForTrip = datesForTrip;

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
    button.querySelector('strong').textContent = trip.name;
    button.addEventListener('click', () => openTrip(trip));
    $('recent-items').append(button);
  }
}

function showHome({ focus = false } = {}) {
  cancelAnimationFrame(state.animation);
  state.photoRequest++;
  state.selected = null; state.trip = null;
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
  const list = $('route-list'); list.replaceChildren();
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
        const button = document.createElement('button'); button.type = 'button'; button.textContent = direction < 0 ? '←' : '→';
        button.setAttribute('aria-label', `Move ${stop.name} ${label.toLowerCase()}`); button.disabled = disabled;
        button.addEventListener('click', () => commitRoute(moveStop(state.trip, index, direction), stop.placeId)); controls.append(button);
      }
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '×'; remove.disabled = stops.length === 1;
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
  $('edit-route').textContent = state.routeEditing ? 'DONE' : 'EDIT ROUTE';
}

function selectStop(stop) {
  if (!stop || !state.trip) return;
  state.selected = stop; state.photoRequest++; state.nearbyRequest++; state.suggestions = [];
  $('nearby-results').replaceChildren();
  $('trip-title').textContent = stop.name;
  $('trip-address').textContent = stop.address || '';
  $('map-caption').textContent = stop.name;
  $('hero-photo').hidden = true; $('hero-photo').removeAttribute('src'); $('hero-credit').hidden = true;
  renderRoute(); showMap(stop, true); drawMarkers();
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
  state.selected = place; state.trip = trip;
  state.photoRequest++;
  state.pendingNearby = null;
  state.nearbyRequest++;
  state.suggestions = [];
  $('nearby-results').hidden = true;
  $('nearby-results').replaceChildren();
  document.querySelectorAll('[data-nearby]').forEach(button => button.classList.remove('active'));
  $('home-view').hidden = true;
  $('workspace').hidden = false;
  $('trip-title').textContent = place.name;
  $('trip-address').textContent = place.address || '';
  $('map-caption').textContent = place.name;
  $('trip-dates').textContent = tripDateLabel(trip);
  $('trip-menu').hidden = true;
  $('edit-date-picker').hidden = true;
  $('route-search').hidden = true;
  state.routeEditing = false;
  status('trip-status');
  $('hero-photo').hidden = true;
  $('hero-photo').removeAttribute('src');
  $('hero-credit').hidden = true;
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

async function loadDestinationPhoto(destination) {
  if (!state.places?.Place) return;
  const requestId = ++state.photoRequest;
  let source = null;
  try {
    const place = new state.places.Place({ id: destination.placeId });
    await place.fetchFields({ fields: ['photos'] });
    if (requestId !== state.photoRequest || state.selected?.placeId !== destination.placeId) return;
    const photo = place.photos?.[0];
    if (photo) source = { src: photo.getURI({ maxWidth: 1600 }), googlePhoto: photo };
  } catch { /* Try the freely licensed destination image source below. */ }
  if (!source) {
    try { source = await wikimediaImage(destination, 1600); } catch { return; }
  }
  if (!source || requestId !== state.photoRequest || state.selected?.placeId !== destination.placeId) return;
  const image = $('hero-photo');
  image.alt = destination.name;
  image.onload = () => { if (requestId === state.photoRequest) image.hidden = false; };
  image.onerror = () => { image.hidden = true; };
  image.src = source.src;
  if (source.googlePhoto) photoCredits($('hero-credit'), source.googlePhoto);
  else wikimediaCredits($('hero-credit'), source);
}

function markerContent(name = 'pin') {
  const content = document.createElement('span');
  content.className = 'destination-pin';
  content.innerHTML = icon(name);
  return content;
}

function routeMarkerContent(index) {
  const content = document.createElement('span'); content.className = 'route-pin';
  content.textContent = String(index + 1);
  return content;
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

function drawMarkers() {
  if (!state.map || !state.markerClass || !state.selected) return;
  if (state.marker) state.marker.map = null;
  for (const marker of state.stopMarkers) marker.map = null;
  for (const marker of state.placeMarkers) marker.map = null;
  for (const marker of state.suggestionMarkers) marker.map = null;
  state.stopMarkers = [];
  state.placeMarkers = [];
  state.suggestionMarkers = [];
  state.marker = new state.markerClass({ map: state.map, position: coordinates(state.selected), title: state.selected.name, content: markerContent() });
  for (const [index, stop] of tripStops(state.trip).entries()) {
    if (stop.placeId === state.selected.placeId) continue;
    const marker = new state.markerClass({ map: state.map, position: coordinates(stop), title: `Stop ${index + 1}: ${stop.name}`, content: routeMarkerContent(index), gmpClickable: true });
    marker.addEventListener('gmp-click', () => selectStop(stop));
    state.stopMarkers.push(marker);
  }
  for (const item of (state.trip?.items || []).filter(mappedPlace)) {
    const marker = new state.markerClass({ map: state.map, position: coordinates(item), title: item.name, content: markerContent('pin'), gmpClickable: true });
    marker.addEventListener('gmp-click', () => animateMap(item, 15));
    state.placeMarkers.push(marker);
  }
  for (const item of state.suggestions) {
    const pin = markerContent('plus'); pin.classList.add('suggestion-pin');
    const marker = new state.markerClass({ map: state.map, position: coordinates(item), title: item.name, content: pin, gmpClickable: true });
    marker.addEventListener('gmp-click', () => animateMap(item, 15));
    state.suggestionMarkers.push(marker);
  }
}

async function exploreNearby(category) {
  if (!state.trip) return;
  const types = { see: ['tourist_attraction', 'museum', 'art_gallery'], eat: ['restaurant', 'cafe'], stay: ['hotel'] }[category];
  if (!types) return;
  const requestId = ++state.nearbyRequest;
  document.querySelectorAll('[data-nearby]').forEach(button => button.classList.toggle('active', button.dataset.nearby === category));
  const container = $('nearby-results');
  container.hidden = false;
  container.textContent = 'Finding places…';
  if (!state.places?.Place) { state.pendingNearby = category; return; }
  try {
    const { places } = await state.places.Place.searchNearby({
      fields: ['id', 'displayName', 'formattedAddress', 'location', 'photos'],
      locationRestriction: { center: coordinates(state.selected || state.trip), radius: 12000 },
      includedPrimaryTypes: types,
      maxResultCount: 4,
      rankPreference: state.places.SearchNearbyRankPreference.POPULARITY,
      language: 'en'
    });
    if (requestId !== state.nearbyRequest) return;
    state.suggestions = (places || []).filter(place => place.id && place.location).map(place => ({
      placeId: place.id, name: place.displayName || 'Place', address: place.formattedAddress || '',
      latitude: place.location.lat(), longitude: place.location.lng(), photo: place.photos?.[0] || null
    }));
    container.replaceChildren();
    if (!state.suggestions.length) { container.textContent = 'No places found nearby.'; drawMarkers(); return; }
    for (const [index, place] of state.suggestions.entries()) {
      const row = document.createElement('div'); row.className = 'nearby-item';
      row.dataset.placeId = place.placeId;
      row.dataset.index = String(index + 1).padStart(2, '0');
      row.innerHTML = `<span class="nearby-shade"></span><span class="nearby-copy"><strong></strong><small></small></span><button type="button" aria-label="Add place">${icon('plus')}</button>`;
      if (place.photo) {
        const image = document.createElement('img'); image.className = 'nearby-image'; image.alt = ''; image.loading = 'lazy';
        image.src = place.photo.getURI({ maxWidth: 520 });
        row.prepend(image);
        const credit = document.createElement('span'); credit.className = 'photo-credit';
        photoCredits(credit, place.photo);
        if (!credit.hidden) row.append(credit);
      } else {
        wikimediaImage(place, 520).then(photo => {
          if (!photo || requestId !== state.nearbyRequest || !row.isConnected) return;
          const image = document.createElement('img'); image.className = 'nearby-image'; image.alt = ''; image.loading = 'lazy'; image.src = photo.src;
          row.prepend(image);
          const credit = document.createElement('span'); credit.className = 'photo-credit';
          wikimediaCredits(credit, photo); row.append(credit);
        }).catch(() => {});
      }
      row.querySelector('strong').textContent = place.name;
      row.querySelector('small').textContent = place.address;
      const addSuggestion = () => {
        const { photo, ...placeData } = place;
        const next = addPlace(state.trip, { ...placeData, day: state.day, timeZone: state.selected?.timeZone || state.trip.timeZone });
        if (next === state.trip) { status('trip-status', 'Already saved for this day.'); return; }
        state.trip = next; saveTrip(next); renderPlan(); drawMarkers(); updateRecent(); animateMap(place, 15);
        status('trip-status', `Added ${place.name}`);
      };
      row.addEventListener('click', event => { if (!event.target.closest('a') && !row.classList.contains('added')) addSuggestion(); });
      row.querySelector('button').addEventListener('click', event => { event.stopPropagation(); addSuggestion(); });
      container.append(row);
    }
    syncSuggestionCards();
    drawMarkers();
  } catch {
    if (requestId !== state.nearbyRequest) return;
    container.textContent = 'Suggestions are unavailable right now.';
    state.suggestions = []; drawMarkers();
  }
}

function showMap(place, fly = false, fitRoute = false) {
  if (!state.maps) return;
  if (!state.map) {
    state.map = new state.maps.Map($('map'), { center: coordinates(place), zoom: 5, mapId: state.config?.mapId || 'DEMO_MAP_ID', gestureHandling: 'cooperative', mapTypeControl: false, streetViewControl: false, fullscreenControl: false, clickableIcons: false, zoomControl: true, cameraControl: false });
    $('map-loading').hidden = true;
  }
  // The map container was hidden on the start screen; allow layout to settle before moving its camera.
  requestAnimationFrame(() => {
    google.maps.event.trigger(state.map, 'resize');
    if (fitRoute && tripStops(state.trip).length > 1) {
      const bounds = new google.maps.LatLngBounds();
      for (const stop of tripStops(state.trip)) bounds.extend(coordinates(stop));
      state.map.fitBounds(bounds, 55);
    } else if (fly) animateMap(place);
    else state.map.moveCamera({ center: coordinates(place), zoom: 12 });
    drawMarkers();
  });
}

function renderPlan() { itinerary.render(); syncSuggestionCards(); }

function syncSuggestionCards() {
  for (const card of $('nearby-results').querySelectorAll('.nearby-item')) {
    const saved = state.trip?.items?.some(item => item.placeId === card.dataset.placeId && item.day === state.day);
    card.classList.toggle('added', Boolean(saved));
    const button = card.querySelector('button');
    button.disabled = Boolean(saved);
    button.setAttribute('aria-label', saved ? 'Added to this day' : 'Add place');
    button.innerHTML = saved ? '✓' : icon('plus');
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
            const place = prediction.toPlace();
            await place.fetchFields({ fields: ['id', 'displayName', 'formattedAddress', 'location'] });
            if (!place.id || !place.location) throw new Error('No map location');
            input.value = inputId.endsWith('-search') && ['departure-search', 'arrival-search'].includes(inputId) ? (place.displayName || '') : ''; token = null;
            onSelect({ placeId: place.id, name: place.displayName || prediction.mainText?.toString() || 'Place', address: place.formattedAddress || '', latitude: place.location.lat(), longitude: place.location.lng() });
            status(inputId === 'destination' ? 'home-status' : 'trip-status');
          } catch { status(inputId === 'destination' ? 'home-status' : 'trip-status', 'Could not open that place. Try another result.'); }
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
  saveTrip(next); state.trip = next; renderPlan(); drawMarkers(); updateRecent();
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
const itinerary = createItineraryUI({ state, commit: commitTrip, explore: () => setWorkspaceView('explore'), chooseDates: () => { $('edit-date-picker').hidden = true; openCalendar(); $('edit-date-picker').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, focusPlace: place => animateMap(place, 15), icon });
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
setupAutocomplete('place-search', 'place-suggestions', place => {
  if (!state.trip) return;
  const next = addPlace(state.trip, { ...place, day: state.day, timeZone: state.selected?.timeZone || state.trip.timeZone });
  if (next === state.trip) { status('trip-status', 'Already saved for this day.'); return; }
  state.trip = next; saveTrip(next); renderPlan(); drawMarkers(); animateMap(place, 15); updateRecent();
}, true);
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
    const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Move to Saved Ideas';
    button.addEventListener('click', () => saveDates(startDate, endDate, true));
    message.append(label, button); return;
  }
  const items = (state.trip.items || []).map(item => item.day === 'ideas' || validDays.includes(item.day) ? item : { ...item, day: 'ideas' });
  const next = { ...state.trip, startDate, endDate, items, stops: tripStops(state.trip).map(stop => ({ ...stop, date: validDays.includes(stop.date) ? stop.date : null })) };
  try { saveTrip(next); state.trip = next; state.day = validDays[0] || 'ideas'; $('edit-date-picker').hidden = true; $('trip-dates').textContent = tripDateLabel(next); renderPlan(); status('trip-status'); }
  catch { $('calendar-message').textContent = 'Could not save dates on this device.'; }
}
$('save-dates').addEventListener('click', () => saveDates(state.calendarRange.start, state.calendarRange.end));
$('clear-dates').addEventListener('click', () => saveDates(null, null));
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
$('trip-menu-button').addEventListener('click', () => { $('trip-menu').hidden = !$('trip-menu').hidden; $('delete-trip').textContent = 'Delete trip'; });
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
    if (!config.mapsKey) throw new Error('Map unavailable');
    state.config = config;
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
