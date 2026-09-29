import { sampleTrip } from "./preview.ts";
import { isDate, isTimeZone, parseMoney, activityInstant, activityCategories, expenseCategories, packingCategories, type Activity, type Expense, type PackingItem, type Trip } from "./domain.ts";

export type Phase = "before" | "during" | "after";
export type Place = { id: string; name: string; area: string; category: string; description: string; saved: boolean };
export type Booking = { id: string; title: string; kind: "Flight" | "Stay" | "Transport"; reference: string; date: string; time: string; time_zone: string; location: string; notes: string; activity_id?: string };
export type Task = { id: string; title: string; group: "Documents" | "Travel" | "Home" | "Return"; done: boolean };
export type Note = { id: string; title: string; text: string };
export type JourneyState = { version: 2; selected_day?: string; trip: Trip; activities: Activity[]; expenses: Expense[]; packing: PackingItem[]; places: Place[]; bookings: Booking[]; tasks: Task[]; notes: Note[]; phase: Phase };
export type Capture = "activity" | "expense" | "booking" | "packing" | "task" | "note";

export function initialJourney(): JourneyState {
  const sample = sampleTrip();
  return { version: 2, trip: sample.trip!, activities: sample.activities, expenses: sample.expenses, packing: sample.items, phase: "during", places: [
    { id: "senso", name: "Senso-ji", area: "Asakusa", category: "Culture", description: "Make a little time for a temple walk and the surrounding streets.", saved: true },
    { id: "garden", name: "Shinjuku Gyoen", area: "Shinjuku", category: "Nature", description: "A garden stop to leave some breathing room in your day.", saved: false },
    { id: "yanaka", name: "Yanaka Ginza", area: "Yanaka", category: "Neighborhoods", description: "Save an afternoon for wandering and a small snack along the way.", saved: false },
    { id: "ueno", name: "Ueno Park", area: "Ueno", category: "Nature", description: "An idea for an unhurried walk between your other plans.", saved: false },
    { id: "tsukiji", name: "Tsukiji Outer Market", area: "Tsukiji", category: "Food", description: "Keep a food stop on your list of ideas to explore.", saved: true },
    { id: "meiji", name: "Meiji Jingu", area: "Shibuya", category: "Culture", description: "A cultural stop to consider as you shape your day.", saved: false },
  ], bookings: [
    { id: "stay", title: "Your Shinjuku stay", kind: "Stay", reference: "SAMPLE-TKY123", date: "2026-09-27", time: "15:00", time_zone: "Asia/Tokyo", location: "Shinjuku, Tokyo", notes: "Sample reservation. Check-in details and the booking reference belong together.", activity_id: "77777777-7777-7777-7777-777777777777" },
    { id: "return", title: "Return flight home", kind: "Flight", reference: "SAMPLE-HOME48", date: "2026-10-01", time: "18:00", time_zone: "Asia/Tokyo", location: "Tokyo airport", notes: "Sample only. Add the actual airport, terminal, baggage allowance, and provider details when organizing a real trip." },
  ], tasks: [
    { id: "passport", title: "Review passport and entry requirements", group: "Documents", done: true },
    { id: "insurance", title: "Save your insurance and assistance details", group: "Documents", done: false },
    { id: "transfer", title: "Arrange the ride from home to the airport", group: "Travel", done: true },
    { id: "connect", title: "Plan how you’ll stay connected", group: "Travel", done: false },
    { id: "home", title: "Sort deliveries, pets, and home arrangements", group: "Home", done: false },
    { id: "meds", title: "Review medicines and travel preparations", group: "Documents", done: false },
    { id: "return-ride", title: "Arrange the journey home after landing", group: "Return", done: false },
    { id: "settle", title: "Review expenses and outstanding claims", group: "Return", done: false },
  ], notes: [{ id: "arrival", title: "Arrival reminders", text: "Keep the address of your stay and transport details close at hand. This is sample content." }] };
}

export function tripDays(trip: Trip): string[] {
  const days: string[] = [];
  for (let value = Date.parse(`${trip.start_date}T12:00:00Z`), end = Date.parse(`${trip.end_date}T12:00:00Z`); value <= end && days.length < 366; value += 86400000) days.push(new Date(value).toISOString().slice(0, 10));
  return days;
}

export function captureJourney(state: JourneyState, kind: Capture, form: FormData, newId: string): { state?: JourneyState; error?: string } {
  const field = (name: string) => String(form.get(name) ?? "").trim();
  const id = field("id") || newId, title = field("title"), date = field("date"), notes = field("notes");
  if (!title || title.length > 160 || notes.length > 4000) return { error: "Add a name and keep notes within 4,000 characters." };
  if (["activity", "booking", "expense"].includes(kind) && !isDate(date)) return { error: "Choose a valid date." };
  if (["activity", "booking"].includes(kind) && (date < state.trip.start_date || date > state.trip.end_date)) return { error: "Choose a date within the trip." };
  const time = field("time"), time_zone = field("timeZone") || state.trip.time_zone;
  if (["activity", "booking"].includes(kind) && (!isTimeZone(time_zone) || (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)))) return { error: "Choose a valid local time and time zone." };
  if (["activity", "booking"].includes(kind) && time && activityInstant({date,time,time_zone}) === null) return { error: "This local time does not exist in that time zone. Choose another time." };
  if (field("location").length > 300 || field("reference").length > 160) return { error: "Keep addresses within 300 characters and references within 160." };
  const allowed: Partial<Record<Capture, readonly string[]>> = { activity: activityCategories, expense: expenseCategories, packing: packingCategories, booking: ["Flight","Stay","Transport"], task: ["Documents","Travel","Home","Return"] };
  if (field("category") && allowed[kind] && !allowed[kind]!.includes(field("category"))) return { error: "Choose a supported category." };
  const replace = <T extends { id: string }>(list: T[], value: T) => list.some((old) => old.id === value.id) ? list.map((old) => old.id === value.id ? value : old) : [...list, value];
  if (kind === "activity") {
    const value: Activity = { id, trip_id: state.trip.id, title, category: field("category") || "Activity", date, time: time || null, time_zone, location: field("location"), notes };
    return { state: { ...state, activities: replace(state.activities, value) } };
  }
  if (kind === "expense") {
    const amount_minor = parseMoney(field("amount"), state.trip.currency);
    if (amount_minor === null || amount_minor <= 0) return { error: "Enter a positive amount in the trip currency." };
    const value: Expense = { id, trip_id: state.trip.id, title, date, amount_minor, category: field("category") || "Other", notes };
    return { state: { ...state, expenses: replace(state.expenses, value) } };
  }
  if (kind === "booking") {
    const old = state.bookings.find((booking) => booking.id === id);
    const value: Booking = { id, title, kind: (field("category") || "Stay") as Booking["kind"], date, time, time_zone, location: field("location"), reference: field("reference"), notes, activity_id: old?.activity_id };
    const activities = old?.activity_id ? state.activities.map((activity) => activity.id === old.activity_id ? { ...activity, title, category: value.kind, date, time: time || null, time_zone, location: value.location, notes: `${value.reference ? `Reference: ${value.reference}\n` : ""}${notes}` } : activity) : state.activities;
    return { state: { ...state, bookings: replace(state.bookings, value), activities } };
  }
  if (kind === "packing") return { state: { ...state, packing: replace(state.packing, { id, trip_id: state.trip.id, name: title, category: field("category") || "Essentials", packed: state.packing.find((item) => item.id === id)?.packed ?? false }) } };
  if (kind === "task") return { state: { ...state, tasks: replace(state.tasks, { id, title, group: (field("category") || "Travel") as Task["group"], done: state.tasks.find((task) => task.id === id)?.done ?? false }) } };
  if (kind === "note") return { state: { ...state, notes: replace(state.notes, { id, title, text: notes }) } };
  return { error: "Choose a supported action." };
}

export function addBookingToPlan(state: JourneyState, bookingId: string, newId: string): JourneyState {
  const booking = state.bookings.find((value) => value.id === bookingId);
  if (!booking || booking.activity_id) return state;
  return { ...state, bookings: state.bookings.map((value) => value.id === bookingId ? { ...value, activity_id: newId } : value), activities: [...state.activities, { id: newId, trip_id: state.trip.id, title: booking.title, category: booking.kind, date: booking.date, time: booking.time || null, time_zone: booking.time_zone, location: booking.location, notes: `${booking.reference ? `Reference: ${booking.reference}\n` : ""}${booking.notes}` }] };
}

export function searchJourney(state: JourneyState, query: string): { id: string; title: string; detail: string; section: string }[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const entries = [
    ...state.activities.map((value) => ({ id: value.id, title: value.title, detail: `Plan · ${value.date} · ${value.location} ${value.notes}`, section: "plan" })),
    ...state.bookings.map((value) => ({ id: value.id, title: value.title, detail: `Reservation · ${value.reference} ${value.location}`, section: "wallet" })),
    ...state.places.map((value) => ({ id: value.id, title: value.name, detail: `Place · ${value.area}`, section: "explore" })),
    ...state.tasks.map((value) => ({ id: value.id, title: value.title, detail: `Checklist · ${value.group}`, section: "plan" })),
    ...state.notes.map((value) => ({ id: value.id, title: value.title, detail: `Note · ${value.text}`, section: "tools" })),
    ...state.expenses.map((value) => ({ id: value.id, title: value.title, detail: `Expense · ${value.category}`, section: "wallet" })),
    ...state.packing.map((value) => ({ id: value.id, title: value.name, detail: `Packing · ${value.category}`, section: "tools" })),
  ];
  return entries.filter((entry) => `${entry.title} ${entry.detail}`.toLowerCase().includes(q)).slice(0, 30);
}
