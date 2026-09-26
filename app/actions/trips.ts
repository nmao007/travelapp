"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CreateTripState = { error?: string };

export async function createTrip(
  _previousState: CreateTripState,
  formData: FormData,
): Promise<CreateTripState> {
  const title = String(formData.get("title") ?? "").trim();
  const destination = String(formData.get("destination") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "");
  const endDate = String(formData.get("endDate") ?? "");

  if (!title || !destination || !startDate || !endDate) {
    return { error: "Fill in each field to create your trip." };
  }
  if (title.length > 100 || destination.length > 120) {
    return { error: "Trip name or destination is too long." };
  }
  if (endDate < startDate) {
    return { error: "Your return date must be on or after your departure date." };
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Sign in to save your trip." };
  }

  const { data, error } = await supabase
    .from("trips")
    .insert({
      user_id: user.id,
      title,
      destination,
      start_date: startDate,
      end_date: endDate,
    })
    .select("id")
    .single();

  /*if (error || !data) {
    return { error: "We couldn't save your trip. Please try again." };
  }*/


  if (error) {
    console.error(error);
    return { error: error.message };
  }

  if (!data) {
    return { error: "No data returned from Supabase." };
  }

  redirect(`/trip/${data.id}`);
}
