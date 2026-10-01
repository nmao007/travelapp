// Generated from lib/domain.ts by prepare-shared.mjs.
// Platform-independent rules shared by the web app and future native clients.
export const currencies = ["USD", "EUR", "GBP", "INR", "JPY", "AUD", "CAD", "CHF", "SGD", "NZD", "CNY", "THB", "KRW", "BHD"]         ;
export const activityCategories = ["Activity", "Flight", "Stay", "Transport", "Food"]         ;
export const expenseCategories = ["Transport", "Stay", "Food", "Activities", "Shopping", "Other"]         ;
export const packingCategories = ["Essentials", "Clothing", "Toiletries", "Electronics", "Other"]         ;























export function isDate(value        )          {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.slice(0, 4) < "1900" || value.slice(0, 4) > "2200") return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isTimeZone(value        )          {
  if (!value || value.length > 100 || /^[+-]/.test(value)) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return !!value; }
  catch { return false; }
}

export function currencyDigits(currency        )         {
  if (!currencies.some((value) => value === currency)) throw new Error("Choose a supported currency.");
  return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

export function parseMoney(value        , currency        )                {
  const digits = currencyDigits(currency);
  if (!/^\d+(?:\.\d+)?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > digits) return null;
  const amount = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, "0"));
  return Number.isSafeInteger(amount) && amount <= 1_000_000_000_000 ? amount : null;
}

export function moneyInput(amount               , currency        )         {
  return amount === null ? "" : (amount / 10 ** currencyDigits(currency)).toFixed(currencyDigits(currency));
}

export function formatMoney(amount        , currency        )         {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(amount / 10 ** currencyDigits(currency));
}

export function formatDate(value        , options                             = { month: "short", day: "numeric" })         {
  return new Intl.DateTimeFormat("en", { ...options, timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

export function formatTripDates(start        , end        )         {
  const format = (value        ) => formatDate(value, { month: "short", day: "numeric", year: "numeric" });
  return `${format(start)} – ${format(end)}`;
}

export function dateInZone(timeZone        , now = new Date())         {
  const parts = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (name        ) => parts.find((value) => value.type === name)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function activityInstant(activity                                               )                {
  if (!activity.time) return null;
  // Resolve wall-clock time using the zone's offset, including daylight-saving changes.
  const wall = Date.parse(`${activity.date}T${activity.time.slice(0, 5)}:00Z`);
  let instant = wall;
  for (let index = 0; index < 3; index++) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: activity.time_zone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(instant));
    const part = (name        ) => parts.find((value) => value.type === name)?.value;
    const local = Date.parse(`${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}Z`);
    if (local === wall) return instant;
    instant += wall - local;
  }
  return null; // A nonexistent local time during a daylight-saving transition.
}

export function nextActivity(activities            , now = new Date())                       {
  return activities.map((activity) => ({ activity, at: activityInstant(activity) }))
    .filter((entry)                                              => entry.at !== null && entry.at >= now.getTime())
    .sort((a, b) => a.at - b.at)[0]?.activity;
}
