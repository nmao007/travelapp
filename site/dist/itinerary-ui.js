import { tourDraft, tourSummary, tourEndLabel } from './tour-model.js';
import { playMotion, morphFrom, morphFrames, revealSequence } from './motion.js';
import { datesForTrip, monthsForTrip, calendarDisplayCells, eventsForDay, fixedItem, mappedPlace, makePlan, makeTransport, upsertTransport, reorderPlan, stepPlan, removeItineraryEvent, restoreItineraryEvent, duplicatePlan } from './itinerary-model.js';
import { destinationForDay } from './place-model.js';
import { tripStops, datesForStop, stopSchedule } from './trip-store.js';
import { normalizeFlightNumber, sameFlightDetails } from './flight-model.js';
import { createPlanningDrag, capturePlanningLayout, animatePlanningLayout } from './planning-drag.js';
import { refreshDropdowns } from './dropdowns.js';
import { createTransientNotice } from './notices.js';
import { refreshTimePickers, formatClock } from './time-picker.js';
import { panelIsOpen, setPanelOpen } from './expansion.js';
import { createDayMotion } from './day-motion.js';

const $ = id => document.getElementById(id);
const format = (date, options = { weekday: 'short', month: 'short', day: 'numeric' }) => new Intl.DateTimeFormat('en', { ...options, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const node = (tag, className, text) => { const element = document.createElement(tag); if (className) element.className = className; if (text !== undefined) element.textContent = text; return element; };
const action = (label, callback, className = 'quiet-action') => { const button = node('button', className, label); button.type = 'button'; button.addEventListener('click', callback); return button; };

export function createItineraryUI({ state, commit, explore, chooseDates, focusPlace, hydratePlace, decoratePlaceIcon, onDayChange, onModeChange, onRendered, editStopDates, icon }) {
  const dayMotion = createDayMotion($('day-content'), $('plan-panel'));
  function revealPhoneSection(section) {
    if (!matchMedia('(max-width:580px)').matches || section.hidden || !section.closest('dialog')?.open) return;
    section.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth' });
  }
  let editingPlan = null, editingTransport = null, selectedFlight = null, flightTimer = 0, flightRequest = null, draft = null, displayedMonth = null, displayedTrip = null, previewDay = null, previewAnchor = null, closingPreview = false;
  const defaultZone = () => state.selected?.timeZone || state.trip?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const dayOptions = (select, selected, ideas = false) => {
    select.replaceChildren();
    for (const day of [...datesForTrip(state.trip), ...(ideas ? ['ideas'] : [])]) {
      const option = node('option', '', day === 'ideas' ? 'Choose dates' : format(day)); option.value = day; select.append(option);
    }
    if ([...select.options].some(option => option.value === selected)) select.value = selected;
    refreshDropdowns(select);
  };
  const chooseDay = (day, mode) => { state.day = day; if (mode) state.planMode = mode; onDayChange?.(day); render(); };
  const findPlaces = day => { chooseDay(day); explore(); };
  const placeSymbol = item => {
    const holder = node('span'); holder.innerHTML = icon('pin');
    const svg = holder.firstElementChild; decoratePlaceIcon(svg, item); return svg;
  };
  let duplicatingPlan = false;
  let pendingRemoval = null;
  const removalNotice = createTransientNotice($('removal-notice'), { duration: 12000, pauseOnFocus: false, onHide: finishRemoval });
  function finishRemoval() {
    const focused = $('removal-notice').contains(document.activeElement);
    pendingRemoval = null; $('removal-notice').hidden = true; $('removal-message').textContent = '';
    if (focused && !$('workspace').hidden) [$('add-plan'), $('add-transport'), $('trip-menu-button')].find(button => button.getClientRects().length)?.focus({ preventScroll: true });
  }
  function clearRemoval() { removalNotice.clear(); }
  function showRemoval(removal) {
    pendingRemoval = removal;
    $('removal-message').textContent = `Removed ${removal.record.name || removal.record.service_id}`;
    removalNotice.show();
    $('undo-removal').focus({ preventScroll: true });
  }
  $('dismiss-removal').addEventListener('click', () => removalNotice.dismiss());
  $('undo-removal').addEventListener('click', () => {
    if (!pendingRemoval || state.trip?.id !== pendingRemoval.tripId) { clearRemoval(); return; }
    try {
      const removal = pendingRemoval;
      commit(restoreItineraryEvent(state.trip, removal));
      chooseDay(removal.collection === 'items' ? removal.record.day : removal.record.departure_date);
      clearRemoval();
      const row = [...$('day-content').querySelectorAll('[data-item-id]')].find(element => element.dataset.itemId === removal.record.id);
      if (row) { row.scrollIntoView({ block: 'nearest' }); playMotion(row, [{ background: 'var(--tint)' }, { background: '#fff' }], { duration: 700 }); }
    } catch (error) { $('removal-message').textContent = error.message; removalNotice.show(); }
  });

  function savePlanPatch(patch = {}, close = false) {
    if (close && [...$('plan-dialog').querySelectorAll('.time-number,.editable-dropdown input:not([hidden])')].some(input => !input.reportValidity())) return;
    draft = { ...draft, ...patch, name: $('plan-name').value.trim(), timeZone: $('plan-zone').value || defaultZone() };
    if (!editingPlan && !close) { renderPlanTools(); return; }
    try {
      const item = makePlan(state.trip, draft, editingPlan), items = state.trip.items || [];
      commit({ ...state.trip, items: items.some(entry => entry.id === item.id) ? items.map(entry => entry.id === item.id ? item : entry) : [...items, item] });
      editingPlan = item; draft = { ...item }; state.day = item.day; onDayChange?.(item.day); render();
      $('plan-error').textContent = ''; renderPlanTools();
      if (close) $('plan-dialog').close();
    } catch (error) { $('plan-error').textContent = error.message; }
  }

  function renderPlanTools() {
    const canDuplicate = editingPlan && !fixedItem(draft) && datesForTrip(state.trip).length > 1;
    if (!canDuplicate) duplicatingPlan = false;
    $('duplicate-plan').hidden = !canDuplicate;
    $('duplicate-plan').setAttribute('aria-pressed', String(duplicatingPlan));
    $('plan-time-button').textContent = formatClock(draft.time) || 'Any time';
    $('plan-booked').setAttribute('aria-pressed', String(Boolean(draft.booked)));
    $('plan-booked').textContent = draft.booked ? 'Confirmed' : 'Reservation';
    $('plan-reference-wrap').hidden = !draft.booked;
    $('plan-type-button').textContent = draft.kind;
    $('plan-type-button').hidden = draft.kind === 'Tour';
    $('plan-location-button').textContent = draft.kind === 'Tour' ? 'Meeting point' : 'Place';
    $('plan-location-search').placeholder = draft.kind === 'Tour' ? 'Find the meeting point from your operator' : 'Find a restaurant, hotel, or place';
    renderTourTools();
    $('plan-dialog-kind').textContent = editingPlan ? 'Your day' : 'New plan';
    for (const [id, symbol] of [['plan-time-button','clock'],['plan-booked','lock'],['plan-note-button','edit'],['plan-location-button','pin'],['plan-type-button',draft.kind === 'Food' ? 'food' : draft.kind === 'Stay' ? 'stay' : 'day']]) { const button = $(id), label = button.textContent; button.innerHTML = icon(symbol); button.append(document.createTextNode(label)); }
    let position = $('plan-position');
    if (!position) { position = node('div', 'plan-position'); position.id = 'plan-position'; $('plan-type-choices').after(position); }
    position.replaceChildren();
    if (editingPlan && !fixedItem(draft)) {
      const flexible = (state.trip.items || []).filter(item => item.day === draft.day && !fixedItem(item));
      const index = flexible.findIndex(item => item.id === editingPlan.id);
      if (index > 0) position.append(action('Move earlier', () => { commit(reorderPlan(state.trip, editingPlan.id, flexible[index - 1].id)); renderPlanTools(); }, 'quiet-action'));
      if (index >= 0 && index < flexible.length - 1) position.append(action('Move later', () => { commit(reorderPlan(state.trip, flexible[index + 1].id, editingPlan.id)); renderPlanTools(); }, 'quiet-action'));
    }
    const chips = $('plan-day-chips'); chips.replaceChildren();
    chips.setAttribute('aria-label', duplicatingPlan ? 'Duplicate plan to day' : 'Move plan to day');
    if (duplicatingPlan) chips.append(node('strong', 'duplicate-label', 'Duplicate to'));
    for (const day of datesForTrip(state.trip)) {
      const button = action(format(day, { month: 'short', day: 'numeric' }), () => {
        if (!duplicatingPlan) { savePlanPatch({ day }); return; }
        try {
          const result = duplicatePlan(state.trip, editingPlan.id, day);
          commit(result.trip); duplicatingPlan = false; $('plan-dialog').close(); chooseDay(day, 'day');
          const row = [...$('day-content').querySelectorAll('[data-item-id]')].find(element => element.dataset.itemId === result.copy.id);
          row?.scrollIntoView({ block: 'nearest' }); row?.querySelector('.place-copy')?.focus({ preventScroll: true });
          playMotion(row, [{ opacity: .4, transform: 'translateX(-10px)' }, { opacity: 1, transform: 'translateX(0)' }], { duration: 280 });
        } catch (error) { $('plan-error').textContent = error.message; }
      }, 'detail-chip');
      if (duplicatingPlan) { button.disabled = draft.day === day; button.setAttribute('aria-label', `Duplicate to ${format(day)}`); }
      else button.setAttribute('aria-pressed', String(draft.day === day));
      chips.append(button);
    }
  }

  function renderTourTools() {
    const tour = draft.kind === 'Tour' && draft.tour;
    $('tour-planning').hidden = !tour;
    const meetingChoices = $('plan-meeting-choices'); meetingChoices.replaceChildren(); meetingChoices.hidden = !tour;
    if (!tour) return;
    const choices = [...new Map((state.trip.items || []).filter(item => item.placeId && item.id !== draft.id && mappedPlace(item) && (item.kind !== 'Tour' || item.tour?.meetingName)).map(item => [item.placeId, item.kind === 'Tour' ? { ...item, name: item.tour.meetingName } : item])).values()].sort((a, b) => Number(b.day === draft.day) - Number(a.day === draft.day)).slice(0, 6);
    for (const item of choices) meetingChoices.append(action(item.name, () => attachPlace({ placeId: item.placeId, address: item.address, name: item.name, latitude: item.latitude, longitude: item.longitude }), 'detail-chip'));
    meetingChoices.hidden = !choices.length;
    $('tour-booking-note').hidden = Boolean(draft.booked);
    $('tour-people').textContent = `${tour.people} ${tour.people === 1 ? 'person' : 'people'}`;
    $('tour-fewer').disabled = tour.people <= 1; $('tour-more').disabled = tour.people >= 50;
    const durations = $('tour-duration'); durations.replaceChildren();
    for (const minutes of [60, 120, 240, 480]) {
      const button = action(`${minutes / 60} hr`, () => savePlanPatch({ tour: { ...draft.tour, durationMinutes: minutes } }), 'detail-chip');
      button.setAttribute('aria-pressed', String(tour.durationMinutes === minutes)); durations.append(button);
    }
    $('tour-meeting-status').textContent = draft.placeId ? `Meeting point · ${draft.tour.meetingName || draft.address || 'Selected on map'}` : 'Meeting point not set';
  }
  for (const [id, change] of [['tour-fewer', -1], ['tour-more', 1]]) $(id).addEventListener('click', () => savePlanPatch({ tour: { ...draft.tour, people: Math.max(1, Math.min(50, draft.tour.people + change)) } }));

  function openTour(operator) {
    if (!datesForTrip(state.trip).length) { chooseDates(); return; }
    openPlan(); draft = { ...draft, ...tourDraft(operator) };
    $('plan-name').value = draft.name; renderPlanTools();
    hydratePlace($('tour-operator-links'), operator, { contactOnly: true });
    $('plan-done').textContent = 'Add tour'; $('plan-done').focus({ preventScroll: true });
  }

  function openPlan(item = null, day = state.day) {
    const days = datesForTrip(state.trip);
    if (!days.length) { chooseDates(); return; }
    editingPlan = item; duplicatingPlan = false;
    draft = { name: '', day: days.includes(day) ? day : days[0], kind: 'Activity', time: '', timeZone: defaultZone(), notes: '', reference: '', ...item };
    $('plan-name').value = draft.name;
    $('plan-zone').value = draft.timeZone; refreshDropdowns($('plan-zone'));
    $('plan-time').value = draft.time || '';
    refreshTimePickers($('plan-time'));
    $('plan-notes').value = draft.notes || ''; $('plan-reference').value = draft.reference || '';
    $('plan-location-picker').hidden = true; $('plan-location-search').value = ''; $('plan-location-suggestions').hidden = true;
    setPanelOpen($('plan-note-wrap'), Boolean(draft.notes), { animate: false }); setPanelOpen($('plan-time-controls'), false, { animate: false }); $('plan-type-choices').hidden = true;
    $('plan-time-button').setAttribute('aria-expanded', 'false'); $('plan-note-button').setAttribute('aria-expanded', String(Boolean(draft.notes)));
    $('delete-plan').hidden = !item;
    $('plan-error').textContent = ''; renderPlanTools();
    const details = $('plan-place-details'); details.replaceChildren();
    const operatorLinks = $('tour-operator-links'); operatorLinks.replaceChildren(); operatorLinks.dataset.request = '';
    if (item?.kind === 'Tour' && item.tour) hydratePlace(operatorLinks, { placeId: item.tour.operatorPlaceId, name: item.tour.operatorName, latitude: item.tour.operatorLatitude, longitude: item.tour.operatorLongitude }, { contactOnly: true });
    if (item?.placeId) hydratePlace(details, item.kind === 'Tour' ? { ...item, name: item.tour?.meetingName || item.name } : item);
    $('plan-done').textContent = item ? 'Done' : 'Add plan';
    $('plan-dialog').showModal();
    $('plan-dialog').querySelector('.phone-sheet-body').scrollTop = 0;
    if (!item) $('plan-name').focus(); else $('plan-done').focus({ preventScroll: true });
  }

  function openTransport(segment = null, day = state.day) {
    if (!datesForTrip(state.trip).length) { chooseDates(); return; }
    editingTransport = segment;
    const form = $('transport-form'); form.reset();
    form.dataset.version = String(Number(form.dataset.version || 0) + 1); form.dataset.pendingZones = '0'; form.querySelector('[type="submit"]').disabled = false;
    $('transport-dialog-title').textContent = segment ? segment.service_id : 'Add flight or train';
    selectedFlight = segment?.flightData || null;
    clearFlightLookup();
    for (const leg of ['departure', 'arrival']) {
      dayOptions(form.elements[`${leg}_date`], segment?.[`${leg}_date`] || day, false);
      form.elements[`${leg}_time_zone`].value = segment?.[`${leg}_time_zone`] || defaultZone();
      form.elements[`${leg}_location`].value = segment?.[`${leg}_location`] || '';
      form.elements[`${leg}_time`].value = segment?.[`${leg}_time`]?.slice(0, 5) || '';
      $(`${leg}-suggestions`).hidden = true;
    }
    form.elements.mode.value = segment?.mode || 'Flight'; form.elements.service_id.value = segment?.service_id || ''; form.elements.notes.value = segment?.notes || '';
    refreshDropdowns(form);
    refreshTimePickers(form);
    $('delete-transport').hidden = !segment;
    $('transport-error').textContent = ''; $('transport-dialog').showModal(); $('transport-dialog').querySelector('.phone-sheet-body').scrollTop = 0; form.elements.service_id.focus();
  }

  function clearFlightLookup() {
    clearTimeout(flightTimer); flightRequest?.abort(); flightRequest = null;
    $('flight-results').replaceChildren(); $('flight-results').hidden = true;
    $('service-number').setAttribute('aria-expanded', 'false');
  }
  async function searchFlight() {
    const form = $('transport-form'), number = normalizeFlightNumber(form.elements.service_id.value), date = form.elements.departure_date.value;
    clearFlightLookup();
    if (form.elements.mode.value !== 'Flight' || !number || !date || !$('transport-dialog').open) return;
    const results = $('flight-results'); results.hidden = false;
    if (!state.config?.flightLookup) { results.append(node('p', 'flight-lookup-note', 'Flight lookup is not connected. Enter your ticket details below.')); return; }
    const controller = new AbortController(); flightRequest = controller;
    results.append(node('p', 'flight-lookup-note', 'Finding your flight…'));
    try {
      const response = await fetch(`/api/flights?${new URLSearchParams({ number, date })}`, { signal: controller.signal });
      const data = await response.json();
      if (controller.signal.aborted || !$('transport-dialog').open) return;
      results.replaceChildren();
      if (!response.ok) throw new Error(data.error || 'Flight lookup could not connect. Enter your ticket details below.');
      if (!data.flights?.length) { results.append(node('p', 'flight-lookup-note', 'No flight found for this departure date. Enter your ticket details below.')); return; }
      $('service-number').setAttribute('aria-expanded', 'true');
      for (const flight of data.flights) {
        const button = action('', () => {
          if (![flight.departure_date, flight.arrival_date].every(day => datesForTrip(state.trip).includes(day))) { $('transport-error').textContent = 'This flight falls outside your trip dates. Extend the trip dates before adding it.'; return; }
          for (const key of ['service_id', 'departure_date', 'departure_time', 'departure_time_zone', 'departure_location', 'arrival_date', 'arrival_time', 'arrival_time_zone', 'arrival_location']) form.elements[key].value = flight[key];
          for (const leg of ['departure', 'arrival']) delete form.elements[`${leg}_location`].dataset.placeId;
          selectedFlight = flight; $('transport-error').textContent = ''; clearFlightLookup();
          refreshDropdowns(form);
          refreshTimePickers(form);
          form.querySelector('[type="submit"]').focus({ preventScroll: true });
        }, 'flight-choice');
        button.append(node('strong', '', `${flight.service_id} · ${flight.departure_code || flight.departure_location} → ${flight.arrival_code || flight.arrival_location}`), node('span', '', `${formatClock(flight.departure_time)} – ${formatClock(flight.arrival_time)} · ${flight.airline || flight.status}`));
        results.append(button);
      }
      const source = node('a', 'description-source', 'AeroDataBox'); source.href = 'https://aerodatabox.com'; source.target = '_blank'; source.rel = 'noopener noreferrer'; results.append(source);
    } catch (error) { if (!controller.signal.aborted) { results.replaceChildren(node('p', 'flight-lookup-note', error.message)); } }
  }
  $('service-number').setAttribute('aria-controls', 'flight-results');
  $('service-number').addEventListener('input', () => { clearFlightLookup(); flightTimer = setTimeout(searchFlight, 500); });
  $('service-number').addEventListener('keydown', event => { if (event.key === 'ArrowDown' && !$('flight-results').hidden) { event.preventDefault(); $('flight-results').querySelector('button')?.focus(); } });
  for (const field of ['mode', 'departure_date']) $('transport-form').elements[field].addEventListener('change', searchFlight);
  $('transport-dialog').addEventListener('close', clearFlightLookup);

  function moveDayPlan(item, direction) {
    const next = stepPlan(state.trip, item.id, direction);
    if (next === state.trip) return;
    const content = $('day-content'), previous = capturePlanningLayout(content), scrollTop = content.scrollTop;
    commit(next);
    content.scrollTop = scrollTop;
    animatePlanningLayout(content, previous);
    const row = [...content.querySelectorAll('[data-item-id]')].find(element => element.dataset.itemId === item.id);
    const buttons = [...(row?.querySelectorAll('.day-reorder button') || [])];
    (buttons.find(button => button.dataset.reorder === direction && !button.disabled) || buttons.find(button => !button.disabled))?.focus({ preventScroll: true });
  }

  function planRow(item, detailed = false) {
    const row = node('div', detailed ? 'day-place-card' : 'place-item timeline-item'); row.dataset.kind = item.kind || 'Activity'; row.dataset.itemId = item.id; row.dataset.placeId = item.placeId || ''; row.draggable = false;
    const head = node('div', detailed ? 'day-card-heading' : 'timeline-row');
    const marker = node('span', 'place-marker'); marker.append(placeSymbol(item)); marker.setAttribute('aria-hidden', 'true');
    const copy = action('', () => { if (mappedPlace(item)) focusPlace(item); openPlan(item); }, 'place-copy'); copy.setAttribute('aria-label', `Open ${item.name}`); copy.append(node('strong', '', item.name));
    if (!detailed && item.booked) copy.append(node('small', '', 'Confirmed'));
    if (!detailed && item.placeId) { const rating = node('span', 'timeline-rating'); copy.append(rating); hydratePlace(rating, item, { compact: true }); }
    if (item.time) head.append(node('span', 'timeline-time', formatClock(item.time)));
    head.append(marker, copy);
    if (fixedItem(item)) { const lock = node('span', 'fixed-indicator'); lock.innerHTML = icon('lock'); lock.setAttribute('aria-label', 'Fixed plan'); head.append(lock); }
    else if (detailed) {
      const flexible = (state.trip.items || []).filter(entry => entry.day === item.day && !fixedItem(entry));
      const index = flexible.findIndex(entry => entry.id === item.id);
      const controls = node('div', 'day-reorder'); controls.setAttribute('role', 'group'); controls.setAttribute('aria-label', `Reorder ${item.name}`);
      for (const direction of ['up', 'down']) {
        const button = action('', () => moveDayPlan(item, direction), 'day-reorder-button');
        button.dataset.reorder = direction; button.innerHTML = icon('chevron');
        button.setAttribute('aria-label', `Move ${item.name} ${direction}`); button.title = `Move ${direction}`;
        button.disabled = direction === 'up' ? index === 0 : index === flexible.length - 1;
        controls.append(button);
      }
      head.append(controls);
    }
    row.append(head);
    if (!fixedItem(item)) {
      const handle = action('', () => {}, 'mobile-drag-handle');
      handle.innerHTML = icon('grip'); handle.setAttribute('aria-label', `Drag ${item.name}`); handle.title = 'Drag to move';
      row.append(handle);
    }
    if (detailed && item.kind === 'Tour' && item.tour) {
      row.append(node('p', 'tour-itinerary-summary', [tourSummary(item.tour), tourEndLabel(item)].filter(Boolean).join(' · ')));
      row.append(node('p', 'tour-itinerary-status', item.booked ? 'Confirmed with operator' : 'Not booked'));
      if (!item.placeId) row.append(node('p', 'tour-meeting-status', 'Meeting point not set'));
    }
    if (detailed) {
      const detail = node('div', 'place-details day-card-details'); row.append(detail);
      if (item.placeId) hydratePlace(detail, item.kind === 'Tour' ? { ...item, name: item.tour?.meetingName || item.name } : item);
      else if (item.address) detail.append(node('p', 'place-address', item.address));
      if (item.notes) row.append(node('p', 'day-card-note', item.notes));
      if (item.reference) row.append(node('p', 'booking-reference', `Booking · ${item.reference}`));

    }
    if (!fixedItem(item)) {
      row.dataset.flexible = 'true';
    }
    return row;
  }

  function transportRow(segment, leg) {
    const row = action('', () => openTransport(segment), 'compact-service timeline-item');
    row.dataset.motionKey = `transport:${segment.id}:${leg || 'departure'}`;
    const symbol = node('span', 'place-marker'); symbol.innerHTML = icon(segment.mode === 'Flight' ? 'plane' : 'train');
    const copy = node('span', 'place-copy'); copy.append(node('strong', '', segment.service_id), node('small', '', `${segment.departure_location} – ${segment.arrival_location}`));
    const time = segment[`${leg || 'departure'}_time`]?.slice(0, 5);
    row.append(node('span', 'timeline-time', formatClock(time)), symbol, copy); return row;
  }

  function transportCard(segment, leg) {
    const card = action('', () => openTransport(segment), 'transport-card'); card.setAttribute('aria-label', `Edit ${segment.mode} ${segment.service_id}${leg ? `, ${leg}` : ''}`);
    card.dataset.motionKey = `transport:${segment.id}:${leg || 'departure'}`;
    const heading = node('span', 'transport-card-heading'); heading.innerHTML = icon(segment.mode === 'Flight' ? 'plane' : 'train'); heading.append(node('strong', '', segment.service_id), node('small', '', segment.flightData?.airline || '')); card.append(heading);
    const legs = node('span', 'transport-card-legs');
    for (const key of ['departure', 'arrival']) {
      const detail = node('span', 'transport-leg'); detail.append(node('small', '', `${key === 'departure' ? 'Departs' : 'Arrives'} · ${format(segment[`${key}_date`], { month: 'short', day: 'numeric' })}`), node('strong', '', formatClock(segment[`${key}_time`])), node('span', '', segment[`${key}_location`]), node('small', '', segment[`${key}_time_zone`].replaceAll('_', ' '))); legs.append(detail);
    }
    card.append(legs);
    if (segment.flightData) {
      const data = segment.flightData, metadata = node('span', 'flight-metadata');
      if (data.status) metadata.append(node('span', '', data.status));
      for (const key of ['departure_terminal', 'departure_gate', 'arrival_terminal', 'arrival_gate']) if (data[key]) metadata.append(node('span', '', `${key.replace('_', ' ')} ${data[key]}`));
      if (data.fetchedAt) metadata.append(node('span', '', `Checked ${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(data.fetchedAt))}`));
      card.append(metadata);
    }
    if (segment.notes) card.append(node('span', 'transport-notes', segment.notes)); return card;
  }

  function daySection(day, selected = false) {
    const section = node('section', `itinerary-day${selected ? ' selected-day' : ''}`); section.dataset.day = day;
    const heading = node('div', 'itinerary-day-heading');
    heading.dataset.motionKey = `heading:${day}`;
    heading.append(selected ? node('h3', 'day-heading-title', format(day, { weekday: 'long', month: 'short', day: 'numeric' })) : action(format(day, { weekday: 'long', month: 'short', day: 'numeric' }), () => chooseDay(day, 'day'), 'day-heading-button'));
    section.append(heading);
    const events = eventsForDay(state.trip, day);
    if (tripStops(state.trip).length > 1) {
      const stop = destinationForDay(state.trip, tripStops(state.trip), day);
      const stays = stopSchedule(state.trip).filter(entry => entry.start && entry.start <= day && entry.end >= day);
      const destination = node('span', 'day-destination');
      for (const [index, entry] of stays.entries()) { if (index) destination.insertAdjacentHTML('beforeend', icon('arrow')); destination.append(node('span', '', entry.stop.name)); }
      if (!stays.length) destination.textContent = 'Travel day';
      destination.dataset.motionKey = `destination:${day}:${stop?.placeId || 'travel'}`;
      heading.append(destination);
    }
    if (!events.length) { const empty = action('Find something to do', () => findPlaces(day), 'open-day'); empty.dataset.motionKey = `empty:${day}`; section.append(empty); }
    for (const event of events) section.append(event.kind === 'activity' ? planRow(event.item, selected) : selected ? transportCard(event.transport, event.leg) : transportRow(event.transport, event.leg));
    if (selected && events.length) { const add = action('Add a place', () => findPlaces(day), 'open-day'); add.dataset.motionKey = `add:${day}`; section.append(add); }
    return section;
  }

  function openDayPreview(day, anchor) {
    if (!datesForTrip(state.trip).includes(day)) return;
    const dialog = $('day-preview'); previewDay = day; previewAnchor = anchor; closingPreview = false;
    const source = anchor.getBoundingClientRect();
    document.querySelectorAll('.peeked-day').forEach(cell => cell.classList.remove('peeked-day'));
    anchor.classList.add('peeked-day'); anchor.setAttribute('aria-expanded', 'true');
    $('day-preview-title').textContent = format(day, { weekday: 'long', month: 'short', day: 'numeric' });
    $('day-preview-month').textContent = format(day, { month: 'short' }); $('day-preview-number').textContent = String(Number(day.slice(-2)));
    const stop = destinationForDay(state.trip, tripStops(state.trip), day);
    const events = eventsForDay(state.trip, day);
    $('day-preview-context').textContent = tripStops(state.trip).length > 1 ? stop?.name || '' : '';
    $('day-preview-context').hidden = !$('day-preview-context').textContent;
    const body = $('day-preview-events'); body.replaceChildren();
    for (const event of events) {
      const item = event.kind === 'transport' ? event.transport : event.item;
      const kind = event.kind === 'transport' ? item.mode : item.kind || 'Activity';
      const row = node('div', 'preview-event'); row.dataset.kind = kind;
      const marker = node('span', 'place-marker'); marker.append(placeSymbol({ ...item, kind }));
      const copy = node('div', 'preview-event-copy'); copy.append(node('strong', '', event.kind === 'transport' ? item.service_id : item.name));
      if (event.kind === 'transport') {
        copy.append(node('p', 'preview-route', `${item.departure_location} – ${item.arrival_location}`));
        for (const leg of ['departure', 'arrival']) copy.append(node('small', 'preview-leg', `${leg === 'departure' ? 'Departs' : 'Arrives'} ${format(item[`${leg}_date`], { month: 'short', day: 'numeric' })} · ${formatClock(item[`${leg}_time`])} · ${item[`${leg}_time_zone`].replaceAll('_', ' ')}`));
      } else {
        if (item.address) copy.append(node('p', 'preview-address', item.address));
        if (item.notes) copy.append(node('p', 'preview-note', item.notes));
        if (item.booked) { const confirmed = node('small', 'preview-confirmed', item.reference ? `Confirmed · ${item.reference}` : 'Confirmed'); copy.append(confirmed); }
      }
      const time = event.kind === 'transport' ? item[`${event.leg}_time`]?.slice(0,5) : item.time;
      row.append(marker, copy); if (time) row.append(node('span', 'preview-event-time', formatClock(time))); body.append(row);
    }
    if (!events.length) { const empty = node('div', 'preview-empty'); empty.innerHTML = icon('map'); empty.append(node('span', '', 'Nothing planned yet')); body.append(empty); }
    dialog.style.left = '0px'; dialog.style.top = '0px'; dialog.showModal();
    const target = dialog.getBoundingClientRect();
    dialog.style.left = `${Math.max(16, Math.min(innerWidth - target.width - 16, source.left + source.width / 2 - target.width / 2))}px`;
    dialog.style.top = `${Math.max(16, Math.min(innerHeight - target.height - 16, source.top - 30))}px`;
    morphFrom(dialog, source); revealSequence(body.children, { delay: 130, step: 40 });
    $('open-preview-day').focus({ preventScroll: true });
  }
  function clearPreview() {
    previewAnchor?.classList.remove('peeked-day'); previewAnchor?.setAttribute('aria-expanded', 'false');
    previewDay = null; previewAnchor = null; closingPreview = false;
  }
  async function closeDayPreview() {
    const dialog = $('day-preview'); if (!dialog.open || closingPreview) return;
    closingPreview = true;
    const frames = previewAnchor?.isConnected ? morphFrames(previewAnchor.getBoundingClientRect(), dialog.getBoundingClientRect()) : null;
    const animation = frames ? playMotion(dialog, [...frames].reverse().map(frame => ({ ...frame, offset: 1 - frame.offset })), { duration: 220 }) : null;
    if (animation) await animation.finished.catch(() => {});
    dialog.close(); clearPreview();
  }
  $('close-day-preview').addEventListener('click', closeDayPreview);
  $('day-preview').addEventListener('cancel', event => { event.preventDefault(); closeDayPreview(); });
  $('day-preview').addEventListener('click', event => { if (event.target === $('day-preview')) { const rect = event.target.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeDayPreview(); } });
  $('day-preview').addEventListener('close', () => { if (!$('day-preview').open) clearPreview(); });
  $('open-preview-day').addEventListener('click', () => {
    if (!previewDay || closingPreview) return;
    const day = previewDay, source = $('day-preview').getBoundingClientRect(); $('day-preview').close(); clearPreview();
    chooseDay(day, 'day'); morphFrom($('plan-panel'), source, { duration: 440 });
    const heading = $('day-content').querySelector('h3'); if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  });

  function render() {
    if (pendingRemoval && pendingRemoval.tripId !== state.trip?.id) clearRemoval();
    if (!state.trip) return;
    const allDays = datesForTrip(state.trip), days = state.stopFilter ? datesForStop(state.trip, state.stopFilter) : allDays;
    onModeChange?.(state.planMode);
    if (!days.includes(state.day)) state.day = days[0] || 'ideas';
    for (const button of document.querySelectorAll('[data-plan-mode]')) button.setAttribute('aria-pressed', String(button.dataset.planMode === state.planMode));
    const tabs = $('day-tabs'), tabsScroll = tabs.scrollLeft, restoreTabFocus = tabs.contains(document.activeElement);
    tabs.replaceChildren(); tabs.hidden = state.planMode !== 'day';
    for (const day of days) {
      const button = action('', () => chooseDay(day), 'day-tab'); button.setAttribute('role', 'tab'); button.setAttribute('aria-selected', String(state.day === day));
      button.append(node('span', '', format(day, { weekday: 'short' })), node('strong', '', format(day, { month: 'short', day: 'numeric' })));
      button.dataset.day = day; tabs.append(button);
    }
    tabs.scrollLeft = tabsScroll;
    const activeDay = tabs.querySelector('[aria-selected="true"]');
    if (activeDay && !tabs.hidden) {
      tabs.style.setProperty('--day-pill-x', `${activeDay.offsetLeft}px`);
      tabs.style.setProperty('--day-pill-width', `${activeDay.offsetWidth}px`);
      tabs.style.setProperty('--day-pill-height', `${activeDay.offsetHeight}px`);
      if (restoreTabFocus) activeDay.focus({ preventScroll: true });
    }
    dayOptions($('explore-day'), state.day); $('explore-day').disabled = !days.length; $('add-to-day-label').textContent = '';
    const count = (state.trip.items || []).length + (state.trip.transport || []).length;
    $('place-count').textContent = `${count} ${count === 1 ? 'plan' : 'plans'}`;
    const content = $('day-content'); const previousMode = content.dataset.mode;
    const animateDay = dayMotion.prepare({ trip: state.trip.id, mode: state.planMode, day: state.day });
    content.replaceChildren(); content.dataset.mode = state.planMode;

    if (!allDays.length) { content.append(action('Choose your dates', chooseDates, 'open-day')); for (const item of state.trip.items || []) content.append(planRow(item)); }
    else if (!days.length) content.append(action('Set stop dates', editStopDates, 'open-day'));
    if (state.planMode === 'calendar' && days.length) {
      const months = monthsForTrip(state.trip);
      if (displayedTrip !== state.trip.id) { displayedMonth = null; displayedTrip = state.trip.id; }
      const keyFor = month => month.key;
      let monthIndex = months.findIndex(month => keyFor(month) === displayedMonth);
      if (monthIndex < 0) monthIndex = Math.max(0, months.findIndex(month => month.cells.includes(state.day)));
      const month = months[monthIndex]; displayedMonth = keyFor(month);
      const section = node('section', 'itinerary-month'); section.setAttribute('aria-label', month.label);
      const toolbar = node('div', 'month-toolbar'); toolbar.append(node('h3', '', month.label));
      if (months.length > 1) {
        const controls = node('div', 'month-controls');
        for (const [direction, label] of [[-1, 'Previous month'], [1, 'Next month']]) {
          const button = action('', () => { displayedMonth = keyFor(months[monthIndex + direction]); render(); }, 'month-nav');
          button.innerHTML = icon(direction < 0 ? 'back' : 'arrow'); button.setAttribute('aria-label', label); button.disabled = !months[monthIndex + direction]; controls.append(button);
        }
        toolbar.append(controls);
      }
      section.append(toolbar);
      const grid = node('div', 'itinerary-calendar');
      for (const day of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) grid.append(node('span', 'calendar-weekday', day));
      const displayCells = calendarDisplayCells(month); grid.style.setProperty('--weeks', String(displayCells.length / 7)); const visibleEventLimit = displayCells.length > 21 ? 1 : 2; grid.classList.toggle('dense-calendar', visibleEventLimit === 1);
      const now = new Date(), today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      for (const display of displayCells) {
        if (!display) { const blank = node('span', 'calendar-blank'); blank.setAttribute('aria-hidden', 'true'); grid.append(blank); continue; }
        const { date } = display; const inTrip = display.inTrip && days.includes(date);
        if (!inTrip) { const outside = node('div', `itinerary-cell outside-trip${date === today ? ' today' : ''}`); outside.dataset.day = date; if (date === today) outside.setAttribute('aria-current', 'date'); outside.append(node('span', 'calendar-outside-date', String(Number(date.slice(-2))))); grid.append(outside); continue; }
        const events = eventsForDay(state.trip, date);
        const cell = action('', () => openDayPreview(date, cell), `itinerary-cell${state.day === date ? ' active-day' : ''}${date === today ? ' today' : ''}`); cell.dataset.day = date; if (date === today) cell.setAttribute('aria-current', 'date'); cell.setAttribute('aria-haspopup', 'dialog'); cell.setAttribute('aria-expanded', 'false'); cell.setAttribute('aria-label', `Preview ${format(date)}, ${events.length} ${events.length === 1 ? 'plan' : 'plans'}`);
        const heading = node('div', 'calendar-cell-head');
        const dateNumber = node('span', 'calendar-date-button', String(Number(date.slice(-2)))); heading.append(dateNumber);
        if (events.length) heading.append(node('span', 'calendar-event-count', String(events.length)));
        cell.append(heading);
        if (tripStops(state.trip).length > 1) { const destination = destinationForDay(state.trip, tripStops(state.trip), date); if (destination) { const label = node('span', 'calendar-destination', destination.name); label.title = destination.name; cell.append(label); } }
        for (const event of events.slice(0, visibleEventLimit)) {
          const item = event.kind === 'transport' ? event.transport : event.item;
          const label = node('span', 'calendar-event'); label.dataset.kind = event.kind === 'transport' ? item.mode : item.kind || 'Activity';
          const name = event.kind === 'transport' ? item.service_id : item.name;
          label.append(placeSymbol(event.kind === 'transport' ? { ...item, kind: item.mode } : item));
          label.append(node('span', '', name)); label.title = name; cell.append(label);
        }
        if (events.length > visibleEventLimit) cell.append(node('span', 'calendar-more', `+${events.length - visibleEventLimit}`));

        grid.append(cell);
      }
      section.append(grid); content.append(section);

    } else if (state.planMode === 'day' && days.length) content.append(daySection(state.day, true));
    else for (const day of days) content.append(daySection(day));
    renderTransport();
    const selectedMode = [...document.querySelectorAll('[data-plan-mode]')].find(button => button.dataset.planMode === state.planMode);
    if (selectedMode) { const toggle = selectedMode.parentElement; toggle.style.setProperty('--pill-x', `${selectedMode.offsetLeft}px`); toggle.style.setProperty('--pill-width', `${selectedMode.offsetWidth}px`); }
    if (previousMode !== state.planMode) revealSequence(content.children, { step: 55 });
    onRendered?.();
    animateDay();
  }

  function renderTransport() {
    const content = $('transport-content'); content.replaceChildren();
    const scopeDays = state.stopFilter ? datesForStop(state.trip, state.stopFilter) : null;
    const segments = [...(state.trip.transport || [])].filter(segment => !scopeDays || scopeDays.includes(segment.departure_date) || scopeDays.includes(segment.arrival_date)).sort((a, b) => `${a.departure_date}${a.departure_time}`.localeCompare(`${b.departure_date}${b.departure_time}`));
    if (!segments.length) content.append(action(datesForTrip(state.trip).length ? 'Add a flight or train' : 'Choose trip dates', () => openTransport(), 'open-day'));
    for (const segment of segments) content.append(transportCard(segment));
  }

  $('add-plan').addEventListener('click', () => openPlan()); $('add-transport').addEventListener('click', () => openTransport());
  $('explore-day').addEventListener('change', event => { chooseDay(event.target.value); });
  for (const button of document.querySelectorAll('[data-plan-mode]')) button.addEventListener('click', () => { state.planMode = button.dataset.planMode; if (state.planMode === 'calendar' && state.day === 'ideas') state.day = datesForTrip(state.trip)[0] || 'ideas'; render(); });
  for (const button of document.querySelectorAll('[data-close-dialog]')) button.addEventListener('click', () => button.closest('dialog').close());
  for (const dialog of document.querySelectorAll('.editor-dialog')) dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
  $('plan-done').addEventListener('click', () => savePlanPatch({}, true));
  $('duplicate-plan').addEventListener('click', () => { if (!duplicatingPlan && $('plan-error').textContent) return; duplicatingPlan = !duplicatingPlan; $('plan-error').textContent = ''; renderPlanTools(); if (duplicatingPlan) $('plan-day-chips').querySelector('button:not(:disabled)')?.focus({ preventScroll: true }); });
  $('plan-name').addEventListener('change', () => savePlanPatch());
  for (const [button, panel] of [['plan-time-button', 'plan-time-controls'], ['plan-note-button', 'plan-note-wrap']]) $(button).setAttribute('aria-controls', panel);
  $('plan-time-button').addEventListener('click', () => { const open = !panelIsOpen($('plan-time-controls')); $('plan-time-button').setAttribute('aria-expanded', String(open)); setPanelOpen($('plan-time-controls'), open, { onComplete: () => { if (open) revealPhoneSection($('plan-time-controls')); } }); });
  $('plan-time').addEventListener('change', event => savePlanPatch({ time: event.target.value }));
  $('plan-zone').addEventListener('change', () => savePlanPatch());
  $('plan-time-clear').addEventListener('click', () => { $('plan-time').value = ''; refreshTimePickers($('plan-time')); savePlanPatch({ time: '' }); $('plan-time-button').setAttribute('aria-expanded', 'false'); $('plan-time-button').focus({ preventScroll: true }); setPanelOpen($('plan-time-controls'), false); });
  $('plan-booked').addEventListener('click', () => savePlanPatch({ booked: !draft.booked }));
  $('plan-location-button').addEventListener('click', () => { $('plan-location-picker').hidden = !$('plan-location-picker').hidden; if (!$('plan-location-picker').hidden) $('plan-location-search').focus(); });
  $('plan-note-button').addEventListener('click', () => { const open = !panelIsOpen($('plan-note-wrap')); $('plan-note-button').setAttribute('aria-expanded', String(open)); setPanelOpen($('plan-note-wrap'), open, { onComplete: () => { if (open) revealPhoneSection($('plan-note-wrap')); } }); if (open) $('plan-notes').focus({ preventScroll: true }); });
  $('plan-notes').addEventListener('change', event => savePlanPatch({ notes: event.target.value }));
  $('plan-reference').addEventListener('change', event => savePlanPatch({ reference: event.target.value }));
  $('plan-type-button').addEventListener('click', () => { $('plan-type-choices').hidden = !$('plan-type-choices').hidden; revealPhoneSection($('plan-type-choices')); });
  for (const kind of ['Activity', 'Food', 'Stay', 'Transport']) {
    $('plan-type-choices').append(action(kind, () => { savePlanPatch({ kind }); $('plan-type-choices').hidden = true; }, 'detail-chip'));
  }
  $('transport-form').addEventListener('submit', event => {
    event.preventDefault();
    try { const segment = makeTransport(state.trip, Object.fromEntries(new FormData(event.currentTarget)), editingTransport?.id); if (sameFlightDetails(segment, selectedFlight)) segment.flightData = selectedFlight; commit(upsertTransport(state.trip, segment)); chooseDay(segment.departure_date); $('transport-dialog').close(); }
    catch (error) { $('transport-error').textContent = error.message; }
  });
  for (const [id, collection, current] of [['delete-plan', 'items', () => editingPlan], ['delete-transport', 'transport', () => editingTransport]]) {
    $(id).addEventListener('click', event => {
      try {
        const removed = removeItineraryEvent(state.trip, collection, current()?.id);
        commit(removed.trip); event.currentTarget.closest('dialog').close(); showRemoval(removed.removal);
      } catch (error) { $(id === 'delete-plan' ? 'plan-error' : 'transport-error').textContent = error.message; }
    });
  }
  const zones = ['UTC', ...Intl.supportedValuesOf('timeZone')];
  for (const zone of zones) { const option = node('option'); option.value = zone; $('time-zones').append(option); }
  createPlanningDrag({ root: $('day-content'), tabs: $('day-tabs'), getTrip: () => state.trip, commit, onDrop: day => chooseDay(day) });
  function attachPlace(place) {
    if (!draft) return;
    if (!$('plan-name').value.trim()) $('plan-name').value = place.name;
    savePlanPatch({ ...place, ...(draft.kind === 'Tour' ? { tour: { ...draft.tour, meetingName: place.name.slice(0, 160) } } : {}) }); $('plan-location-picker').hidden = true; $('plan-error').textContent = '';
    hydratePlace($('plan-place-details'), place);
  }
  return { render, openPlan, openTour, openTransport, clearRemoval, attachPlace, selectItem(item) { chooseDay(item.day, 'day'); const row = [...$('day-content').querySelectorAll('[data-item-id]')].find(element => element.dataset.itemId === item.id); row?.classList.add('selected'); row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } };
}
