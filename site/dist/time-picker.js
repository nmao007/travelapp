import { enhanceDropdowns, refreshDropdowns } from './dropdowns.js';

const controls = new WeakMap();
export const timeParts = value => /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value || '')?.slice(1) || ['', ''];
export function selectedTime(hour, minute) {
  const value = `${hour}:${minute || '00'}`;
  return timeParts(value)[0] ? value : '';
}
export function clockParts(value) {
  const [hour, minute] = timeParts(value);
  return hour ? [String(Number(hour) % 12 || 12), minute, Number(hour) >= 12 ? 'PM' : 'AM'] : ['', '', 'AM'];
}
export function clockTime(hour, minute, period) {
  if (!/^\d{1,2}$/.test(hour) || Number(hour) < 1 || Number(hour) > 12 || !/^(?:\d{1,2})?$/.test(minute) || Number(minute) > 59 || !['AM', 'PM'].includes(period)) return '';
  return `${String(Number(hour) % 12 + (period === 'PM' ? 12 : 0)).padStart(2, '0')}:${String(Number(minute)).padStart(2, '0')}`;
}
export function formatClock(value) {
  const [hour, minute, period] = clockParts(value?.slice(0, 5));
  return hour ? `${hour}:${minute} ${period}` : '';
}

export function enhanceTimePickers(root = document) {
  for (const source of root.querySelectorAll('input[data-time-picker]')) {
    if (controls.has(source)) continue;
    const field = document.createElement('span'); field.className = 'time-picker';
    const label = source.dataset.timeLabel || 'Local time';
    const hour = document.createElement('input'), minute = document.createElement('input'), period = document.createElement('select');
    for (const [input, name, placeholder] of [[hour, 'hour', 'hh'], [minute, 'minute', 'mm']]) {
      input.type = 'text'; input.inputMode = 'numeric'; input.maxLength = 2; input.autocomplete = 'off'; input.className = 'time-number';
      input.placeholder = placeholder; input.setAttribute('aria-label', `${label} ${name}`); input.pattern = name === 'hour' ? '(?:0?[1-9]|1[0-2])' : '[0-5]?[0-9]';
      input.required = source.required;
    }
    period.setAttribute('aria-label', `${label} AM or PM`);
    for (const value of ['AM', 'PM']) { const option = document.createElement('option'); option.value = option.textContent = value; period.append(option); }
    field.append(hour);
    field.insertAdjacentHTML('beforeend', '<svg class="time-separator" viewBox="0 0 8 24" aria-hidden="true"><circle cx="4" cy="8" r="1.3"/><circle cx="4" cy="16" r="1.3"/></svg>');
    field.append(minute, period);
    field.insertAdjacentHTML('beforeend', '<svg class="icon time-picker-icon" aria-hidden="true"><use href="#i-clock"/></svg>');
    source.after(field);
    let editing = false;
    function sync() {
      if (!editing) [hour.value, minute.value, period.value] = clockParts(source.value);
      hour.disabled = minute.disabled = period.disabled = source.disabled;
      if (!editing) { hour.setCustomValidity(''); minute.setCustomValidity(''); }
      refreshDropdowns(field);
    }
    function change() {
      const value = clockTime(hour.value, minute.value, period.value);
      hour.setCustomValidity(hour.value && !/^(?:0?[1-9]|1[0-2])$/.test(hour.value) ? 'Enter an hour from 1 to 12.' : '');
      minute.setCustomValidity(minute.value && !/^[0-5]?[0-9]$/.test(minute.value) ? 'Enter minutes from 00 to 59.' : '');
      source.value = value;
      if (!value && (hour.value || minute.value)) return;
      editing = true;
      try { source.dispatchEvent(new Event('change', { bubbles: true })); } finally { editing = false; }
    }
    for (const input of [hour, minute]) {
      input.addEventListener('input', change);
      input.addEventListener('focus', () => input.select());
      input.addEventListener('blur', () => { if (source.value) sync(); });
      input.addEventListener('keydown', event => {
        if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault(); const minimum = input === hour ? 1 : 0, maximum = input === hour ? 12 : 59;
        const current = Number(input.value || minimum), direction = event.key === 'ArrowUp' ? 1 : -1;
        input.value = String(current < minimum || current > maximum ? minimum : (current - minimum + direction + maximum - minimum + 1) % (maximum - minimum + 1) + minimum);
        change(); input.select();
      });
    }
    period.addEventListener('change', () => { change(); sync(); });
    source.addEventListener('change', sync);
    source.form?.addEventListener('reset', () => queueMicrotask(sync));
    controls.set(source, { sync, field }); enhanceDropdowns(field); sync();
  }
}
export function refreshTimePickers(root = document) {
  if (controls.has(root)) controls.get(root).sync();
  for (const source of root.querySelectorAll?.('input[data-time-picker]') || []) controls.get(source)?.sync();
}
