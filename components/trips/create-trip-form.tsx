"use client";

import { useActionState } from "react";
import { createTrip, type CreateTripState } from "@/app/actions/trips";
import { currencies } from "@/lib/domain";

const initialState: CreateTripState = {};

export function CreateTripForm({ workspaceAvailable = true }: { workspaceAvailable?: boolean }) {
  const [state, formAction, isPending] = useActionState(createTrip, initialState);

  return (
    <form action={formAction} className="space-y-7">
      {state.error && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {state.error}{state.error.includes("Sign in") && <> <a href="/login" className="font-semibold underline">Sign in</a> or <a href="/signup" className="font-semibold underline">create an account</a>.</>}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="title" className="block text-sm font-semibold text-ink dark:text-white">Trip name</label>
        <input
          id="title"
          name="title"
          type="text"
          placeholder="A week in the sun"
          maxLength={100}
          required
          className="form-input"
        />
        <p className="text-xs text-slate-500 dark:text-slate-400">Give this trip a name you’ll recognize.</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="destination" className="block text-sm font-semibold text-ink dark:text-white">Where are you going?</label>
        <div className="relative">
          <span aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg">⌖</span>
          <input
            id="destination"
            name="destination"
            type="text"
            placeholder="City, country or region"
            maxLength={120}
            required
            className="form-input pl-11"
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor="startDate" className="block text-sm font-semibold text-ink dark:text-white">Departure</label>
          <input id="startDate" name="startDate" type="date" required className="form-input" />
        </div>
        <div className="space-y-2">
          <label htmlFor="endDate" className="block text-sm font-semibold text-ink dark:text-white">Return</label>
          <input id="endDate" name="endDate" type="date" required className="form-input" />
        </div>
      </div>

      {workspaceAvailable && <><div className="space-y-2">
        <label htmlFor="timeZone" className="block text-sm font-semibold">Destination time zone</label>
        <select id="timeZone" name="timeZone" defaultValue="UTC" required className="form-input">
          <option value="UTC">UTC</option>
          {Intl.supportedValuesOf("timeZone").map((zone) => <option key={zone} value={zone}>{zone.replaceAll("_", " ")}</option>)}
        </select>
        <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">Choose your destination’s zone so Today and your plans show the right local day.</p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2"><label htmlFor="currency" className="block text-sm font-semibold">Trip currency</label><select id="currency" name="currency" defaultValue="USD" className="form-input">{currencies.map((currency) => <option key={currency}>{currency}</option>)}</select></div>
        <div className="space-y-2"><label htmlFor="budget" className="block text-sm font-semibold">Budget (optional)</label><input id="budget" name="budget" inputMode="decimal" className="form-input" placeholder="No limit set" /></div>
      </div></>}

      <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
        <a href="/dashboard" className="secondary-button">
          Cancel
        </a>
        <button type="submit" disabled={isPending} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-forest px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#204f3b] focus:outline-none focus:ring-4 focus:ring-forest/20 disabled:cursor-wait disabled:opacity-70">
          {isPending ? "Creating trip…" : "Create trip"}
          {!isPending && <span aria-hidden="true">→</span>}
        </button>
      </div>
    </form>
  );
}
