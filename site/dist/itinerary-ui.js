import { playMotion, morphFrom, morphFrames, revealSequence } from './motion.js';
import { datesForTrip, monthsForTrip, calendarDisplayCells, eventsForDay, fixedItem, mappedPlace, makePlan, makeTransport, upsertTransport, reorderPlan } from './itinerary-model.js';
import { destinationForDay } from './place-model.js';
import { movePlace, removePlace, tripStops } from './trip-store.js';
import { normalizeFlightNumber, sameFlightDetails } from './flight-model.js';
import { createPlanningDrag } from './planning-drag.js';

const $ = id => document.getElementById(id);
const format = (date, options = { weekday: 'short', month: 'short', day: 'numeric' }) => new Intl.DateTimeFormat('en', { ...options, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const node = (tag, className, text) => { const element = document.createElement(tag); if (className) element.className = className; if (text !== undefined) element.textContent = text; return element; };
const action = (label, callback, className = 'quiet-action') => { const button = node('button', className, label); button.type = 'button'; button.addEventListener('click', callback); return button; };

export function createItineraryUI({ state, commit, explore, chooseDates, focusPlace, hydratePlace, onDayChange, onModeChange, icon }) {
  let editingPlan = null, editingTransport = null, selectedFlight = null, flightTimer = 0, flightRequest = null, draft = null, displayedMonth = null, displayedTrip = null, previewDay = null, previewAnchor = null, closingPreview = false;
  const defaultZone = () => state.selected?.timeZone || state.trip?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const dayOptions = (select, selected, ideas = false) => {
    select.replaceChildren();
    for (const day of [...datesForTrip(state.trip), ...(ideas ? ['ideas'] : [])]) {
      const option = node('option', '', day === 'ideas' ? 'Choose dates' : format(day)); option.value = day; select.append(option);
    }
    if ([...select.options].some(option => option.value === selected)) select.value = selected;
  };
  const chooseDay = (day, mode) => { state.day = day; if (mode) state.planMode = mode; render(); onDayChange?.(day); };
  const findPlaces = day => { chooseDay(day); explore(); };

  function savePlanPatch(patch = {}, close = false) {
    draft = { ...draft, ...patch, name: $('plan-name').value.trim(), timeZone: $('plan-zone').value || defaultZone() };
    if (!editingPlan && !close) { renderPlanTools(); return; }
    try {
      const item = makePlan(state.trip, draft, editingPlan), items = state.trip.items || [];
      commit({ ...state.trip, items: items.some(entry => entry.id === item.id) ? items.map(entry => entry.id === item.id ? item : entry) : [...items, item] });
      editingPlan = item; draft = { ...item }; state.day = item.day; render();
      $('plan-error').textContent = ''; renderPlanTools();
      if (close) $('plan-dialog').close();
    } catch (error) { $('plan-error').textContent = error.message; }
  }

  function renderPlanTools() {
    $('plan-time-button').textContent = draft.time || 'Any time';
    $('plan-booked').setAttribute('aria-pressed', String(Boolean(draft.booked)));
    $('plan-booked').textContent = draft.booked ? 'Confirmed' : 'Reservation';
    $('plan-reference-wrap').hidden = !draft.booked;
    $('plan-type-button').textContent = draft.kind;
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
    for (const day of datesForTrip(state.trip)) {
      const button = action(format(day, { month: 'short', day: 'numeric' }), () => savePlanPatch({ day }), 'detail-chip');
      button.setAttribute('aria-pressed', String(draft.day === day)); chips.append(button);
    }
  }

  function openPlan(item = null, day = state.day) {
    const days = datesForTrip(state.trip);
    if (!days.length) { chooseDates(); return; }
    editingPlan = item;
    draft = { name: '', day: days.includes(day) ? day : days[0], kind: 'Activity', time: '', timeZone: defaultZone(), notes: '', reference: '', ...item };
    $('plan-name').value = draft.name;
    $('plan-zone').value = draft.timeZone;
    $('plan-time').value = draft.time || '';
    $('plan-notes').value = draft.notes || ''; $('plan-reference').value = draft.reference || '';
    $('plan-location-picker').hidden = true; $('plan-location-search').value = ''; $('plan-location-suggestions').hidden = true;
    $('plan-note-wrap').hidden = !draft.notes; $('plan-time-controls').hidden = true; $('plan-type-choices').hidden = true;
    $('delete-plan').hidden = !item; $('delete-plan').textContent = 'Remove'; $('delete-plan').dataset.confirm = '';
    $('plan-error').textContent = ''; renderPlanTools();
    const details = $('plan-place-details'); details.replaceChildren();
    if (item?.placeId) hydratePlace(details, item);
    $('plan-done').textContent = item ? 'Done' : 'Add plan';
    $('plan-dialog').showModal();
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
    $('delete-transport').hidden = !segment; $('delete-transport').textContent = 'Remove'; $('delete-transport').dataset.confirm = '';
    $('transport-error').textContent = ''; $('transport-dialog').showModal(); form.elements.service_id.focus();
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
          form.querySelector('[type="submit"]').focus({ preventScroll: true });
        }, 'flight-choice');
        button.append(node('strong', '', `${flight.service_id} · ${flight.departure_code || flight.departure_location} → ${flight.arrival_code || flight.arrival_location}`), node('span', '', `${flight.departure_time} – ${flight.arrival_time} · ${flight.airline || flight.status}`));
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

  function planRow(item, detailed = false) {
    const row = node('div', detailed ? 'day-place-card' : 'place-item timeline-item'); row.dataset.kind = item.kind || 'Activity'; row.dataset.itemId = item.id; row.dataset.placeId = item.placeId || ''; row.draggable = false;
    const iconName = item.kind === 'Flight' ? 'plane' : item.kind === 'Train' ? 'train' : item.kind === 'Food' ? 'food' : item.kind === 'Stay' ? 'stay' : 'pin';
    const head = node('div', detailed ? 'day-card-heading' : 'timeline-row');
    const marker = node('span', 'place-marker'); marker.innerHTML = icon(iconName); marker.setAttribute('aria-hidden', 'true');
    const copy = action('', () => { if (mappedPlace(item)) focusPlace(item); openPlan(item); }, 'place-copy'); copy.setAttribute('aria-label', `Open ${item.name}`); copy.append(node('strong', '', item.name));
    if (!detailed && item.booked) copy.append(node('small', '', 'Confirmed'));
    if (item.time) head.append(node('span', 'timeline-time', item.time));
    head.append(marker, copy);
    if (fixedItem(item)) { const lock = node('span', 'fixed-indicator'); lock.innerHTML = icon('lock'); lock.setAttribute('aria-label', 'Fixed plan'); head.append(lock); }
    row.append(head);
    if (detailed) {
      const detail = node('div', 'place-details day-card-details'); row.append(detail);
      if (item.placeId) hydratePlace(detail, item);
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
    const symbol = node('span', 'place-marker'); symbol.innerHTML = icon(segment.mode === 'Flight' ? 'plane' : 'train');
    const copy = node('span', 'place-copy'); copy.append(node('strong', '', segment.service_id), node('small', '', `${segment.departure_location} – ${segment.arrival_location}`));
    const time = segment[`${leg || 'departure'}_time`]?.slice(0, 5);
    row.append(node('span', 'timeline-time', time || ''), symbol, copy); return row;
  }

  function transportCard(segment, leg) {
    const card = action('', () => openTransport(segment), 'transport-card'); card.setAttribute('aria-label', `Edit ${segment.mode} ${segment.service_id}${leg ? `, ${leg}` : ''}`);
    const heading = node('span', 'transport-card-heading'); heading.innerHTML = icon(segment.mode === 'Flight' ? 'plane' : 'train'); heading.append(node('strong', '', segment.service_id), node('small', '', segment.flightData?.airline || '')); card.append(heading);
    const legs = node('span', 'transport-card-legs');
    for (const key of ['departure', 'arrival']) {
      const detail = node('span', 'transport-leg'); detail.append(node('small', '', `${key === 'departure' ? 'Departs' : 'Arrives'} · ${format(segment[`${key}_date`], { month: 'short', day: 'numeric' })}`), node('strong', '', segment[`${key}_time`].slice(0, 5)), node('span', '', segment[`${key}_location`]), node('small', '', segment[`${key}_time_zone`].replaceAll('_', ' '))); legs.append(detail);
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
    heading.append(selected ? node('h3', 'day-heading-title', format(day, { weekday: 'long', month: 'short', day: 'numeric' })) : action(format(day, { weekday: 'long', month: 'short', day: 'numeric' }), () => chooseDay(day, 'day'), 'day-heading-button'));
    section.append(heading);
    const events = eventsForDay(state.trip, day);
    if (tripStops(state.trip).length > 1) for (const [index, stop] of tripStops(state.trip).entries()) if ((stop.date || (index === 0 ? state.trip.startDate : null)) === day) { const destination = node('div', 'day-destination'); destination.innerHTML = icon('pin'); destination.append(node('span', '', stop.name)); section.append(destination); }
    if (!events.length) section.append(action('Find something to do', () => findPlaces(day), 'open-day'));
    for (const event of events) section.append(event.kind === 'activity' ? planRow(event.item, selected) : selected ? transportCard(event.transport, event.leg) : transportRow(event.transport, event.leg));
    if (selected && events.length) section.append(action('Add a place', () => findPlaces(day), 'open-day'));
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
      const marker = node('span', 'place-marker'); marker.innerHTML = icon(kind === 'Flight' ? 'plane' : kind === 'Train' ? 'train' : kind === 'Food' ? 'food' : kind === 'Stay' ? 'stay' : 'pin');
      const copy = node('div', 'preview-event-copy'); copy.append(node('strong', '', event.kind === 'transport' ? item.service_id : item.name));
      if (event.kind === 'transport') {
        copy.append(node('p', 'preview-route', `${item.departure_location} – ${item.arrival_location}`));
        for (const leg of ['departure', 'arrival']) copy.append(node('small', 'preview-leg', `${leg === 'departure' ? 'Departs' : 'Arrives'} ${format(item[`${leg}_date`], { month: 'short', day: 'numeric' })} · ${item[`${leg}_time`].slice(0, 5)} · ${item[`${leg}_time_zone`].replaceAll('_', ' ')}`));
      } else {
        if (item.address) copy.append(node('p', 'preview-address', item.address));
        if (item.notes) copy.append(node('p', 'preview-note', item.notes));
        if (item.booked) { const confirmed = node('small', 'preview-confirmed', item.reference ? `Confirmed · ${item.reference}` : 'Confirmed'); copy.append(confirmed); }
      }
      const time = event.kind === 'transport' ? item[`${event.leg}_time`]?.slice(0,5) : item.time;
      row.append(marker, copy); if (time) row.append(node('span', 'preview-event-time', time)); body.append(row);
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
    if (!state.trip) return;
    const days = datesForTrip(state.trip);
    onModeChange?.(state.planMode);
    if (!days.includes(state.day)) state.day = days[0] || 'ideas';
    for (const button of document.querySelectorAll('[data-plan-mode]')) button.setAttribute('aria-pressed', String(button.dataset.planMode === state.planMode));
    const tabs = $('day-tabs'); tabs.replaceChildren(); tabs.hidden = state.planMode !== 'day';
    for (const day of days) {
      const button = action('', () => chooseDay(day), 'day-tab'); button.setAttribute('role', 'tab'); button.setAttribute('aria-selected', String(state.day === day));
      button.append(node('span', '', format(day, { weekday: 'short' })), node('strong', '', format(day, { month: 'short', day: 'numeric' })));
      button.dataset.day = day; tabs.append(button);
    }
    dayOptions($('explore-day'), state.day); $('explore-day').disabled = !days.length; $('add-to-day-label').textContent = '';
    const count = (state.trip.items || []).length + (state.trip.transport || []).length;
    $('place-count').textContent = `${count} ${count === 1 ? 'plan' : 'plans'}`;
    const content = $('day-content'); const previousMode = content.dataset.mode; content.replaceChildren(); content.dataset.mode = state.planMode;

    if (!days.length) { content.append(action('Choose your dates', chooseDates, 'open-day')); for (const item of state.trip.items || []) content.append(planRow(item)); }
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
      for (const display of displayCells) {
        if (!display) { const blank = node('span', 'calendar-blank'); blank.setAttribute('aria-hidden', 'true'); grid.append(blank); continue; }
        const { date, inTrip } = display;
        if (!inTrip) { const outside = node('div', 'itinerary-cell outside-trip'); outside.append(node('span', 'calendar-outside-date', String(Number(date.slice(-2))))); grid.append(outside); continue; }
        const events = eventsForDay(state.trip, date), stops = (state.trip.stops || []).filter((stop, index) => (stop.date || (index === 0 ? state.trip.startDate : null)) === date);
        const cell = action('', () => openDayPreview(date, cell), `itinerary-cell${state.day === date ? ' active-day' : ''}`); cell.dataset.day = date; cell.setAttribute('aria-haspopup', 'dialog'); cell.setAttribute('aria-expanded', 'false'); cell.setAttribute('aria-label', `Preview ${format(date)}, ${events.length} ${events.length === 1 ? 'plan' : 'plans'}`);
        const heading = node('div', 'calendar-cell-head');
        const dateNumber = node('span', 'calendar-date-button', String(Number(date.slice(-2)))); heading.append(dateNumber);
        if (events.length) heading.append(node('span', 'calendar-event-count', String(events.length)));
        cell.append(heading);
        if (tripStops(state.trip).length > 1 && stops.length) { const stop = node('span', 'calendar-stop-icon'); stop.innerHTML = icon('pin'); stop.title = stops[0].name; stop.setAttribute('aria-label', stops[0].name); heading.append(stop); }
        for (const event of events.slice(0, visibleEventLimit)) {
          const item = event.kind === 'transport' ? event.transport : event.item;
          const label = node('span', 'calendar-event'); label.dataset.kind = event.kind === 'transport' ? item.mode : item.kind || 'Activity';
          const name = event.kind === 'transport' ? item.service_id : item.name;
          label.innerHTML = icon(event.kind === 'transport' ? item.mode === 'Flight' ? 'plane' : 'train' : item.kind === 'Stay' ? 'stay' : item.kind === 'Food' ? 'food' : 'pin');
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
  }

  function renderTransport() {
    const content = $('transport-content'); content.replaceChildren();
    const segments = [...(state.trip.transport || [])].sort((a, b) => `${a.departure_date}${a.departure_time}`.localeCompare(`${b.departure_date}${b.departure_time}`));
    if (!segments.length) content.append(action(datesForTrip(state.trip).length ? 'Add a flight or train' : 'Choose trip dates', () => openTransport(), 'open-day'));
    for (const segment of segments) content.append(transportCard(segment));
  }

  $('add-plan').addEventListener('click', () => openPlan()); $('add-transport').addEventListener('click', () => openTransport());
  $('explore-day').addEventListener('change', event => { chooseDay(event.target.value); });
  for (const button of document.querySelectorAll('[data-plan-mode]')) button.addEventListener('click', () => { state.planMode = button.dataset.planMode; if (state.planMode === 'calendar' && state.day === 'ideas') state.day = datesForTrip(state.trip)[0] || 'ideas'; render(); });
  for (const button of document.querySelectorAll('[data-close-dialog]')) button.addEventListener('click', () => button.closest('dialog').close());
  for (const dialog of document.querySelectorAll('.editor-dialog')) dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
  $('plan-done').addEventListener('click', () => savePlanPatch({}, true));
  $('plan-name').addEventListener('change', () => savePlanPatch());
  $('plan-time-button').addEventListener('click', () => { $('plan-time-controls').hidden = !$('plan-time-controls').hidden; if (!$('plan-time-controls').hidden) $('plan-time').focus(); });
  $('plan-time').addEventListener('change', event => savePlanPatch({ time: event.target.value }));
  $('plan-zone').addEventListener('change', () => savePlanPatch());
  $('plan-time-clear').addEventListener('click', () => { $('plan-time').value = ''; savePlanPatch({ time: '' }); $('plan-time-controls').hidden = true; });
  $('plan-booked').addEventListener('click', () => savePlanPatch({ booked: !draft.booked }));
  $('plan-location-button').addEventListener('click', () => { $('plan-location-picker').hidden = !$('plan-location-picker').hidden; if (!$('plan-location-picker').hidden) $('plan-location-search').focus(); });
  $('plan-note-button').addEventListener('click', () => { $('plan-note-wrap').hidden = !$('plan-note-wrap').hidden; if (!$('plan-note-wrap').hidden) $('plan-notes').focus(); });
  $('plan-notes').addEventListener('change', event => savePlanPatch({ notes: event.target.value }));
  $('plan-reference').addEventListener('change', event => savePlanPatch({ reference: event.target.value }));
  $('plan-type-button').addEventListener('click', () => { $('plan-type-choices').hidden = !$('plan-type-choices').hidden; });
  for (const kind of ['Activity', 'Food', 'Stay', 'Transport']) {
    $('plan-type-choices').append(action(kind, () => { savePlanPatch({ kind }); $('plan-type-choices').hidden = true; }, 'detail-chip'));
  }
  $('transport-form').addEventListener('submit', event => {
    event.preventDefault();
    try { const segment = makeTransport(state.trip, Object.fromEntries(new FormData(event.currentTarget)), editingTransport?.id); if (sameFlightDetails(segment, selectedFlight)) segment.flightData = selectedFlight; commit(upsertTransport(state.trip, segment)); chooseDay(segment.departure_date); $('transport-dialog').close(); }
    catch (error) { $('transport-error').textContent = error.message; }
  });
  for (const [id, remove] of [['delete-plan', () => commit(removePlace(state.trip, editingPlan.id))], ['delete-transport', () => commit({ ...state.trip, transport: (state.trip.transport || []).filter(item => item.id !== editingTransport.id) })]]) {
    $(id).addEventListener('click', event => { const button = event.currentTarget; if (!button.dataset.confirm) { button.dataset.confirm = 'yes'; button.textContent = 'Confirm remove'; return; } try { remove(); button.closest('dialog').close(); } catch (error) { $(id === 'delete-plan' ? 'plan-error' : 'transport-error').textContent = error.message; } });
  }
  const zones = ['UTC', ...Intl.supportedValuesOf('timeZone')];
  for (const zone of zones) { const option = node('option'); option.value = zone; $('time-zones').append(option); }
  createPlanningDrag({ root: $('day-content'), tabs: $('day-tabs'), getTrip: () => state.trip, commit, onDrop: day => chooseDay(day) });
  return { render, openPlan, openTransport, attachPlace(place) { if (!draft) return; if (!$('plan-name').value.trim()) $('plan-name').value = place.name; savePlanPatch(place); $('plan-location-picker').hidden = true; hydratePlace($('plan-place-details'), place); }, selectItem(item) { state.day = item.day; state.planMode = 'day'; render(); const row = [...$('day-content').querySelectorAll('[data-item-id]')].find(element => element.dataset.itemId === item.id); row?.classList.add('selected'); row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } };
}
