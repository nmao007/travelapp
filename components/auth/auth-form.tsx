"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, signUp, type AuthState } from "@/app/actions/auth";

const initial: AuthState = {};

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const action = mode === "login" ? signIn : signUp;
  const [state, formAction, pending] = useActionState(action, initial);
  const signup = mode === "signup";

  return <form action={formAction} className="space-y-5">
    {state.error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{state.error}</p>}
    {state.message && <p role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">{state.message}</p>}
    <div className="space-y-2"><label htmlFor="email" className="block text-sm font-semibold">Email</label><input id="email" name="email" type="email" autoComplete="email" required className="form-input" placeholder="you@example.com" /></div>
    <div className="space-y-2"><label htmlFor="password" className="block text-sm font-semibold">Password</label><input id="password" name="password" type="password" autoComplete={signup ? "new-password" : "current-password"} minLength={signup ? 8 : undefined} required className="form-input" placeholder={signup ? "At least 8 characters" : "Your password"} /></div>
    <button disabled={pending} className="flex min-h-12 w-full items-center justify-center rounded-xl bg-forest px-5 text-sm font-semibold text-white transition hover:bg-[#204f3b] disabled:opacity-60">{pending ? "Please wait…" : signup ? "Create account" : "Sign in"}</button>
    <p className="text-center text-sm text-slate-500">{signup ? "Already have an account? " : "New to TripPilot? "}<Link className="font-semibold text-forest hover:underline" href={signup ? "/login" : "/signup"}>{signup ? "Sign in" : "Create an account"}</Link></p>
  </form>;
}
