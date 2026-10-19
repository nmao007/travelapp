import { isContentIdea, isPlaced, persistableBoardTrip, withBoardChange, createBoardObject, placeExistingIdea, assignToFrame, movePlacedItems, readBoardViewport, writeBoardViewport, boardSnapshotData, libraryRecord, fitFrame, editedBoardIdea, ideaWebURL, fittedBoardViewport, boardObjectBounds, duplicateBoardObjects, removeBoardObjects, sendIdeasToInbox } from './board-model.js';
import { loadPersonalIdeas, savePersonalIdea, deletePersonalIdea, currentAccount } from './trip-store.js';
import { datesForTrip, makePlan } from './itinerary-model.js';
import { flightDayBlock } from './flight-window.js';
import { placeArt } from './place-art.js';
import { closeDialogSmooth, createFrameScheduler, animateContentChange, revealSequence, reducedMotion } from './motion.js';
import { enhanceDropdowns, refreshDropdowns } from './dropdowns.js';

const $ = id => document.getElementById(id);
const el = (tag, cls = '', text) => { const n = document.createElement(tag); n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const dateText = date => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));
const colors = { sun: '#f8dfa2', rose: '#f2beb3', sky: '#bed5ef', lilac: '#d4c8eb', mint: '#c6dfd4' };
const ns = 'http://www.w3.org/2000/svg';

export function createIdeasBoard({ state, persist, addPlan, icon }) {
  const root = $('ideas-panel'), surface = $('ib-surface'), world = $('ib-world');
  let tripId = null, view = 'gallery', viewport = { x: 0, y: 0, scale: 1 }, tool = 'pan';
  let selection = [], history = [], future = [], draft = null, scheduling = null, connection = null;
  let library = [], libraryTicket = 0, libraryLoading = false, gesture = null, lastContent = '', viewportTimer, noticeTimer, saving = false;
  const pointers = new Map(), cards = new Map();
  const items = () => state.trip?.boardItems || [], links = () => state.trip?.boardLinks || [];
  const button = (label, symbol, handler, cls = 'ib-icon') => {
    const b = el('button', cls); b.type = 'button'; b.setAttribute('aria-label', label); b.title = label;
    if (symbol) b.innerHTML = icon(symbol); else b.textContent = label;
    b.addEventListener('click', event => { event.stopPropagation(); handler(event); }); return b;
  };
  function notice(text, undo) {
    clearTimeout(noticeTimer); const node = $('ib-message'); node.replaceChildren(el('span', '', text)); node.hidden = false;
    if (undo) node.append(button('Undo', null, () => { undo(); node.hidden = true; }, 'ib-notice-undo'));
    noticeTimer = setTimeout(() => { node.hidden = true; }, 6500);
  }
  function save(patch, record = true) {
    if (!state.trip || state.trip.id !== tripId) return false;
    const before = boardSnapshotData(state.trip), next = withBoardChange(state.trip, patch);
    try { persist(next); } catch { notice('Could not save. Your previous board is still safe.'); return false; }
    if (record && before !== boardSnapshotData(next)) { history.push(before); if (history.length > 50) history.shift(); future = []; }
    $('board-save-state').textContent = currentAccount() ? 'Syncing' : 'Saved';
    $('board-save-state').title = 'Saved on this device'; lastContent = ''; render(); return true;
  }
  function restore(from, to) {
    const previous = from.at(-1); if (!previous) return;
    const current = boardSnapshotData(state.trip);
    if (save(JSON.parse(previous), false)) { from.pop(); to.push(current); selection = []; render(); }
  }
  const undo = () => restore(history, future), redo = () => restore(future, history);
  function reset() {
    if (tripId === state.trip?.id) return;
    close(); tripId = state.trip?.id || null; selection = []; history = []; future = []; lastContent = ''; libraryTicket++;
    viewport = readBoardViewport(tripId, localStorage); view = 'gallery'; tool = 'pan';
    $('ib-source').value = 'board'; $('ib-category').value = ''; $('ib-search').value = ''; $('ib-message').hidden = true;
    if (state.trip) state.trip = persistableBoardTrip(state.trip);
    refreshDropdowns($('ib-source')); refreshDropdowns($('ib-category'));
  }
  function close() {
    frame.cancel(); if (gesture?.path) gesture.path.remove(); if (gesture?.original) { paint(gesture.original); drawLines(gesture.original); } gesture = null; pointers.clear(); lastContent = '';
    for (const dialog of document.querySelectorAll('.ib-dialog[open]')) dialog.close();
    clearTimeout(viewportTimer); if (tripId) storeViewport();
  }
  function storeViewport() { try { writeBoardViewport(tripId, viewport, localStorage); } catch { /* Board content is independent of device view settings. */ } }
  function transform() { world.style.transform = `translate(${viewport.x}px,${viewport.y}px) scale(${viewport.scale})`; $('ib-fit').textContent = `${Math.round(viewport.scale * 100)}%`; }
  function setView(next) { if (view === next) return; frame.cancel(); gesture = null; view = next; selection = []; lastContent = ''; render(); if (view === 'canvas') requestAnimationFrame(transform); animateContentChange($(view === 'canvas' ? 'ib-canvas-wrap' : 'ib-cards'), { distance: 5, duration: 190 }); }
  function center(item) {
    if (!isPlaced(item)) { place(item); return; }
    view = 'canvas'; selection = [item.id]; lastContent = ''; render();
    const box = boardObjectBounds(item); viewport.scale = Math.min(1, viewport.scale);
    viewport.x = surface.clientWidth / 2 - (box.x + box.width / 2) * viewport.scale;
    viewport.y = surface.clientHeight / 2 - (box.y + box.height / 2) * viewport.scale; transform(); storeViewport();
  }
  function fit() { view = 'canvas'; lastContent = ''; render(); viewport = fittedBoardViewport(items(), { width: surface.clientWidth, height: surface.clientHeight }); transform(); storeViewport(); }
  function zoom(factor, x = surface.clientWidth / 2, y = surface.clientHeight / 2) {
    const wx = (x - viewport.x) / viewport.scale, wy = (y - viewport.y) / viewport.scale;
    viewport.scale = Math.max(.08, Math.min(2.4, viewport.scale * factor)); viewport.x = x - wx * viewport.scale; viewport.y = y - wy * viewport.scale;
    transform(); clearTimeout(viewportTimer); viewportTimer = setTimeout(storeViewport, 300);
  }
  function open(dialog, focus) {
    enhanceDropdowns(dialog); dialog.showModal(); (focus || dialog.querySelector('input:not([type=hidden]),button'))?.focus({ preventScroll: true });
  }
  function scheduledDays(item) { const id = item.libraryIdeaId || item.id; return [...new Set((state.trip.items || []).filter(plan => plan.ideaId === id).map(plan => plan.day))]; }
  function itemImage(item, className) {
    let url; try { url = ideaWebURL(item.image); } catch { return null; } if (!url) return null;
    const image = el('img', className); image.src = url; image.alt = ''; image.loading = 'lazy'; image.decoding = 'async'; image.referrerPolicy = 'no-referrer';
    image.addEventListener('error', () => image.remove(), { once: true }); return image;
  }
  function art(item) { return placeArt(item.type === 'note' ? 'list' : ({ Food: 'food', Stay: 'stay', Nature: 'leaf', Culture: 'landmark' }[item.category] || 'pin')); }
  function makeCard(item, canvas = false, personal = false) {
    const card = el('article', `ib-card ib-type-${item.type} ib-color-${colors[item.color] ? item.color : 'sun'}${canvas ? ' ib-object' : ''}`); card.dataset.boardId = item.id;
    const image = itemImage(item, 'ib-card-image'); if (image) card.append(image);
    const body = el('div', 'ib-card-body'), head = el('div', 'ib-card-head');
    const title = el('button', 'ib-card-title', item.title || 'Untitled idea'); title.type = 'button'; title.addEventListener('click', () => personal ? addLibraryIdea(item) : edit(item));
    const editButton = button(personal ? `Add ${item.title} to this trip` : `Edit ${item.title || 'idea'}`, personal ? 'plus' : 'more', () => personal ? addLibraryIdea(item) : edit(item));
    head.append(title, editButton); body.append(head);
    if (!image && item.type !== 'note') { const symbol = el('span', 'ib-card-art'); symbol.innerHTML = art(item); body.prepend(symbol); }
    if (item.location) body.append(el('p', 'ib-card-location', item.location));
    if (item.notes) body.append(el('p', 'ib-card-notes', item.notes));
    const meta = el('div', 'ib-card-meta'); meta.append(el('span', '', item.type === 'note' ? 'Note' : item.category || 'Activity'));
    const days = personal ? [] : scheduledDays(item); if (days.length) { const planned = el('span', 'ib-planned', days.map(dateText).join(' · ')); planned.innerHTML = icon('check'); planned.append(document.createTextNode(days.map(dateText).join(' · '))); meta.append(planned); }
    else if (!personal && !isPlaced(item)) meta.append(el('span', 'ib-inbox-mark', 'Inbox'));
    body.append(meta);
    const footer = el('div', 'ib-card-footer');
    if (personal) {
      const add = button('Add to trip', 'plus', () => addLibraryIdea(item), 'ib-card-add'); add.append(document.createTextNode('Add to trip')); footer.append(add);
      footer.append(button(`Remove ${item.title} from library`, 'trash', () => { deletePersonalIdea(item.id); library = library.filter(entry => entry.id !== item.id); lastContent = ''; render(); notice('Removed from library', () => { savePersonalIdea(item); library.unshift(item); lastContent = ''; render(); }); }));
    } else {
      footer.append(button(`Add ${item.title || 'idea'} to a day`, 'calendar', () => schedule(item)));
      if (!canvas) footer.append(button(isPlaced(item) ? `Find ${item.title} on canvas` : `Place ${item.title} on canvas`, 'frame', () => center(item)));
      if (item.url) { try { const url = ideaWebURL(item.url); if (url) { const link = el('a', 'ib-icon'); link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.setAttribute('aria-label', `Open link for ${item.title}`); link.innerHTML = icon('external'); footer.append(link); } } catch { /* An old malformed URL must not become executable. */ } }
    }
    body.append(footer); card.append(body); return card;
  }
  async function loadLibrary() {
    const ticket = ++libraryTicket; libraryLoading = true; lastContent = ''; render();
    const loaded = await loadPersonalIdeas();
    if (ticket !== libraryTicket) return; library = loaded.filter(isContentIdea); libraryLoading = false; lastContent = ''; render();
  }
  function addLibraryIdea(item) {
    const existing = items().find(entry => entry.libraryIdeaId === item.id);
    if (existing) { notice('Already saved in this trip'); return; }
    const copy = createBoardObject(item.type, { destination: 'inbox', extras: { ...libraryRecord(item), id: crypto.randomUUID(), libraryIdeaId: item.id } });
    if (save({ boardItems: [...items(), copy] })) notice('Saved to this trip');
  }
  let galleryFrame = 0;
  function renderGallery() {
    const grid = $('ib-cards'), source = $('ib-source').value, query = $('ib-search').value.trim().toLowerCase(), category = $('ib-category').value;
    let list = (source === 'library' ? library : items()).filter(isContentIdea).filter(item => source !== 'inbox' || !isPlaced(item));
    list = list.filter(item => (!category || item.category === category) && (!query || [item.title, item.notes, item.location, item.category, item.url].some(value => String(value || '').toLowerCase().includes(query))));
    grid.replaceChildren();
    for (const item of list) grid.append(makeCard(item, false, source === 'library'));
    if (!list.length) {
      const empty = el('div', 'ib-empty'), illustration = el('span', 'ib-empty-art'); illustration.innerHTML = placeArt('guide');
      empty.append(illustration, el('h3', '', libraryLoading && source === 'library' ? 'Loading your saves…' : query || category ? 'No matches, yet.' : source === 'library' ? 'Good finds travel with you.' : source === 'inbox' ? 'Nothing waiting in the wings.' : 'Leave room for a little possibility.'));
      empty.append(el('p', '', query || category ? 'Try a different search or type.' : source === 'library' ? 'Keep an idea in your library to reuse it on another trip.' : source === 'inbox' ? 'Ideas saved here stay off the canvas until you place them.' : 'Save a place, a link or a passing thought.'));
      if (source !== 'library' && !query && !category) { const add = button('Save your first idea', 'plus', () => create('card'), 'ib-empty-add'); add.append(document.createTextNode('Add an idea')); empty.append(add); }
      grid.append(empty);
    }
    cancelAnimationFrame(galleryFrame);
    if (!reducedMotion()) galleryFrame = requestAnimationFrame(() => {
      if (root.hidden || grid.hidden || !grid.isConnected) return;
      const bounds = grid.getBoundingClientRect();
      const visible = [...grid.children].slice(0, 8).filter(card => card.getBoundingClientRect().top < bounds.bottom);
      revealSequence(visible, { step: 16 });
    });
  }
  function drawLines(data = items()) {
    const svg = $('ib-lines'); svg.replaceChildren();
    for (const link of links()) {
      const from = data.find(item => item.id === link.from && isPlaced(item)), to = data.find(item => item.id === link.to && isPlaced(item)); if (!from || !to) continue;
      const a = boardObjectBounds(from), b = boardObjectBounds(to);
      const line = document.createElementNS(ns, 'line');
      for (const [key, value] of Object.entries({ x1: a.x + a.width / 2, y1: a.y + a.height / 2, x2: b.x + b.width / 2, y2: b.y + b.height / 2 })) line.setAttribute(key, String(value));
      line.setAttribute('class', 'ib-line'); line.setAttribute('tabindex', '0'); line.setAttribute('role', 'button'); line.setAttribute('aria-label', link.label || 'Edit connection');
      const openLink = () => { connection = link.id; $('ib-connection-label').value = link.label || ''; open($('ib-connection-dialog'), $('ib-connection-label')); };
      line.addEventListener('click', openLink); line.addEventListener('keydown', event => { if (event.key === 'Enter') openLink(); }); svg.append(line);
      if (link.label) { const text = document.createElementNS(ns, 'text'); text.setAttribute('x', String((a.x + a.width / 2 + b.x + b.width / 2) / 2)); text.setAttribute('y', String((a.y + a.height / 2 + b.y + b.height / 2) / 2 - 10)); text.textContent = link.label; svg.append(text); }
    }
  }
  function renderCanvas() {
    const objects = $('ib-objects'), drawings = $('ib-drawings'); objects.replaceChildren(); drawings.replaceChildren(); cards.clear();
    for (const item of items().filter(isPlaced)) {
      if (item.type === 'draw') {
        const path = document.createElementNS(ns, 'path'); path.dataset.boardId = item.id; path.setAttribute('d', pathData(item.points)); path.setAttribute('stroke', colors[item.color] || colors.sun); path.setAttribute('stroke-width', String(item.strokeWidth || 12)); path.setAttribute('class', 'ib-stroke'); drawings.append(path); cards.set(item.id, path); continue;
      }
      let card;
      if (item.type === 'group') { card = el('article', `ib-object ib-frame ib-color-${item.color || 'sky'}`); card.dataset.boardId = item.id; card.append(el('strong', 'ib-frame-title', item.title || 'New frame'), button(`Edit frame ${item.title || ''}`, 'more', () => edit(item))); }
      else if (item.type === 'sticker') { card = el('article', 'ib-object ib-sticker', item.sticker || item.title || '✨'); card.dataset.boardId = item.id; card.append(button('Edit sticker', 'more', () => edit(item))); }
      else card = makeCard(item, true);
      card.tabIndex = 0; card.setAttribute('aria-label', item.title || 'Board item');
      card.addEventListener('dblclick', event => { if (!event.target.closest('button,a')) edit(item); });
      const resize = el('span', 'ib-resize'); resize.setAttribute('aria-hidden', 'true'); card.append(resize); objects.append(card); cards.set(item.id, card);
    }
    paint(items()); drawLines(); transform(); syncSelection();
    const empty = $('ib-canvas-empty'); empty.hidden = items().some(isPlaced); empty.replaceChildren(el('h3', '', 'Make a little room for ideas.'), el('p', '', 'Drag to arrange. Pinch to explore.'));
    if (!empty.hidden) { const add = button('Add an idea', 'plus', () => create('card'), 'ib-empty-add'); add.append(document.createTextNode('Add idea')); empty.append(add); }
  }
  function paint(data) {
    for (const item of data) {
      const card = cards.get(item.id); if (!card) continue;
      if (item.type === 'draw') card.setAttribute('d', pathData(item.points));
      else { card.style.left = `${item.x}px`; card.style.top = `${item.y}px`; card.style.width = `${item.width}px`; card.style.height = `${item.height}px`; }
    }
  }
  function syncSelection() {
    selection = selection.filter(id => items().some(item => item.id === id));
    for (const [id, node] of cards) node.classList.toggle('ib-selected', selection.includes(id));
    $('ib-selection').hidden = view !== 'canvas' || !selection.length;
    $('ib-selection-count').textContent = `${selection.length} selected`;
    $('ib-edit-selection').disabled = selection.length !== 1;
    $('ib-connect').disabled = selection.length !== 2 || selection.some(id => items().find(item => item.id === id)?.type === 'draw');
    $('ib-group').disabled = !selection.some(id => isContentIdea(items().find(item => item.id === id)));
  }
  function render() {
    if (!state.trip) return; if (tripId !== state.trip.id) reset();
    root.dataset.view = view; $('ib-cards').hidden = view !== 'gallery'; $('ib-canvas-wrap').hidden = view !== 'canvas';
    $('ib-gallery').setAttribute('aria-pressed', String(view === 'gallery')); $('ib-canvas').setAttribute('aria-pressed', String(view === 'canvas'));
    $('ib-count').textContent = `${items().filter(isContentIdea).length} saved`;
    $('ib-undo').disabled = !history.length; $('ib-redo').disabled = !future.length;
    $('ib-pan').setAttribute('aria-pressed', String(tool === 'pan')); $('ib-select').setAttribute('aria-pressed', String(tool === 'select'));
    surface.dataset.tool = tool;
    const fingerprint = JSON.stringify([boardSnapshotData(state.trip), view, $('ib-source').value, $('ib-category').value, $('ib-search').value, library, libraryLoading, (state.trip.items || []).map(item => [item.ideaId, item.day])]);
    if (fingerprint !== lastContent) { lastContent = fingerprint; if (view === 'gallery') renderGallery(); else renderCanvas(); }
    syncSelection();
  }
  function placement() {
    return { viewport, canvas: { width: surface.clientWidth || root.clientWidth, height: surface.clientHeight || 500 }, items: items(), selectedIds: selection };
  }
  function place(item) {
    view = 'canvas'; lastContent = ''; render();
    const created = createBoardObject(item.type, { ...placement(), extras: { title: item.title } });
    const next = placeExistingIdea(items(), item.id, created);
    if (save({ boardItems: next })) { selection = [item.id]; center(next.find(entry => entry.id === item.id)); notice('Placed on canvas'); }
  }
  function create(type) {
    const modelType = type === 'link' ? 'card' : type;
    const item = createBoardObject(modelType, { ...placement(), destination: view === 'gallery' ? 'inbox' : 'canvas', extras: { title: '', color: ['sun', 'sky', 'rose', 'lilac'][items().length % 4] } });
    edit(item, { fresh: true, linkFirst: type === 'link' });
  }
  function edit(item, { fresh = false, linkFirst = false } = {}) {
    if (!item) return;
    draft = { item: structuredClone(item), fresh, tripId, kind: linkFirst || (item.type === 'card' && item.url) ? 'link' : item.type };
    $('ib-more-details').open = false;
    const form = $('idea-form'); form.reset();
    for (const name of ['title', 'url', 'image', 'notes', 'location', 'color', 'category']) form.elements[name].value = item[name] || (name === 'category' ? 'Activity' : name === 'color' ? 'sun' : '');
    if (item.type === 'sticker') form.elements.title.value = item.sticker || item.title || '✨';
    const content = isContentIdea(item);
    $('idea-editor-title').textContent = fresh ? (item.type === 'note' ? 'New note' : 'New idea') : item.type === 'group' ? 'Edit frame' : item.type === 'sticker' ? 'Edit sticker' : 'Edit idea';
    $('ib-notes-field').hidden = item.type === 'sticker'; $('ib-library-field').hidden = !content;
    form.elements.library.checked = Boolean(item.libraryIdeaId);
    const frames = items().filter(entry => entry.type === 'group' && entry.id !== item.id);
    form.elements.frame.replaceChildren(new Option('No frame', ''), ...frames.map(frame => new Option(frame.title || 'Frame', frame.id)));
    form.elements.frame.value = item.groupId || ''; $('ib-frame-field').hidden = !content || !frames.length;
    $('idea-delete').hidden = fresh; $('ib-placement').hidden = fresh || !content;
    $('ib-placement').textContent = isPlaced(item) ? 'Move to inbox' : 'Place on canvas';
    $('idea-error').textContent = ''; renderColors(item.color || 'sun');
    refreshDropdowns(form.elements.category); refreshDropdowns(form.elements.frame);
    configureQuickFields(draft.kind);
    open($('idea-editor'), draft.kind === 'link' ? form.elements.url : draft.kind === 'photo' ? form.elements.image : form.elements.title);
  }
  function configureQuickFields(kind) {
    const form = $('idea-form'), content = isContentIdea(draft.item), place = ['card', 'link', 'photo'].includes(kind);
    const quick = $('ib-quick-fields'), extra = $('ib-more-details').querySelector('.ib-extra-fields');
    // A link or photo can be saved on its own. Its title and all organization controls are optional.
    for (const id of ['ib-title-field', 'ib-link-field', 'ib-image-field']) extra.insertBefore($(id), $('ib-place-fields'));
    if (kind === 'link') quick.prepend($('ib-link-field'));
    else if (kind === 'photo') quick.prepend($('ib-image-field'));
    else quick.prepend($('ib-title-field'));
    $('ib-title-label').textContent = kind === 'card' ? 'Place or idea' : ['link', 'photo'].includes(kind) ? 'Title · optional' : 'Title';
    $('ib-link-field').hidden = !place; $('ib-image-field').hidden = !place; $('ib-place-fields').hidden = !place;
    $('ib-kind-picker').hidden = !draft.fresh || !content;
    for (const button of $('ib-kind-picker').querySelectorAll('button')) button.setAttribute('aria-pressed', String(button.dataset.ibKind === kind));
    form.elements.title.enterKeyHint = 'done';
  }
  function renderColors(selected) {
    const container = $('ib-colors'); container.replaceChildren(el('span', '', 'Color'));
    for (const [value, color] of Object.entries(colors)) { const choice = button(({ sun: 'Sand', sky: 'Blue', rose: 'Coral', lilac: 'Lilac', mint: 'Sage' })[value], null, () => { $('idea-form').elements.color.value = value; renderColors(value); }, 'ib-color'); choice.textContent = ''; choice.style.setProperty('--swatch', color); choice.setAttribute('aria-pressed', String(value === selected)); container.append(choice); }
  }
  async function submitIdea(event) {
    event.preventDefault(); if (!draft || draft.tripId !== state.trip?.id || saving) return;
    const context = draft, form = $('idea-form'), submit = form.querySelector('[type=submit]'); saving = true; submit.disabled = true; submit.textContent = 'Saving…';
    try {
      let values = Object.fromEntries(new FormData(form)); values.url = ideaWebURL(values.url); values.image = ideaWebURL(values.image, 'Image');
      if (values.url && (!String(values.title || '').trim() || !values.image)) {
        $('idea-error').textContent = 'Getting link details…';
        try { const response = await fetch(`/api/idea-preview?url=${encodeURIComponent(values.url)}`, { signal: AbortSignal.timeout(2500) }); const data = response.ok ? await response.json() : null; if (!values.title.trim()) values.title = data?.preview?.title?.slice(0, 120) || new URL(values.url).hostname.replace(/^www\./, ''); if (!values.image && data?.preview?.image) values.image = ideaWebURL(data.preview.image, 'Image'); } catch { if (!values.title.trim()) values.title = new URL(values.url).hostname.replace(/^www\./, ''); }
      }
      if (draft !== context || !form.closest('dialog').open || state.trip?.id !== context.tripId) return;
      const original = context.fresh ? context.item : items().find(item => item.id === context.item.id); if (!original) throw new Error('This idea was removed.');
      if (!String(values.title || '').trim() && original.type === 'photo' && values.image) values.title = 'Photo idea';
      let idea = editedBoardIdea(original, values);
      if (values.library) idea.libraryIdeaId = original.libraryIdeaId || crypto.randomUUID();
      let next = context.fresh ? [...items(), idea] : items().map(item => item.id === idea.id ? idea : item);
      if (values.frame && isContentIdea(idea)) { if (!isPlaced(idea)) { const frame = next.find(item => item.id === values.frame); const created = createBoardObject(idea.type, { ...placement(), items: next, selectedIds: [frame.id] }); next = placeExistingIdea(next, idea.id, created); } next = assignToFrame(next, idea.id, values.frame); }
      else if (idea.groupId) next = assignToFrame(next, idea.id, null);
      if (!save({ boardItems: next })) throw new Error('Could not save this idea.');
      if (values.library && isContentIdea(idea)) { try { savePersonalIdea(libraryRecord(idea)); } catch { notice('Saved to this trip. Library save needs another try.'); } }
      await closeDialogSmooth($('idea-editor')); notice(context.fresh ? 'Idea saved' : 'Idea updated');
    } catch (error) { $('idea-error').textContent = error.message || 'Could not save this idea.'; }
    finally { saving = false; submit.disabled = false; submit.textContent = 'Save idea'; }
  }
  function remove(ids) { if (save(removeBoardObjects(items(), links(), ids))) { selection = []; syncSelection(); notice('Removed from board', undo); } }
  function schedule(item) {
    scheduling = { id: item.id, tripId }; $('ib-schedule-name').textContent = item.title; $('ib-schedule-error').textContent = '';
    const select = $('ib-schedule-day'); select.replaceChildren();
    for (const day of datesForTrip(state.trip)) { const option = new Option(dateText(day), day); const block = flightDayBlock(state.trip, day); option.disabled = Boolean(block); if (option.disabled) option.textContent += ' · In flight'; select.append(option); }
    const preferred = [...select.options].find(option => option.value === state.day && !option.disabled) || [...select.options].find(option => !option.disabled);
    select.value = preferred?.value || ''; $('ib-schedule-form').querySelector('[type=submit]').disabled = !preferred;
    if (!preferred) $('ib-schedule-error').textContent = 'Choose trip dates with an available day first.';
    refreshDropdowns(select); open($('ib-schedule-dialog'));
  }
  function submitSchedule(event) {
    event.preventDefault(); if (!scheduling || scheduling.tripId !== state.trip?.id) return;
    const item = items().find(item => item.id === scheduling.id); if (!item) return;
    try {
      const day = $('ib-schedule-day').value, ideaId = item.libraryIdeaId || item.id;
      if ((state.trip.items || []).some(plan => plan.ideaId === ideaId && plan.day === day)) throw new Error('This idea is already on that day.');
      const plan = makePlan(state.trip, { name: item.title, day, kind: ['Food', 'Stay', 'Activity'].includes(item.category) ? item.category : 'Activity', address: item.location || '', notes: [item.notes, item.url].filter(Boolean).join('\n\n'), ...(item.placeId ? { placeId: item.placeId, latitude: item.latitude, longitude: item.longitude } : {}) });
      addPlan({ ...state.trip, items: [...(state.trip.items || []), { ...plan, ideaId }] }); lastContent = ''; render(); closeDialogSmooth($('ib-schedule-dialog')); notice(`Added to ${dateText(day)}`);
    } catch (error) { $('ib-schedule-error').textContent = error.message || 'Could not add this idea.'; }
  }
  function duplicate() { const result = duplicateBoardObjects(items(), links(), selection); if (save({ boardItems: result.boardItems, boardLinks: result.boardLinks })) { selection = result.selectedIds; syncSelection(); } }
  function groupSelection() {
    const members = items().filter(item => selection.includes(item.id) && isContentIdea(item) && isPlaced(item)); if (!members.length) return;
    let next = structuredClone(items());
    const group = createBoardObject('group', { ...placement(), extras: { title: 'New frame', color: 'sky', memberIds: members.map(item => item.id) } }); next.push(group);
    for (const member of members) next = assignToFrame(next, member.id, group.id);
    fitFrame(next, next.find(item => item.id === group.id)); if (save({ boardItems: next })) { selection = [group.id]; syncSelection(); edit(next.find(item => item.id === group.id)); }
  }
  function connectSelection() {
    if (selection.length !== 2) return;
    if (links().some(link => (link.from === selection[0] && link.to === selection[1]) || (link.to === selection[0] && link.from === selection[1]))) { notice('Already connected'); return; }
    save({ boardLinks: [...links(), { id: crypto.randomUUID(), from: selection[0], to: selection[1], label: '' }] });
  }
  const pathData = points => points?.length ? `M ${points.map(point => `${point.x} ${point.y}`).join(' L ')}` : '';
  function point(event) { const rect = surface.getBoundingClientRect(); return { x: (event.clientX - rect.left - viewport.x) / viewport.scale, y: (event.clientY - rect.top - viewport.y) / viewport.scale }; }
  function down(event) {
    if (event.button !== 0 && event.pointerType !== 'touch') return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      frame.cancel(); if (gesture?.path) gesture.path.remove(); if (gesture?.original) { paint(gesture.original); drawLines(gesture.original); } $('ib-marquee').hidden = true;
      const [a, b] = [...pointers.values()], rect = surface.getBoundingClientRect();
      gesture = { mode: 'pinch', distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), viewport: { ...viewport }, center: { x: (a.x + b.x) / 2 - rect.left, y: (a.y + b.y) / 2 - rect.top } }; surface.setPointerCapture(event.pointerId); return;
    }
    if (event.target.closest('button,a,input,select,textarea,[role=button]')) return;
    surface.setPointerCapture(event.pointerId); const object = event.target.closest('[data-board-id]'), item = items().find(item => item.id === object?.dataset.boardId);
    const origin = { x: event.clientX, y: event.clientY }, base = { origin, viewport: { ...viewport }, original: items(), pointerId: event.pointerId, moved: false };
    if (tool === 'pen') { gesture = { ...base, mode: 'pen', points: [point(event)] }; const path = document.createElementNS(ns, 'path'); path.setAttribute('class', 'ib-stroke ib-stroke-draft'); path.setAttribute('stroke', colors.rose); path.setAttribute('stroke-width', '10'); $('ib-drawings').append(path); gesture.path = path; }
    else if (item) {
      if (event.shiftKey || tool === 'select') selection = selection.includes(item.id) ? selection.filter(id => id !== item.id) : [...selection, item.id];
      else if (!selection.includes(item.id)) selection = [item.id];
      gesture = { ...base, mode: event.target.closest('.ib-resize') ? 'resize' : 'move', item, ids: [...selection] }; syncSelection();
    } else { if (!event.shiftKey) selection = []; syncSelection(); gesture = { ...base, mode: tool === 'select' || event.shiftKey ? 'marquee' : 'pan' }; }
  }
  function move(event) {
    if (pointers.has(event.pointerId)) pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (!gesture) return;
    if (gesture.mode === 'pinch') {
      if (pointers.size < 2) return; const [a, b] = [...pointers.values()], rect = surface.getBoundingClientRect(), g = gesture;
      viewport.scale = Math.max(.08, Math.min(2.4, g.viewport.scale * Math.hypot(a.x - b.x, a.y - b.y) / g.distance));
      viewport.x = (a.x + b.x) / 2 - rect.left - (g.center.x - g.viewport.x) / g.viewport.scale * viewport.scale;
      viewport.y = (a.y + b.y) / 2 - rect.top - (g.center.y - g.viewport.y) / g.viewport.scale * viewport.scale; transform(); return;
    }
    if (gesture.pointerId !== event.pointerId) return;
    frame.schedule({ x: event.clientX, y: event.clientY });
  }
  function updateGesture(position) {
    const g = gesture; if (!g || g.mode === 'pinch') return;
    const dx = position.x - g.origin.x, dy = position.y - g.origin.y;
    if (Math.hypot(dx, dy) < 5 && !g.moved) return; g.moved = true;
    if (g.mode === 'pan') { viewport.x = g.viewport.x + dx; viewport.y = g.viewport.y + dy; transform(); return; }
    if (g.mode === 'pen') { const rect = surface.getBoundingClientRect(); g.points.push({ x: (position.x - rect.left - viewport.x) / viewport.scale, y: (position.y - rect.top - viewport.y) / viewport.scale }); g.path.setAttribute('d', pathData(g.points)); return; }
    if (g.mode === 'marquee') {
      const rect = surface.getBoundingClientRect(), box = $('ib-marquee'); box.hidden = false; box.style.left = `${Math.min(g.origin.x, position.x) - rect.left}px`; box.style.top = `${Math.min(g.origin.y, position.y) - rect.top}px`; box.style.width = `${Math.abs(dx)}px`; box.style.height = `${Math.abs(dy)}px`;
      const x1 = (Math.min(g.origin.x, position.x) - rect.left - viewport.x) / viewport.scale, y1 = (Math.min(g.origin.y, position.y) - rect.top - viewport.y) / viewport.scale;
      const x2 = x1 + Math.abs(dx) / viewport.scale, y2 = y1 + Math.abs(dy) / viewport.scale;
      selection = items().filter(isPlaced).filter(item => { const b = boardObjectBounds(item); return b.x < x2 && b.x + b.width > x1 && b.y < y2 && b.y + b.height > y1; }).map(item => item.id); syncSelection(); return;
    }
    if (g.mode === 'resize') { const item = { ...g.item, width: Math.max(g.item.type === 'sticker' ? 64 : 220, g.item.width + dx / viewport.scale), height: Math.max(g.item.type === 'sticker' ? 64 : 150, g.item.height + dy / viewport.scale) }; g.preview = g.original.map(entry => entry.id === item.id ? item : entry); }
    else g.preview = movePlacedItems(g.original, g.ids, dx / viewport.scale, dy / viewport.scale);
    paint(g.preview); drawLines(g.preview);
  }
  const frame = createFrameScheduler(updateGesture);
  function up(event) {
    pointers.delete(event.pointerId); const g = gesture; if (!g) return;
    if (g.mode === 'pinch') { frame.cancel(); gesture = null; pointers.clear(); storeViewport(); return; }
    if (event.pointerId !== g.pointerId) return;
    if (event.type === 'pointercancel') { frame.cancel(); if (g.path) g.path.remove(); paint(g.original); drawLines(); viewport = g.viewport; transform(); gesture = null; $('ib-marquee').hidden = true; return; }
    frame.schedule({ x: event.clientX, y: event.clientY }); frame.flush(); gesture = null; $('ib-marquee').hidden = true;
    if (g.mode === 'pan') storeViewport();
    else if (g.mode === 'pen') { g.path.remove(); if (g.points.length > 1) save({ boardItems: [...items(), { id: crypto.randomUUID(), type: 'draw', placed: true, points: g.points, color: 'rose', strokeWidth: 10 }] }); }
    else if (g.moved && g.preview) {
      let next = g.preview;
      if (g.mode === 'move' && g.item && isContentIdea(g.item)) {
        const item = next.find(item => item.id === g.item.id), candidate = next.filter(entry => entry.type === 'group' && !g.ids.includes(entry.id)).find(frame => item.x + item.width / 2 > frame.x && item.x + item.width / 2 < frame.x + frame.width && item.y + item.height / 2 > frame.y && item.y + item.height / 2 < frame.y + frame.height);
        for (const id of g.ids) if (isContentIdea(next.find(item => item.id === id))) next = assignToFrame(next, id, candidate?.id || null);
      }
      save({ boardItems: next });
    }
  }
  $('ib-gallery').addEventListener('click', () => setView('gallery')); $('ib-canvas').addEventListener('click', () => setView('canvas'));
  $('ib-add').addEventListener('click', () => create('card')); $('ib-tools').addEventListener('click', () => { render(); open($('ib-tools-sheet')); });
  for (const button of document.querySelectorAll('[data-ib-kind]')) button.addEventListener('click', () => { if (!draft?.fresh) return; draft.kind = button.dataset.ibKind; draft.item.type = draft.kind === 'link' ? 'card' : draft.kind; configureQuickFields(draft.kind); const form = $('idea-form'); (draft.kind === 'link' ? form.elements.url : draft.kind === 'photo' ? form.elements.image : form.elements.title).focus({ preventScroll: true }); });
  $('ib-search').addEventListener('input', () => { lastContent = ''; render(); });
  $('ib-category').addEventListener('change', () => { lastContent = ''; render(); });
  $('ib-source').addEventListener('change', () => { lastContent = ''; render(); if ($('ib-source').value === 'library') loadLibrary(); });
  $('ib-undo').addEventListener('click', () => { undo(); }); $('ib-redo').addEventListener('click', () => { redo(); });
  $('ib-pan').addEventListener('click', () => { tool = 'pan'; render(); }); $('ib-select').addEventListener('click', () => { tool = 'select'; render(); });
  $('ib-minus').addEventListener('click', () => zoom(.85)); $('ib-plus').addEventListener('click', () => zoom(1.18)); $('ib-fit').addEventListener('click', fit);
  $('ib-fit-tools').addEventListener('click', async () => { await closeDialogSmooth($('ib-tools-sheet')); fit(); });
  $('ib-new-frame').addEventListener('click', async () => { await closeDialogSmooth($('ib-tools-sheet')); view = 'canvas'; lastContent = ''; render(); create('group'); });
  $('ib-sticker').addEventListener('click', async () => { await closeDialogSmooth($('ib-tools-sheet')); view = 'canvas'; lastContent = ''; render(); const item = createBoardObject('sticker', { ...placement(), extras: { sticker: '✨' } }); edit(item, { fresh: true }); });
  $('ib-pen').addEventListener('click', async () => { await closeDialogSmooth($('ib-tools-sheet')); view = 'canvas'; tool = 'pen'; lastContent = ''; render(); notice('Draw on the canvas. Tap the hand to finish.'); });
  $('ib-edit-selection').addEventListener('click', () => edit(items().find(item => item.id === selection[0]))); $('ib-duplicate').addEventListener('click', duplicate); $('ib-delete').addEventListener('click', () => remove(selection)); $('ib-group').addEventListener('click', groupSelection); $('ib-connect').addEventListener('click', connectSelection); $('ib-clear-selection').addEventListener('click', () => { selection = []; syncSelection(); });
  $('idea-form').noValidate = true; $('idea-form').addEventListener('submit', submitIdea);
  $('idea-editor').addEventListener('close', () => { draft = null; });
  $('idea-delete').addEventListener('click', () => { if (draft?.tripId !== tripId) return; remove([draft.item.id]); closeDialogSmooth($('idea-editor')); });
  $('ib-placement').addEventListener('click', async () => { if (draft?.tripId !== tripId) return; const item = items().find(item => item.id === draft.item.id); await closeDialogSmooth($('idea-editor')); if (isPlaced(item)) { save({ boardItems: sendIdeasToInbox(items(), [item.id]) }); notice('Moved to Inbox', undo); } else place(item); });
  $('ib-schedule-form').addEventListener('submit', submitSchedule);
  $('ib-connection-form').addEventListener('submit', event => { event.preventDefault(); save({ boardLinks: links().map(link => link.id === connection ? { ...link, label: $('ib-connection-label').value.trim().slice(0, 80) } : link) }); closeDialogSmooth($('ib-connection-dialog')); });
  $('ib-connection-delete').addEventListener('click', () => { save({ boardLinks: links().filter(link => link.id !== connection) }); closeDialogSmooth($('ib-connection-dialog')); notice('Connection removed', undo); });
  surface.addEventListener('pointerdown', down); surface.addEventListener('pointermove', move); surface.addEventListener('pointerup', up); surface.addEventListener('pointercancel', up);
  surface.addEventListener('wheel', event => { event.preventDefault(); const rect = surface.getBoundingClientRect(); if (event.ctrlKey || event.metaKey) zoom(Math.exp(-event.deltaY * .008), event.clientX - rect.left, event.clientY - rect.top); else { viewport.x -= event.deltaX; viewport.y -= event.deltaY; transform(); clearTimeout(viewportTimer); viewportTimer = setTimeout(storeViewport, 300); } }, { passive: false });
  document.addEventListener('keydown', event => {
    if (state.workspaceView !== 'ideas' || document.querySelector('dialog[open]') || event.target.closest('input,textarea,select,[contenteditable=true]')) return;
    const mod = event.metaKey || event.ctrlKey, key = event.key.toLowerCase();
    if (mod && key === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
    else if (mod && key === 'd' && selection.length) { event.preventDefault(); duplicate(); }
    else if (['Delete', 'Backspace'].includes(event.key) && selection.length) { event.preventDefault(); remove(selection); }
    else if (event.key === 'Escape') { tool = 'pan'; selection = []; render(); }
    else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) && selection.length) { event.preventDefault(); const amount = event.shiftKey ? 20 : 4; save({ boardItems: movePlacedItems(items(), selection, key === 'arrowleft' ? -amount : key === 'arrowright' ? amount : 0, key === 'arrowup' ? -amount : key === 'arrowdown' ? amount : 0) }); }
  });
  new ResizeObserver(() => { if (view === 'canvas') transform(); }).observe(surface);
  return { reset, render, close };
}
