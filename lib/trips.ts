import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Trip = {
  id: string;
  title: string;
  destination: string;
  start_date: string;
  end_date: string;
};

export async function getTrip(id: string): Promise<Trip> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data, error } = await supabase
    .from("trips")
    .select("id, title, destination, start_date, end_date")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (error || !data) notFound();
  return data;
}

export function formatTripDates(start: string, end: string) {
  const format = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
  return `${format(start)} – ${format(end)}`;
}
