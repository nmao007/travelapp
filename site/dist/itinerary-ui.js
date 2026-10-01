import { datesForTrip, monthsForTrip, eventsForDay, fixedItem, mappedPlace, makePlan, makeTransport, upsertTransport, reorderPlan } from './itinerary-model.js';
import { movePlace, removePlace } from './trip-store.js';

const $ = id => document.getElementById(id);
const format = (date, options = { weekday: 'short', month: 'short', day: 'numeric' }) => new Intl.DateTimeFormat('en', { ...options, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const node = (tag, className, text) => { const element = document.createElement(tag); if (className) element.className = className; if (text !== undefined) element.textContent = text; return element; };
const action = (label, callback, className = 'quiet-action') => { const button = node('button', className, label); button.type = 'button'; button.addEventListener('click', callback); return button; };

export function createItineraryUI({ state, commit, explore, chooseDates, focusPlace, icon }) {
  let editingPlan = null, editingTransport = null;
  const defaultZone = () => state.selected?.timeZone || state.trip?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const dayOptions = (select, selected, ideas = true) => {
    select.replaceChildren();
    for (const day of [...datesForTrip(state.trip), ...(ideas ? ['ideas'] : [])]) {
      const option = node('option', '', day === 'ideas' ? 'Saved Ideas' : format(day)); option.value = day; select.append(option);
    }
    if ([...select.options].some(option => option.value === selected)) select.value = selected;
  };
  const chooseDay = (day, mode) => { state.day = day; if (mode) state.planMode = mode; render(); };
  const findPlaces = day => { chooseDay(day); explore(); $('place-search').focus(); };

  function openPlan(item = null, day = state.day) {
    editingPlan = item;
    const form = $('plan-form'); form.reset();
    $('plan-dialog-title').textContent = item ? 'EDIT PLAN' : 'ADD PLAN';
    dayOptions(form.elements.day, item?.day || day);
    for (const key of ['name', 'kind', 'time', 'timeZone', 'address', 'reference', 'notes']) form.elements[key].value = item?.[key] || (key === 'kind' ? 'Activity' : key === 'timeZone' ? defaultZone() : '');
    form.elements.booked.checked = Boolean(item?.booked);
    $('plan-details').open = Boolean(item?.time || item?.notes || item?.reference || item?.booked);
    $('delete-plan').hidden = !item; $('delete-plan').textContent = 'REMOVE PLAN'; $('delete-plan').dataset.confirm = '';
    $('plan-error').textContent = ''; $('plan-dialog').showModal(); form.elements.name.focus();
  }

  function openTransport(segment = null, day = state.day) {
    if (!datesForTrip(state.trip).length) { chooseDates(); return; }
    editingTransport = segment;
    const form = $('transport-form'); form.reset();
    form.dataset.version = String(Number(form.dataset.version || 0) + 1); form.dataset.pendingZones = '0'; form.querySelector('[type="submit"]').disabled = false;
    $('transport-dialog-title').textContent = segment ? 'EDIT FLIGHT / TRAIN' : 'ADD FLIGHT / TRAIN';
    for (const leg of ['departure', 'arrival']) {
      dayOptions(form.elements[`${leg}_date`], segment?.[`${leg}_date`] || day, false);
      form.elements[`${leg}_time_zone`].value = segment?.[`${leg}_time_zone`] || defaultZone();
      form.elements[`${leg}_location`].value = segment?.[`${leg}_location`] || '';
      form.elements[`${leg}_time`].value = segment?.[`${leg}_time`]?.slice(0, 5) || '';
      $(`${leg}-suggestions`).hidden = true;
    }
    form.elements.mode.value = segment?.mode || 'Flight'; form.elements.service_id.value = segment?.service_id || ''; form.elements.notes.value = segment?.notes || '';
    $('delete-transport').hidden = !segment; $('delete-transport').textContent = 'REMOVE SERVICE'; $('delete-transport').dataset.confirm = '';
    $('transport-error').textContent = ''; $('transport-dialog').showModal(); form.elements.service_id.focus();
  }

  function dropOn(element, day, targetId) {
    element.addEventListener('dragover', event => { if ([...event.dataTransfer.types].includes('text/plain')) { event.preventDefault(); element.classList.add('drop-target'); } });
    element.addEventListener('dragleave', () => element.classList.remove('drop-target'));
    element.addEventListener('drop', event => {
      event.preventDefault(); event.stopPropagation(); element.classList.remove('drop-target');
      const id = event.dataTransfer.getData('text/plain');
      const next = targetId ? reorderPlan(state.trip, id, targetId) : movePlace(state.trip, id, day);
      if (next !== state.trip) { commit(next); chooseDay(day); }
    });
  }

  function planRow(item) {
    const row = node('div', 'place-item timeline-item'); row.dataset.itemId = item.id; row.draggable = !fixedItem(item);
    const marker = action('', () => mappedPlace(item) ? focusPlace(item) : openPlan(item), 'place-marker'); marker.innerHTML = icon(item.kind === 'Flight' ? 'plane' : item.kind === 'Train' ? 'train' : 'pin'); marker.setAttribute('aria-label', mappedPlace(item) ? `Show ${item.name} on map` : `Edit ${item.name}`);
    const copy = action('', () => openPlan(item), 'place-copy'); copy.append(node('strong', '', item.name));
    const details = [item.time, item.booked ? 'Confirmed' : '', item.address].filter(Boolean); if (details.length) copy.append(node('small', '', details.join(' · ')));
    row.append(marker, copy);
    if (fixedItem(item)) { const lock = node('span', 'fixed-indicator'); lock.innerHTML = icon('lock'); lock.setAttribute('aria-label', 'Fixed plan; edit its details to change it'); row.append(lock); }
    else {
      const move = action('', () => {
        const previous = row.nextElementSibling;
        if (previous?.classList.contains('move-options')) { previous.remove(); return; }
        document.querySelectorAll('.move-options').forEach(element => element.remove());
        const choices = node('div', 'move-options');
        for (const day of [...datesForTrip(state.trip), 'ideas'].filter(day => day !== item.day)) choices.append(action(day === 'ideas' ? 'Saved Ideas' : format(day), () => { commit(movePlace(state.trip, item.id, day)); chooseDay(day); }));
        const flexible = (state.trip.items || []).filter(entry => entry.day === item.day && !fixedItem(entry));
        const index = flexible.findIndex(entry => entry.id === item.id);
        if (index > 0) choices.append(action('Move earlier', () => commit(reorderPlan(state.trip, item.id, flexible[index - 1].id))));
        if (index < flexible.length - 1) choices.append(action('Move later', () => commit(reorderPlan(state.trip, flexible[index + 1].id, item.id))));
        if (!choices.children.length) choices.append(action('Choose dates', chooseDates));
        row.after(choices);
      }, 'move-place'); move.innerHTML = icon('calendar'); move.setAttribute('aria-label', `Move ${item.name}`); row.append(move);
      row.addEventListener('dragstart', event => { event.dataTransfer.setData('text/plain', item.id); event.dataTransfer.effectAllowed = 'move'; row.classList.add('dragging'); });
      row.addEventListener('dragend', () => row.classList.remove('dragging')); dropOn(row, item.day, item.id);
    }
    const edit = action('', () => openPlan(item), 'edit-place'); edit.innerHTML = icon('edit'); edit.setAttribute('aria-label', `Edit ${item.name}`); row.append(edit);
    return row;
  }

  function transportCard(segment, leg) {
    const card = action('', () => openTransport(segment), 'transport-card'); card.setAttribute('aria-label', `Edit ${segment.mode} ${segment.service_id}${leg ? `, ${leg}` : ''}`);
    const heading = node('span', 'transport-card-heading'); heading.innerHTML = icon(segment.mode === 'Flight' ? 'plane' : 'train'); heading.append(node('strong', '', segment.service_id), node('small', '', leg ? leg.toUpperCase() : segment.mode.toUpperCase())); card.append(heading);
    const legs = node('span', 'transport-card-legs');
    for (const key of ['departure', 'arrival']) {
      const detail = node('span', 'transport-leg'); detail.append(node('small', '', `${key === 'departure' ? 'DEPART' : 'ARRIVE'} · ${format(segment[`${key}_date`], { month: 'short', day: 'numeric' })}`), node('strong', '', segment[`${key}_time`].slice(0, 5)), node('span', '', segment[`${key}_location`]), node('small', '', segment[`${key}_time_zone`].replaceAll('_', ' '))); legs.append(detail);
    }
    card.append(legs); if (segment.notes) card.append(node('span', 'transport-notes', segment.notes)); return card;
  }

  function daySection(day, selected = false) {
    const section = node('section', `itinerary-day${selected ? ' selected-day' : ''}`); section.dataset.day = day;
    const heading = node('div', 'itinerary-day-heading');
    heading.append(action(day === 'ideas' ? 'SAVED IDEAS' : format(day, { weekday: 'long', month: 'short', day: 'numeric' }), () => chooseDay(day, 'day'), 'day-heading-button'));
    const add = action('+', () => openPlan(null, day), 'small-action'); add.setAttribute('aria-label', day === 'ideas' ? 'Add saved idea' : `Add plan for ${format(day)}`); heading.append(add); section.append(heading);
    const events = day === 'ideas' ? (state.trip.items || []).filter(item => item.day === 'ideas').map(item => ({ kind: 'activity', item })) : eventsForDay(state.trip, day);
    for (const [index, stop] of (state.trip.stops || []).entries()) if ((stop.date || (index === 0 ? state.trip.startDate : null)) === day) section.append(node('div', 'day-destination', `⌖ ${stop.name}`));
    if (!events.length) section.append(action(day === 'ideas' ? 'FIND PLACES +' : 'OPEN DAY ↗', () => findPlaces(day), 'open-day'));
    for (const event of events) section.append(event.kind === 'activity' ? planRow(event.item) : transportCard(event.transport, event.leg));
    dropOn(section, day); return section;
  }

  function render() {
    if (!state.trip) return;
    const days = datesForTrip(state.trip);
    if (state.day !== 'ideas' && !days.includes(state.day)) state.day = days[0] || 'ideas';
    for (const button of document.querySelectorAll('[data-plan-mode]')) button.setAttribute('aria-pressed', String(button.dataset.planMode === state.planMode));
    const tabs = $('day-tabs'); tabs.replaceChildren(); tabs.hidden = state.planMode !== 'day';
    for (const day of [...days, 'ideas']) {
      const button = action('', () => chooseDay(day), 'day-tab'); button.setAttribute('role', 'tab'); button.setAttribute('aria-selected', String(state.day === day));
      button.append(node('span', '', day === 'ideas' ? 'Saved' : format(day, { weekday: 'short' })), node('strong', '', day === 'ideas' ? 'Ideas' : format(day, { month: 'short', day: 'numeric' })));
      dropOn(button, day); tabs.append(button);
    }
    dayOptions($('explore-day'), state.day); $('add-to-day-label').textContent = state.day === 'ideas' ? 'Saved Ideas' : format(state.day);
    const count = (state.trip.items || []).length + (state.trip.transport || []).length;
    $('place-count').textContent = `${count} ${count === 1 ? 'plan' : 'plans'}`;
    const content = $('day-content'); content.replaceChildren(); content.dataset.mode = state.planMode;
    if (!days.length && state.planMode !== 'day') content.append(action('CHOOSE DATES ↗', chooseDates, 'open-day'));
    if (state.planMode === 'calendar' && days.length) {
      for (const month of monthsForTrip(state.trip)) {
        const section = node('section', 'itinerary-month'); section.setAttribute('aria-label', month.label); section.append(node('h3', '', month.label));
        const grid = node('div', 'itinerary-calendar');
        for (const day of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) grid.append(node('span', 'calendar-weekday', day));
        for (const date of month.cells) {
          if (!date) { const blank = node('span', 'calendar-blank'); blank.setAttribute('aria-hidden', 'true'); grid.append(blank); continue; }
          const events = eventsForDay(state.trip, date), stops = (state.trip.stops || []).filter((stop, index) => (stop.date || (index === 0 ? state.trip.startDate : null)) === date);
          const cell = action('', () => chooseDay(date), 'itinerary-cell'); cell.setAttribute('aria-pressed', String(state.day === date)); cell.setAttribute('aria-label', `${format(date)}, ${events.length} plans${stops.length ? `, ${stops.length} destinations` : ''}`);
          cell.append(node('strong', 'calendar-date-number', String(Number(date.slice(-2)))));
          if (events.length) cell.append(node('small', 'calendar-event-count', `${events.length} ${events.length === 1 ? 'plan' : 'plans'}`));
          for (const event of events.slice(0, 2)) {
            const label = node('span', 'calendar-event');
            if (event.kind === 'transport') { label.innerHTML = icon(event.transport.mode === 'Flight' ? 'plane' : 'train'); label.append(node('span', '', event.transport.service_id)); }
            else label.textContent = event.item.name;
            cell.append(label);
          }
          if (stops.length) { const stop = node('span', 'calendar-event'); stop.innerHTML = icon('pin'); stop.append(node('span', '', stops[0].name)); cell.append(stop); }
          if (events.length > 2) cell.append(node('small', '', `+${events.length - 2}`));
          dropOn(cell, date); grid.append(cell);
        }
        section.append(grid); content.append(section);
      }
      if (state.day !== 'ideas') content.append(daySection(state.day, true));
    } else if (state.planMode === 'day') content.append(daySection(state.day, true));
    else for (const day of days) content.append(daySection(day));
    if (state.planMode !== 'day') content.append(daySection('ideas'));
    renderTransport();
  }

  function renderTransport() {
    const content = $('transport-content'); content.replaceChildren();
    const segments = [...(state.trip.transport || [])].sort((a, b) => `${a.departure_date}${a.departure_time}`.localeCompare(`${b.departure_date}${b.departure_time}`));
    if (!segments.length) content.append(action(datesForTrip(state.trip).length ? 'ADD A FLIGHT OR TRAIN ↗' : 'CHOOSE TRIP DATES ↗', () => openTransport(), 'open-day'));
    for (const segment of segments) content.append(transportCard(segment));
  }

  $('add-plan').addEventListener('click', () => openPlan()); $('add-transport').addEventListener('click', () => openTransport());
  $('explore-day').addEventListener('change', event => { chooseDay(event.target.value); });
  for (const button of document.querySelectorAll('[data-plan-mode]')) button.addEventListener('click', () => { state.planMode = button.dataset.planMode; if (state.planMode === 'calendar' && state.day === 'ideas') state.day = datesForTrip(state.trip)[0] || 'ideas'; render(); });
  for (const button of document.querySelectorAll('[data-close-dialog]')) button.addEventListener('click', () => button.closest('dialog').close());
  for (const dialog of document.querySelectorAll('.editor-dialog')) dialog.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } });
  $('plan-form').addEventListener('submit', event => {
    event.preventDefault(); const input = Object.fromEntries(new FormData(event.currentTarget)); input.booked = event.currentTarget.elements.booked.checked;
    try { const item = makePlan(state.trip, input, editingPlan); const items = state.trip.items || []; commit({ ...state.trip, items: items.some(entry => entry.id === item.id) ? items.map(entry => entry.id === item.id ? item : entry) : [...items, item] }); chooseDay(item.day); $('plan-dialog').close(); }
    catch (error) { $('plan-error').textContent = error.message; }
  });
  $('transport-form').addEventListener('submit', event => {
    event.preventDefault();
    try { const segment = makeTransport(state.trip, Object.fromEntries(new FormData(event.currentTarget)), editingTransport?.id); commit(upsertTransport(state.trip, segment)); chooseDay(segment.departure_date); $('transport-dialog').close(); }
    catch (error) { $('transport-error').textContent = error.message; }
  });
  for (const [id, remove] of [['delete-plan', () => commit(removePlace(state.trip, editingPlan.id))], ['delete-transport', () => commit({ ...state.trip, transport: (state.trip.transport || []).filter(item => item.id !== editingTransport.id) })]]) {
    $(id).addEventListener('click', event => { const button = event.currentTarget; if (!button.dataset.confirm) { button.dataset.confirm = 'yes'; button.textContent = 'CONFIRM REMOVE'; return; } try { remove(); button.closest('dialog').close(); } catch (error) { $(id === 'delete-plan' ? 'plan-error' : 'transport-error').textContent = error.message; } });
  }
  const zones = ['UTC', ...Intl.supportedValuesOf('timeZone')];
  for (const zone of zones) { const option = node('option'); option.value = zone; $('time-zones').append(option); }
  return { render, openPlan, openTransport };
}
