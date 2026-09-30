import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { type Trip, type Activity, type Expense, type PackingItem, type TripDestination, type TransportSegment } from "@/lib/domain";
export { formatTripDates } from "@/lib/domain";

export type { Trip } from "@/lib/domain";

export async function getWorkspaceAvailability(): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("trips").select("time_zone,currency,budget_minor").limit(0);
  if (!error) return true;
  if (["42703", "PGRST204"].includes(error.code)) return false;
  throw new Error("Unable to check trip availability.");
}

export async function getItineraryAvailability(): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("trip_destinations").select("id").limit(0);
  if (!error) {
    const transport = await supabase.from("transport_segments").select("id").limit(0);
    if (!transport.error) return true;
    if (["42P01", "PGRST205"].includes(transport.error.code)) return false;
    throw new Error("Unable to check itinerary availability.");
  }
  if (["42P01", "PGRST205"].includes(error.code)) return false;
  throw new Error("Unable to check itinerary availability.");
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
export const getTripDestinations = (tripId: string) => getRecords<TripDestination>(tripId, "trip_destinations", "id,trip_id,name,date,is_primary", "date");
export const getTransportSegments = (tripId: string) => getRecords<TransportSegment>(tripId, "transport_segments", "id,trip_id,mode,service_id,departure_location,arrival_location,departure_date,departure_time,departure_time_zone,arrival_date,arrival_time,arrival_time_zone,notes", "departure_date");
