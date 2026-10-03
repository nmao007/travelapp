import { playMotion } from './motion.js';

export const timeZoneLabel = value => String(value || '').replaceAll('_', ' ').replaceAll('/', ' / ');
const controls = new WeakMap();
let active = null, installed = false;
const symbols = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;

export function nextEnabledOption(options, current, direction) {
  if (!options.length) return -1;
  for (let step = 1; step <= options.length; step++) {
    const index = ((current + direction * step) % options.length + options.length) % options.length;
    if (!options[index].disabled) return index;
  }
  return -1;
}

export function matchingOptions(options, query) {
  const words = query.toLocaleLowerCase().replaceAll('_', ' ').split(/\s+/).filter(Boolean);
  return options.filter(option => words.every(word => `${option.label} ${option.value}`.toLocaleLowerCase().replaceAll('_', ' ').includes(word)));
}

function enhance(source) {
  if (source.closest('.gm-style')) return null;
  if (controls.has(source)) return controls.get(source);
  const editable = source.tagName === 'INPUT', listId = source.getAttribute('list');
  const formatted = editable && listId === 'time-zones';
  const host = document.createElement('span'); host.className = 'coded-dropdown';
  source.before(host); host.append(source);
  const trigger = formatted ? source.cloneNode(false) : editable ? source : document.createElement('button');
  const label = source.closest('label'), labelCopy = label?.cloneNode(true);
  labelCopy?.querySelectorAll('select,input,svg').forEach(element => element.remove());
  const accessibleName = source.getAttribute('aria-label') || labelCopy?.textContent.trim() || source.name || 'Choose an option';
  const menu = document.createElement('div'); menu.className = 'dropdown-menu'; menu.id = `dropdown-${crypto.randomUUID()}`;
  menu.setAttribute('popover', 'manual'); menu.setAttribute('role', 'listbox'); menu.hidden = true;
  let options = [], visible = [], index = -1, opened = false, selecting = false, typed = '', typingTimer;
  if (!editable) {
    trigger.type = 'button'; trigger.className = 'dropdown-trigger'; trigger.id = `${menu.id}-trigger`;
    trigger.innerHTML = `<span class="dropdown-value"></span>${symbols('chevron')}`;
    trigger.setAttribute('aria-label', accessibleName);
    if (label) label.htmlFor = trigger.id;
    source.hidden = true; source.tabIndex = -1; source.setAttribute('aria-hidden', 'true'); host.append(trigger);
  } else {
    if (formatted) {
      trigger.removeAttribute('list'); trigger.removeAttribute('name'); trigger.required = source.required; trigger.id = `${menu.id}-trigger`;
      source.type = 'hidden'; source.hidden = true; source.tabIndex = -1; source.setAttribute('aria-hidden', 'true'); host.append(trigger);
      if (label) label.htmlFor = trigger.id;
    }
    source.removeAttribute('list'); trigger.autocomplete = 'off'; trigger.setAttribute('aria-autocomplete', 'list');
    trigger.setAttribute('aria-label', accessibleName); host.classList.add('editable-dropdown');
    host.insertAdjacentHTML('beforeend', `<span class="dropdown-input-chevron" aria-hidden="true">${symbols('chevron')}</span>`);
  }
  source.dataset.codedDropdown = '';
  trigger.setAttribute('role', 'combobox'); trigger.setAttribute('aria-haspopup', 'listbox'); trigger.setAttribute('aria-expanded', 'false'); trigger.setAttribute('aria-controls', menu.id);
  if (source.getAttribute('aria-describedby')) trigger.setAttribute('aria-describedby', source.getAttribute('aria-describedby'));
  menu.setAttribute('aria-label', trigger.getAttribute('aria-label') || source.name || 'Options'); host.append(menu);

  function readOptions() {
    const entries = editable ? document.getElementById(listId)?.options || [] : source.options;
    options = [...entries].map(option => ({ value: option.value, label: formatted ? timeZoneLabel(option.value) : option.label || option.textContent || option.value, disabled: Boolean(option.disabled || option.parentElement?.disabled) }));
  }
  function sync() {
    readOptions();
    if (!editable) {
      trigger.disabled = source.disabled || !options.length;
      trigger.querySelector('.dropdown-value').textContent = source.selectedOptions[0]?.label || 'Choose';
      trigger.setAttribute('aria-required', String(source.required));
    }
    if (formatted) { trigger.value = timeZoneLabel(source.value); trigger.disabled = source.disabled; if (source.value) trigger.setCustomValidity(''); }
    if (opened && source.disabled) close();
    else if (opened) render(editable ? trigger.value : '');
  }
  function close(focus = false) {
    if (!opened) return;
    opened = false; if (menu.hidePopover && menu.matches(':popover-open')) menu.hidePopover(); menu.hidden = true;
    trigger.setAttribute('aria-expanded', 'false'); trigger.removeAttribute('aria-activedescendant');
    if (active === controller) active = null;
    if (focus) trigger.focus({ preventScroll: true });
  }
  function highlight(next) {
    index = next;
    [...menu.querySelectorAll('[role="option"]')].forEach((option, position) => option.classList.toggle('highlighted', position === index));
    const selected = menu.querySelectorAll('[role="option"]')[index];
    if (selected) { trigger.setAttribute('aria-activedescendant', selected.id); selected.scrollIntoView({ block: 'nearest' }); }
    else trigger.removeAttribute('aria-activedescendant');
  }
  function choose(position) {
    const option = visible[position]; if (!option || option.disabled) return;
    source.value = option.value; if (formatted) { trigger.value = option.label; trigger.setCustomValidity(''); } trigger.removeAttribute('aria-invalid'); close(true);
    if (!editable) trigger.querySelector('.dropdown-value').textContent = option.label;
    selecting = true;
    try { source.dispatchEvent(new Event('input', { bubbles: true })); source.dispatchEvent(new Event('change', { bubbles: true })); }
    finally { selecting = false; }
  }
  function render(query = '') {
    visible = matchingOptions(options, query); menu.replaceChildren();
    for (const [position, option] of visible.entries()) {
      const row = document.createElement('div'); row.className = 'dropdown-option'; row.id = `${menu.id}-${position}`;
      row.setAttribute('role', 'option'); row.setAttribute('aria-selected', String(source.value === option.value)); row.setAttribute('aria-disabled', String(option.disabled));
      const label = document.createElement('span'); label.textContent = option.label; row.append(label); row.insertAdjacentHTML('beforeend', symbols('check'));
      row.addEventListener('pointerdown', event => event.preventDefault());
      row.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); choose(position); }); menu.append(row);
    }
    if (!visible.length) { const empty = document.createElement('p'); empty.className = 'dropdown-empty'; empty.textContent = 'No matches'; empty.setAttribute('role', 'status'); menu.append(empty); }
    index = visible.findIndex(option => option.value === source.value && !option.disabled);
    if (index < 0) index = nextEnabledOption(visible, -1, 1);
    positionMenu(); highlight(index);
  }
  function positionMenu() {
    if (!opened) return;
    const rect = trigger.getBoundingClientRect(), width = Math.min(Math.max(rect.width, editable ? 260 : 180), window.innerWidth - 16);
    menu.style.width = `${width}px`; menu.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
    const below = window.innerHeight - rect.bottom - 8, above = rect.top - 8;
    const upward = below < Math.min(menu.scrollHeight, 180) && above > below;
    const height = Math.min(280, Math.max(40, upward ? above : below));
    menu.style.maxHeight = `${height}px`;
    menu.style.top = `${upward ? Math.max(8, rect.top - Math.min(menu.scrollHeight, height) - 4) : rect.bottom + 4}px`;
    menu.style.transformOrigin = upward ? 'bottom' : 'top';
  }
  function open(query = '') {
    if (source.disabled) return;
    if (active && active !== controller) active.close(); readOptions(); opened = true; active = controller;
    menu.hidden = false; if (menu.showPopover && !menu.matches(':popover-open')) menu.showPopover();
    trigger.setAttribute('aria-expanded', 'true'); render(query);
    playMotion(menu, [{ opacity: 0, transform: 'scaleY(.96)' }, { opacity: 1, transform: 'scaleY(1)' }], { duration: 150 });
  }
  const controller = { source, host, menu, sync, close, positionMenu }; controls.set(source, controller);
  trigger.addEventListener('click', event => { if (!editable) { event.preventDefault(); opened ? close() : open(); } else if (!opened) open(); });
  trigger.addEventListener('keydown', event => {
    if (event.key === 'Escape' && opened) { event.preventDefault(); event.stopPropagation(); close(true); return; }
    if (event.key === 'Tab') { close(); return; }
    if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      if (!opened) { open(); if (event.key === 'ArrowUp' && index < 0) highlight(nextEnabledOption(visible, 0, -1)); }
      else highlight(nextEnabledOption(visible, index, event.key === 'ArrowDown' ? 1 : -1));
    } else if (!editable && ['Home', 'End'].includes(event.key)) {
      event.preventDefault(); if (!opened) open(); highlight(nextEnabledOption(visible, event.key === 'Home' ? -1 : 0, event.key === 'Home' ? 1 : -1));
    } else if (event.key === 'Enter' || (!editable && event.key === ' ')) {
      if (opened) { event.preventDefault(); choose(index); } else if (!editable) { event.preventDefault(); open(); }
    } else if (!editable && event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault(); clearTimeout(typingTimer); typed += event.key.toLocaleLowerCase(); typingTimer = setTimeout(() => { typed = ''; }, 700);
      if (!opened) open(); const match = visible.findIndex(option => !option.disabled && option.label.toLocaleLowerCase().startsWith(typed)); if (match >= 0) highlight(match);
    }
  });
  if (editable) {
    trigger.addEventListener('focus', () => open());
    trigger.addEventListener('input', () => {
      if (selecting) return;
      if (formatted) {
        const normalize = value => value.toLowerCase().replaceAll('_', ' ').replaceAll(' / ', '/').trim();
        source.value = options.find(option => normalize(option.label) === normalize(trigger.value) || normalize(option.value) === normalize(trigger.value))?.value || '';
        source.dispatchEvent(new Event('input', { bubbles: true }));
      }
      open(trigger.value);
    });
    trigger.addEventListener('blur', () => {
      close();
      if (formatted) {
        const invalid = Boolean(trigger.value && !source.value);
        trigger.setCustomValidity(invalid ? 'Choose a time zone from the list.' : '');
        if (!invalid) source.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }
  source.addEventListener('change', sync);
  if (!editable) {
    source.addEventListener('invalid', event => { event.preventDefault(); trigger.setAttribute('aria-invalid', 'true'); open(); trigger.focus({ preventScroll: true }); });
    new MutationObserver(sync).observe(source, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled', 'selected', 'label', 'value', 'required'] });
    source.form?.addEventListener('reset', () => queueMicrotask(sync));
  }
  sync(); return controller;
}

export function enhanceDropdowns(root = document) {
  if (!document.body) return;
  if (!installed) {
    installed = true;
    document.addEventListener('pointerdown', event => { if (active && !active.host.contains(event.target)) active.close(); });
    document.addEventListener('scroll', event => { if (active && !active.menu.contains(event.target)) active.positionMenu(); }, true);
    document.addEventListener('close', event => { if (active?.source.closest('dialog') === event.target) active.close(); }, true);
    window.addEventListener('resize', () => active?.close());
    new MutationObserver(records => {
      for (const record of records) for (const added of record.addedNodes) if (added.nodeType === 1) enhanceDropdowns(added);
    }).observe(document.body, { childList: true, subtree: true });
  }
  if (root.matches?.('select,input[list]')) enhance(root);
  root.querySelectorAll?.('select,input[list]').forEach(enhance);
}

export function refreshDropdowns(root = document) {
  if (controls.has(root)) controls.get(root).sync();
  root.querySelectorAll?.('[data-coded-dropdown]').forEach(source => controls.get(source)?.sync());
}
