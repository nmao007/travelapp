export function isDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function calendarMonth(year, month) {
  const first = new Date(Date.UTC(year, month, 1));
  const startOffset = (first.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return [...Array(startOffset).fill(null), ...Array.from({ length: count }, (_, index) => `${year}-${String(month + 1).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`)];
}

export function selectDateRange(range, date) {
  if (!isDate(date)) return range;
  if (!range.start || range.end || date < range.start) return { start: date, end: null };
  return { start: range.start, end: date };
}

export function rangeLength(start, end) {
  if (!isDate(start) || !isDate(end) || end < start) return 0;
  return Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86400000) + 1;
}

export function presetRange(kind, today = new Date()) {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  if (kind === 'weekend') start.setDate(start.getDate() + ((6 - start.getDay() + 7) % 7));
  else if (kind === 'next-week') start.setDate(start.getDate() + ((8 - start.getDay()) % 7 || 7));
  else return null;
  const end = new Date(start);
  end.setDate(end.getDate() + (kind === 'weekend' ? 1 : 6));
  const isoLocal = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return { start: isoLocal(start), end: isoLocal(end) };
}
