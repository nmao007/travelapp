import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { type Trip, type Activity, type Expense, type PackingItem } from "@/lib/domain";
export { formatTripDates } from "@/lib/domain";

export type { Trip } from "@/lib/domain";

export async function getWorkspaceAvailability(): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("trips").select("time_zone,currency,budget_minor").limit(0);
  if (!error) return true;
  if (["42703", "PGRST204"].includes(error.code)) return false;
  throw new Error("Unable to check trip availability.");
}

export async function getTrip(id: string): Promise<Trip & { workspace_available: boolean }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data, error } = await supabase
    .from("trips")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (error?.code === "PGRST116") notFound();
  if (error) throw new Error("Unable to load your trip.");
  if (!data) notFound();
  return {
    id: data.id, title: data.title, destination: data.destination, start_date: data.start_date, end_date: data.end_date,
    time_zone: data.time_zone ?? "UTC", currency: data.currency ?? "USD", budget_minor: data.budget_minor ?? null,
    workspace_available: "time_zone" in data && "currency" in data && "budget_minor" in data,
  };
}

async function getRecords<T>(tripId: string, table: string, columns: string, order: string): Promise<T[]> {
  const supabase = await createClient();
  const records: T[] = [];
  // Avoid silently truncating totals at the Data API's per-request row limit.
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from(table).select(columns).eq("trip_id", tripId).order(order).order("created_at").order("id").range(offset, offset + 499);
    if (error) throw new Error("Unable to load trip details.");
    records.push(...(data ?? []) as T[]);
    if (!data || data.length < 500) return records;
  }
}

export const getActivities = (tripId: string) => getRecords<Activity>(tripId, "activities", "id,trip_id,title,category,date,time,time_zone,location,notes", "date");
export const getExpenses = (tripId: string) => getRecords<Expense>(tripId, "expenses", "id,trip_id,title,amount_minor,category,date,notes", "date");
export const getPackingItems = (tripId: string) => getRecords<PackingItem>(tripId, "packing_items", "id,trip_id,name,category,packed", "category");
