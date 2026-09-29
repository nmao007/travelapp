import { activityCategories, expenseCategories, packingCategories, currencies, isDate, isTimeZone, parseMoney, activityInstant, type Trip, type Activity, type Expense, type PackingItem } from "./domain.ts";

export type PreviewStore = { version: 1; trip: Trip | null; activities: Activity[]; expenses: Expense[]; items: PackingItem[] };

export function sampleTrip(): PreviewStore {
  const trip: Trip = { id: "11111111-1111-1111-1111-111111111111", title: "Tokyo, at your pace", destination: "Tokyo, Japan", start_date: "2026-09-27", end_date: "2026-10-01", time_zone: "Asia/Tokyo", currency: "JPY", budget_minor: 180000 };
  return { version: 1, trip, activities: [
    { id: "44444444-4444-4444-4444-444444444444", trip_id: trip.id, title: "A slow morning in Asakusa", category: "Activity", date: trip.start_date, time: "10:00", time_zone: trip.time_zone, location: "Senso-ji, Asakusa, Tokyo", notes: "Start at the temple, then find a quiet spot for coffee." },
    { id: "77777777-7777-7777-7777-777777777777", trip_id: trip.id, title: "Check in and settle in", category: "Stay", date: trip.start_date, time: "15:00", time_zone: trip.time_zone, location: "Shinjuku, Tokyo", notes: "Sample confirmation: TOKYO-123. Check-in from 15:00." },
    { id: "88888888-8888-8888-8888-888888888888", trip_id: trip.id, title: "Dinner with a view", category: "Food", date: trip.start_date, time: "19:30", time_zone: trip.time_zone, location: "Shibuya, Tokyo", notes: "Leave time to explore the neighborhood." },
  ], expenses: [
    { id: "55555555-5555-5555-5555-555555555555", trip_id: trip.id, title: "Airport train tickets", amount_minor: 6500, category: "Transport", date: trip.start_date, notes: "Two tickets" },
    { id: "99999999-9999-9999-9999-999999999999", trip_id: trip.id, title: "First night in Shinjuku", amount_minor: 18000, category: "Stay", date: trip.start_date, notes: "Paid in advance" },
  ], items: [
    { id: "66666666-6666-6666-6666-666666666666", trip_id: trip.id, name: "Passport", category: "Essentials", packed: true },
    { id: "abababab-abab-abab-abab-abababababab", trip_id: trip.id, name: "Travel adapter", category: "Electronics", packed: false },
    { id: "cdcdcdcd-cdcd-cdcd-cdcd-cdcdcdcdcdcd", trip_id: trip.id, name: "Comfortable walking shoes", category: "Clothing", packed: true },
  ] };
}

// A local sample reducer; it never creates accounts, accesses Supabase or changes real trips.
export function applyPreviewOperation(store: PreviewStore, operation: string, form: FormData, newId: string): { store?: PreviewStore; error?: string } {
  const trip = store.trip;
  const field = (name: string) => String(form.get(name) ?? "").trim();
  if (!trip || field("tripId") !== trip.id) return { error: "This sample trip is unavailable." };
  const id = field("id"), title = field("title"), date = field("date"), category = field("category"), notes = field("notes");
  if (operation === "deleteTrip") return { store: { version: 1, trip: null, activities: [], expenses: [], items: [] } };
  if (operation === "updateTrip") {
    const destination = field("destination"), start_date = field("startDate"), end_date = field("endDate"), currency = field("currency"), time_zone = field("timeZone");
    if (!title || title.length > 100 || !destination || destination.length > 120) return { error: "Add a trip name and destination." };
    if (!isDate(start_date) || !isDate(end_date) || end_date < start_date) return { error: "Choose valid trip dates." };
    if (!isTimeZone(time_zone) || !currencies.some((value) => value === currency)) return { error: "Choose a valid time zone and currency." };
    if (currency !== trip.currency && store.expenses.length) return { error: "Keep the current currency while this trip has expenses." };
    if (store.activities.some((value) => value.date < start_date || value.date > end_date)) return { error: "Keep trip dates wide enough to include your plans." };
    const budget_minor = field("budget") ? parseMoney(field("budget"), currency) : null;
    if (field("budget") && budget_minor === null) return { error: "Enter a valid budget." };
    return { store: { ...store, trip: { ...trip, title, destination, start_date, end_date, currency, time_zone, budget_minor } } };
  }
  if (operation === "saveActivity") {
    const time = field("time"), time_zone = field("timeZone") || trip.time_zone, location = field("location");
    if (!title || title.length > 160 || notes.length > 4000 || location.length > 300 || !activityCategories.some((value) => value === category)) return { error: "Add a valid title, category, and details." };
    if (!isDate(date) || date < trip.start_date || date > trip.end_date) return { error: "Choose a date within your trip." };
    if (!isTimeZone(time_zone) || (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) return { error: "Choose a valid time and time zone." };
    if (time && activityInstant({ date, time, time_zone }) === null) return { error: "That local time does not exist because the clocks change." };
    if (id && !store.activities.some((value) => value.id === id)) return { error: "This plan is unavailable." };
    const value: Activity = { id: id || newId, trip_id: trip.id, title, category, date, time: time || null, time_zone, location, notes };
    return { store: { ...store, activities: id ? store.activities.map((old) => old.id === id ? value : old) : [...store.activities, value] } };
  }
  if (operation === "saveExpense") {
    const amount_minor = parseMoney(field("amount"), trip.currency);
    if (!title || title.length > 160 || notes.length > 4000 || !isDate(date) || !expenseCategories.some((value) => value === category)) return { error: "Add a valid expense name, date, and category." };
    if (amount_minor === null || amount_minor <= 0) return { error: "Enter a positive amount in the trip currency." };
    if (id && !store.expenses.some((value) => value.id === id)) return { error: "This expense is unavailable." };
    const value: Expense = { id: id || newId, trip_id: trip.id, title, date, category, notes, amount_minor };
    return { store: { ...store, expenses: id ? store.expenses.map((old) => old.id === id ? value : old) : [...store.expenses, value] } };
  }
  if (operation === "savePackingItem") {
    const name = field("name");
    if (!name || name.length > 160 || !packingCategories.some((value) => value === category)) return { error: "Add an item name and choose a category." };
    const old = store.items.find((value) => value.id === id);
    if (id && !old) return { error: "This item is unavailable." };
    const value: PackingItem = { id: id || newId, trip_id: trip.id, name, category, packed: old?.packed ?? false };
    return { store: { ...store, items: id ? store.items.map((old) => old.id === id ? value : old) : [...store.items, value] } };
  }
  if (operation === "togglePackingItem") {
    if (!store.items.some((value) => value.id === id) || !["true", "false"].includes(field("packed"))) return { error: "This item is unavailable." };
    return { store: { ...store, items: store.items.map((value) => value.id === id ? { ...value, packed: field("packed") === "true" } : value) } };
  }
  if (operation === "deleteItem") {
    const key = { activities: "activities", expenses: "expenses", packing_items: "items" }[field("table")] as "activities" | "expenses" | "items" | undefined;
    if (!key || !store[key].some((value) => value.id === id)) return { error: "This item is unavailable." };
    return { store: { ...store, [key]: store[key].filter((value) => value.id !== id) } };
  }
  return { error: "This action is unavailable in the local preview." };
}
