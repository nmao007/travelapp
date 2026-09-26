"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string };

function safeNextPath(value: FormDataEntryValue | null) {
  const path = typeof value === "string" ? value : "";
  return path.startsWith("/") && !path.startsWith("//") ? path : "/dashboard";
}

export async function signIn(_state: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Enter your email and password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "That email and password combination didn’t work." };
  redirect(safeNextPath(formData.get("next")));
}

export async function signUp(_state: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || password.length < 8) return { error: "Enter a valid email and a password with at least 8 characters." };
  const supabase = await createClient();
  const requestHeaders = await headers();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? requestHeaders.get("origin") ?? "http://localhost:3000";
  const next = safeNextPath(formData.get("next"));
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) return { error: error.message };
  if (data.session) redirect(next);
  return { message: "Check your email for a confirmation link to finish creating your account." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
