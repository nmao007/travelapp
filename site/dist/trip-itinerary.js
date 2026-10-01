// Generated from lib/trip-itinerary.ts by prepare-shared.mjs.
import { activityInstant,                                      } from "./domain.js";






export function tripDates(start        , end        )           {
  const first = new Date(`${start}T12:00:00Z`);
  const last = new Date(`${end}T12:00:00Z`);
  if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime()) || first > last) return [];
  const dates           = [];
  for (const date = first; date <= last; date.setUTCDate(date.getUTCDate() + 1)) dates.push(date.toISOString().slice(0, 10));
  return dates;
}

export function tripCalendarMonths(start        , end        )                      {
  const dates = tripDates(start, end);
  if (!dates.length) return [];
  const months                      = [];
  const cursor = new Date(`${dates[0]}T12:00:00Z`);
  const final = new Date(`${dates[dates.length - 1]}T12:00:00Z`);
  while (cursor <= final) {
    const year = cursor.getUTCFullYear(), month = cursor.getUTCMonth();
    const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const cells                    = Array(new Date(Date.UTC(year, month, 1)).getUTCDay()).fill(null);
    for (let day = 1; day <= count; day++) {
      const value = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push(value >= start && value <= end ? value : null);
    }
    while (cells.length % 7) cells.push(null);
    months.push({ key: `${year}-${String(month + 1).padStart(2, "0")}`, label: new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(cursor), cells });
    cursor.setUTCDate(1);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return months;
}

export function eventsForTripDay(date        , activities            , transport                    )                       {
  const events                       = activities.filter((activity) => activity.date === date).map((activity) => ({
    kind: "activity", id: activity.id,
    at: activity.time ? activityInstant(activity) : null,
    activity,
  }));
  for (const segment of transport) {
    if (segment.departure_date === date) {
      events.push({ kind: "transport", id: segment.id, at: activityInstant({ date, time: segment.departure_time, time_zone: segment.departure_time_zone }) ?? Number.MAX_SAFE_INTEGER, transport: segment, leg: "departure" });
    } else if (segment.arrival_date === date) {
      events.push({ kind: "transport", id: segment.id, at: activityInstant({ date, time: segment.arrival_time, time_zone: segment.arrival_time_zone }) ?? Number.MAX_SAFE_INTEGER, transport: segment, leg: "arrival" });
    }
  }
  return events.sort((a, b) => {
    if (a.at === null) return b.at === null ? 0 : 1;
    if (b.at === null) return -1;
    return a.at - b.at;
  });
}
