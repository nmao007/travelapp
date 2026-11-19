// Date and clock labels used by the site (format() in itinerary-ui.js and
// time-picker.js), so both apps print the same text.
export const formatDay = (date: string, options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' }) =>
  new Intl.DateTimeFormat('en', { ...options, timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`));

export const timeParts = (value?: string) => /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value || '')?.slice(1) || ['', ''];
export function clockParts(value?: string): [string, string, 'AM' | 'PM'] {
  const [hour, minute] = timeParts(value);
  return hour ? [String(Number(hour) % 12 || 12), minute, Number(hour) >= 12 ? 'PM' : 'AM'] : ['', '', 'AM'];
}
export function formatClock(value?: string) {
  const [hour, minute, period] = clockParts(value?.slice(0, 5));
  return hour ? `${hour}:${minute} ${period}` : '';
}
export function clockTime(hour: string, minute: string, period: string) {
  if (!/^\d{1,2}$/.test(hour) || Number(hour) < 1 || Number(hour) > 12 || !/^(?:\d{1,2})?$/.test(minute) || Number(minute) > 59 || !['AM', 'PM'].includes(period)) return '';
  return `${String(Number(hour) % 12 + (period === 'PM' ? 12 : 0)).padStart(2, '0')}:${String(Number(minute)).padStart(2, '0')}`;
}

// "Dec 3 – 8" or "Nov 29 – Dec 2", as in render() for #phone-trip-range.
export function rangeLabel(start: string, end: string) {
  return `${formatDay(start, { month: 'short', day: 'numeric' })} – ${formatDay(end, start.slice(0, 7) === end.slice(0, 7) ? { day: 'numeric' } : { month: 'short', day: 'numeric' })}`;
}
