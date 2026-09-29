// Platform-independent rules shared by the web app and future native clients.
export const currencies = ["USD", "EUR", "GBP", "INR", "JPY", "AUD", "CAD", "CHF", "SGD", "NZD", "CNY", "THB", "KRW", "BHD"] as const;
export const activityCategories = ["Activity", "Flight", "Stay", "Transport", "Food"] as const;
export const expenseCategories = ["Transport", "Stay", "Food", "Activities", "Shopping", "Other"] as const;
export const packingCategories = ["Essentials", "Clothing", "Toiletries", "Electronics", "Other"] as const;

export type Trip = {
  id: string; title: string; destination: string; start_date: string; end_date: string;
  time_zone: string; currency: string; budget_minor: number | null;
};
export type Activity = {
  id: string; trip_id: string; title: string; category: string; date: string;
  time: string | null; time_zone: string; location: string; notes: string;
};
export type Expense = {
  id: string; trip_id: string; title: string; amount_minor: number;
  category: string; date: string; notes: string;
};
export type PackingItem = { id: string; trip_id: string; name: string; category: string; packed: boolean };
export type ActionState = { error?: string; success?: string };

export function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.slice(0, 4) < "1900" || value.slice(0, 4) > "2200") return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isTimeZone(value: string): boolean {
  if (!value || value.length > 100 || /^[+-]/.test(value)) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return !!value; }
  catch { return false; }
}

export function currencyDigits(currency: string): number {
  if (!currencies.some((value) => value === currency)) throw new Error("Choose a supported currency.");
  return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
}

export function parseMoney(value: string, currency: string): number | null {
  const digits = currencyDigits(currency);
  if (!/^\d+(?:\.\d+)?$/.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > digits) return null;
  const amount = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, "0"));
  return Number.isSafeInteger(amount) && amount <= 1_000_000_000_000 ? amount : null;
}

export function moneyInput(amount: number | null, currency: string): string {
  return amount === null ? "" : (amount / 10 ** currencyDigits(currency)).toFixed(currencyDigits(currency));
}

export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat("en", { style: "currency", currency }).format(amount / 10 ** currencyDigits(currency));
}

export function formatDate(value: string, options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }): string {
  return new Intl.DateTimeFormat("en", { ...options, timeZone: "UTC" }).format(new Date(`${value}T12:00:00Z`));
}

export function formatTripDates(start: string, end: string): string {
  const format = (value: string) => formatDate(value, { month: "short", day: "numeric", year: "numeric" });
  return `${format(start)} – ${format(end)}`;
}

export function dateInZone(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (name: string) => parts.find((value) => value.type === name)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function activityInstant(activity: Pick<Activity, "date" | "time" | "time_zone">): number | null {
  if (!activity.time) return null;
  // Resolve wall-clock time using the zone's offset, including daylight-saving changes.
  const wall = Date.parse(`${activity.date}T${activity.time.slice(0, 5)}:00Z`);
  let instant = wall;
  for (let index = 0; index < 3; index++) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: activity.time_zone, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(instant));
    const part = (name: string) => parts.find((value) => value.type === name)?.value;
    const local = Date.parse(`${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}:${part("second")}Z`);
    if (local === wall) return instant;
    instant += wall - local;
  }
  return null; // A nonexistent local time during a daylight-saving transition.
}

export function nextActivity(activities: Activity[], now = new Date()): Activity | undefined {
  return activities.map((activity) => ({ activity, at: activityInstant(activity) }))
    .filter((entry): entry is { activity: Activity; at: number } => entry.at !== null && entry.at >= now.getTime())
    .sort((a, b) => a.at - b.at)[0]?.activity;
}
