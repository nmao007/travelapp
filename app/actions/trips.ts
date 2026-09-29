"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { currencies, isDate, isTimeZone, parseMoney, type ActionState } from "@/lib/domain";
import { getWorkspaceAvailability } from "@/lib/trips";
export type CreateTripState = ActionState;

const field = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

function tripFields(form: FormData) {
  const title = field(form, "title"), destination = field(form, "destination");
  const start_date = field(form, "startDate"), end_date = field(form, "endDate");
  const time_zone = field(form, "timeZone") || "UTC", currency = field(form, "currency") || "USD";
  if (!title || !destination || title.length > 100 || destination.length > 120) return { error: "Add a trip name and destination within the character limits." };
  if (!isDate(start_date) || !isDate(end_date) || end_date < start_date) return { error: "Choose valid dates with your return on or after departure." };
  if (!isTimeZone(time_zone) || !currencies.some((value) => value === currency)) return { error: "Choose a valid time zone and currency." };
  const budgetText = field(form, "budget");
  const budget_minor = budgetText ? parseMoney(budgetText, currency) : null;
  if (budgetText && budget_minor === null) return { error: "Enter a valid budget in the selected currency." };
  return { values: { title, destination, start_date, end_date, time_zone, currency, budget_minor } };
}

export async function createTrip(_state: ActionState, form: FormData): Promise<ActionState> {
  const parsed = tripFields(form);
  if (!parsed.values) return { error: parsed.error };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to save your trip." };
  const available = await getWorkspaceAvailability();
  const { title, destination, start_date, end_date } = parsed.values;
  const values = available ? parsed.values : { title, destination, start_date, end_date };
  const { data, error } = await supabase.from("trips").insert({ user_id: user.id, ...values }).select("id").single();
  if (error || !data) return { error: "We couldn’t save your trip. Please try again." };
  revalidatePath("/dashboard");
  redirect(`/trip/${data.id}`);
}

export async function updateTrip(_state: ActionState, form: FormData): Promise<ActionState> {
  const id = field(form, "tripId"), parsed = tripFields(form);
  if (!parsed.values) return { error: parsed.error };
  const { start_date, end_date, currency } = parsed.values;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to update your trip." };
  const available = await getWorkspaceAvailability();
  const { data: trip, error: tripError } = await supabase.from("trips").select("*").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (tripError || !trip) return { error: "This trip is unavailable." };
  if (available && trip.currency !== currency) {
    const { count, error } = await supabase.from("expenses").select("id", { count: "exact", head: true }).eq("trip_id", id);
    if (error) return { error: "We couldn’t check your expenses. Please try again." };
    if (count) return { error: "Keep your current currency while this trip has expenses. Currency conversion is not available yet." };
  }
  if (available) {
    const { count, error: datesError } = await supabase.from("activities").select("id", { count: "exact", head: true }).eq("trip_id", id).or(`date.lt.${start_date},date.gt.${end_date}`);
    if (datesError) return { error: "We couldn’t check your itinerary. Please try again." };
    if (count) return { error: "Some itinerary items fall outside these dates. Move those items first or keep a wider date range." };
  }
  const { title, destination } = parsed.values;
  const values = available ? parsed.values : { title, destination, start_date, end_date };
  const { data, error } = await supabase.from("trips").update(values).eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
  if (error || !data) return { error: "We couldn’t update your trip. Please try again." };
  revalidatePath(`/trip/${id}`, "layout");
  revalidatePath("/dashboard");
  return { success: "Trip settings saved." };
}

export async function deleteTrip(_state: ActionState, form: FormData): Promise<ActionState> {
  const id = field(form, "tripId");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to delete your trip." };
  const { data, error } = await supabase.from("trips").delete().eq("id", id).eq("user_id", user.id).select("id").maybeSingle();
  if (error || !data) return { error: "We couldn’t delete this trip. Please try again." };
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
