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
  if (!isDate(date) || date < ctx.trip.start_date || date > ctx.trip.end_date) return { error: "Choose a date within your trip." };
  if (!isTimeZone(time_zone) || (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) return { error: "Choose a valid time and time zone." };
  if (time && activityInstant({ date, time, time_zone }) === null) return { error: "That local time does not exist because the clocks change. Choose another time." };
  return save(form, "activities", { title, category, date, time: time || null, time_zone, location, notes }, ctx);
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
