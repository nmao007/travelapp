"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { activityCategories, expenseCategories, packingCategories, isDate, isTimeZone, parseMoney, activityInstant, type ActionState } from "@/lib/domain";

const field = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const validId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

async function context(form: FormData) {
  const tripId = field(form, "tripId");
  if (!validId(tripId)) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: trip, error } = await supabase.from("trips").select("id,start_date,end_date,time_zone,currency").eq("id", tripId).eq("user_id", user.id).maybeSingle();
  return error || !trip ? null : { supabase, trip, tripId };
}

async function save(form: FormData, table: "activities" | "expenses" | "packing_items", values: Record<string, unknown>, ctx: NonNullable<Awaited<ReturnType<typeof context>>>): Promise<ActionState> {
  const id = field(form, "id");
  if (id && !validId(id)) return { error: "This item is unavailable." };
  const query = id
    ? ctx.supabase.from(table).update(values).eq("id", id).eq("trip_id", ctx.tripId)
    : ctx.supabase.from(table).insert({ ...values, trip_id: ctx.tripId });
  const { data, error } = await query.select("id").maybeSingle();
  if (error || !data) return { error: "We couldn’t save this item. Please try again." };
  revalidatePath(`/trip/${ctx.tripId}`, "layout");
  return { success: id ? "Changes saved." : "Item added." };
}

export async function saveActivity(_state: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await context(form);
  if (!ctx) return { error: "Sign in to an available trip to save changes." };
  const title = field(form, "title"), date = field(form, "date"), time = field(form, "time");
  const category = field(form, "category"), location = field(form, "location"), notes = field(form, "notes");
  const time_zone = field(form, "timeZone") || ctx.trip.time_zone;
  if (!title || title.length > 160 || location.length > 300 || notes.length > 4000) return { error: "Add a title and keep your details within the character limits." };
  if (!activityCategories.some((value) => value === category)) return { error: "Choose an activity category." };
  if ((category === "Flight" || category === "Transport") && !field(form, "id")) return { error: "Add flights and trains with the transportation form so both local times are included." };
  if (!isDate(date) || date < ctx.trip.start_date || date > ctx.trip.end_date) return { error: "Choose a date within your trip." };
  if (!isTimeZone(time_zone) || (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) return { error: "Choose a valid time and time zone." };
  if (time && activityInstant({ date, time, time_zone }) === null) return { error: "That local time does not exist because the clocks change. Choose another time." };
  return save(form, "activities", { title, category, date, time: time || null, time_zone, location, notes }, ctx);
}

export async function saveTripDestination(_state: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await context(form);
  if (!ctx) return { error: "Sign in to an available trip to add a destination." };
  const name = field(form, "name"), date = field(form, "date");
  if (!name || name.length > 160 || !isDate(date) || date < ctx.trip.start_date || date > ctx.trip.end_date) {
    return { error: "Add a destination and choose a date within this trip." };
  }
  const { error } = await ctx.supabase.from("trip_destinations").insert({ trip_id: ctx.tripId, name, date });
  if (error) return { error: "We couldn’t add that destination. Please try again." };
  revalidatePath(`/trip/${ctx.tripId}`, "layout");
  return { success: "Destination added to the itinerary." };
}

export async function deleteTripDestination(_state: ActionState, form: FormData): Promise<ActionState> {
  const id = field(form, "id");
  if (!validId(id)) return { error: "This destination is unavailable." };
  const ctx = await context(form);
  if (!ctx) return { error: "Sign in to an available trip to remove a destination." };
  const { data, error } = await ctx.supabase.from("trip_destinations").delete().eq("id", id).eq("trip_id", ctx.tripId).eq("is_primary", false).select("id").maybeSingle();
  if (error || !data) return { error: "The main destination can’t be removed, or this stop is no longer available." };
  revalidatePath(`/trip/${ctx.tripId}`, "layout");
  return { success: "Destination removed." };
}

export async function saveTransportSegment(_state: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await context(form);
  if (!ctx) return { error: "Sign in to an available trip to save transportation." };
  const id = field(form, "id"), mode = field(form, "mode");
  const service_id = field(form, "serviceId"), departure_location = field(form, "departureLocation"), arrival_location = field(form, "arrivalLocation");
  const departure_date = field(form, "departureDate"), departure_time = field(form, "departureTime"), departure_time_zone = field(form, "departureTimeZone");
  const arrival_date = field(form, "arrivalDate"), arrival_time = field(form, "arrivalTime"), arrival_time_zone = field(form, "arrivalTimeZone"), notes = field(form, "notes");
  if (id && !validId(id)) return { error: "This transportation item is unavailable." };
  if (!["Flight", "Train"].includes(mode)) return { error: "Choose a flight or train." };
  if (!service_id || service_id.length > 40 || !departure_location || !arrival_location || departure_location.length > 240 || arrival_location.length > 240 || notes.length > 4000) {
    return { error: "Add the flight or train ID and both locations, within the character limits." };
  }
  const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  if (!isDate(departure_date) || !isDate(arrival_date) || departure_date < ctx.trip.start_date || arrival_date > ctx.trip.end_date || arrival_date < departure_date || !validTime(departure_time) || !validTime(arrival_time) || !isTimeZone(departure_time_zone) || !isTimeZone(arrival_time_zone)) {
    return { error: "Choose valid dates, local times, and time zones within this trip." };
  }
  const depInstant = activityInstant({ date: departure_date, time: departure_time, time_zone: departure_time_zone });
  const arrInstant = activityInstant({ date: arrival_date, time: arrival_time, time_zone: arrival_time_zone });
  if (depInstant === null || arrInstant === null || arrInstant <= depInstant) return { error: "Arrival must be after departure in the local time zones. Check for a daylight-saving time change." };
  const values = { mode, service_id, departure_location, arrival_location, departure_date, departure_time, departure_time_zone, arrival_date, arrival_time, arrival_time_zone, notes };
  const query = id
    ? ctx.supabase.from("transport_segments").update(values).eq("id", id).eq("trip_id", ctx.tripId)
    : ctx.supabase.from("transport_segments").insert({ ...values, trip_id: ctx.tripId });
  const { data, error } = await query.select("id").maybeSingle();
  if (error || !data) return { error: "We couldn’t save this transportation item. Please try again." };
  revalidatePath(`/trip/${ctx.tripId}`, "layout");
  return { success: id ? "Transportation details saved." : "Transportation added to your itinerary." };
}

export async function deleteTransportSegment(_state: ActionState, form: FormData): Promise<ActionState> {
  const id = field(form, "id");
  if (!validId(id)) return { error: "This transportation item is unavailable." };
  const ctx = await context(form);
  if (!ctx) return { error: "Sign in to an available trip to remove transportation." };
  const { data, error } = await ctx.supabase.from("transport_segments").delete().eq("id", id).eq("trip_id", ctx.tripId).select("id").maybeSingle();
  if (error || !data) return { error: "We couldn’t remove this transportation item. Please try again." };
  revalidatePath(`/trip/${ctx.tripId}`, "layout");
  return { success: "Transportation removed." };
}

export async function saveExpense(_state: ActionState, form: FormData): Promise<ActionState> {
  const ctx = await context(form);
  if (!ctx) return { error: "Sign in to an available trip to save changes." };
  const title = field(form, "title"), date = field(form, "date"), category = field(form, "category"), notes = field(form, "notes");
  const amount_minor = parseMoney(field(form, "amount"), ctx.trip.currency);
  if (!title || title.length > 160 || notes.length > 4000) return { error: "Add an expense name and keep your details within the character limits." };
  if (amount_minor === null || amount_minor <= 0) return { error: "Enter a positive amount with the correct decimal places for your trip currency." };
  if (!isDate(date) || !expenseCategories.some((value) => value === category)) return { error: "Choose a valid date and category." };
  return save(form, "expenses", { title, date, category, notes, amount_minor, currency: ctx.trip.currency }, ctx);
}

export async function savePackingItem(_state: ActionState, form: FormData): Promise<ActionState> {
  const name = field(form, "name"), category = field(form, "category");
  if (!name || name.length > 160 || !packingCategories.some((value) => value === category)) return { error: "Add an item name and choose a category." };
  const ctx = await context(form);
  if (!ctx) return { error: "Sign in to an available trip to save changes." };
  return save(form, "packing_items", { name, category }, ctx);
}

export async function togglePackingItem(_state: ActionState, form: FormData): Promise<ActionState> {
  const packed = field(form, "packed");
  if (!field(form, "id") || !["true", "false"].includes(packed)) return { error: "This item is unavailable." };
  const ctx = await context(form);
  if (!ctx) return { error: "Sign in to an available trip to save changes." };
  return save(form, "packing_items", { packed: packed === "true" }, ctx);
}

export async function deleteItem(_state: ActionState, form: FormData): Promise<ActionState> {
  const table = field(form, "table");
  if (!["activities", "expenses", "packing_items"].includes(table) || !validId(field(form, "id"))) return { error: "This item is unavailable." };
  const ctx = await context(form);
  if (!ctx) return { error: "Sign in to an available trip to save changes." };
  const { data, error } = await ctx.supabase.from(table).delete().eq("id", field(form, "id")).eq("trip_id", ctx.tripId).select("id").maybeSingle();
  if (error || !data) return { error: "We couldn’t remove this item. Please try again." };
  revalidatePath(`/trip/${ctx.tripId}`, "layout");
  return { success: "Item removed." };
}
