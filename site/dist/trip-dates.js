import { isDate, rangeLength } from './date-range.js';
import { activityInstant } from './domain.js';

export const dateOffset = (from, to) => isDate(from) && isDate(to) ? Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86400000) : 0;
export function offsetDate(date, days) {
  if (!isDate(date) || !days) return date;
  const result = new Date(`${date}T12:00:00Z`); result.setUTCDate(result.getUTCDate() + days);
  const value = result.toISOString().slice(0, 10);
  if (!isDate(value)) throw new Error('Choose dates within the supported calendar.');
  return value;
}
export function shiftTripDays(trip, days) {
  if (!days) return { ...trip };
  return {
    ...trip,
    items: (trip.items || []).map(item => ({ ...item, day: offsetDate(item.day, days) })),
    transport: (trip.transport || []).map(segment => {
      const next = { ...segment, departure_date: offsetDate(segment.departure_date, days), arrival_date: offsetDate(segment.arrival_date, days) };
      delete next.flightData; // Provider status and gates describe the old flight date.
      return next;
    }),
    ...(trip.stops ? { stops: trip.stops.map(stop => ({ ...stop, ...(stop.date ? { date: offsetDate(stop.date, days) } : {}), ...(stop.endDate ? { endDate: offsetDate(stop.endDate, days) } : {}) })) } : {}),
    ...(trip.dayOrder ? { dayOrder: Object.fromEntries(Object.entries(trip.dayOrder).map(([day, keys]) => [offsetDate(day, days), [...keys]])) } : {}),
  };
}
export function changeTripDates(trip, startDate, endDate, { movePlans = true } = {}) {
  if (!isDate(startDate) || !isDate(endDate) || endDate < startDate || rangeLength(startDate, endDate) > 366) throw new Error('Choose a range of up to one year.');
  const next = { ...shiftTripDays(trip, movePlans ? dateOffset(trip.startDate, startDate) : 0), startDate, endDate };
  const dated = [...(next.items || []).map(item => item.day), ...(next.transport || []).flatMap(segment => [segment.departure_date, segment.arrival_date]), ...(next.stops || []).flatMap(stop => [stop.date, stop.endDate])].filter(isDate).sort();
  if (dated[0] < startDate || dated.at(-1) > endDate) throw new Error(`Keep the range wide enough for your plans: ${dated[0]} to ${dated.at(-1)}. Nothing has been changed.`);
  for (const item of next.items || []) if (isDate(item.day) && item.time && activityInstant({ date: item.day, time: item.time, time_zone: item.timeZone || next.timeZone || 'UTC' }) === null) throw new Error(`The time for ${item.name} does not exist on its new date because the clocks change. Adjust its time first.`);
  for (const segment of next.transport || []) {
    if (segment.draft) continue;
    const instant = leg => activityInstant({ date: segment[`${leg}_date`], time: segment[`${leg}_time`], time_zone: segment[`${leg}_time_zone`] });
    const departure = instant('departure'), arrival = instant('arrival');
    if (departure === null || arrival === null || arrival <= departure) throw new Error(`Check the local times for ${segment.service_id} before moving these dates.`);
  }
  return next;
}
