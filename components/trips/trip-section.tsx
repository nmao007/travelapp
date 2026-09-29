import Link from "next/link";
import type { ReactNode } from "react";
import { formatTripDates } from "@/lib/domain";
import type { Trip } from "@/lib/domain";
import { TripNav } from "@/components/trips/trip-nav";

export function TripSection({ trip, active, title, description, children, basePath }: {
  trip: Trip; active: string; title: string; description: string; children: ReactNode; basePath?: string;
}) {
  return <main className="min-h-screen bg-canvas dark:bg-[#111713]">
    <header className="border-b border-slate-200/80 bg-white/80 dark:border-slate-800 dark:bg-[#171e19]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link href="/dashboard" className="flex items-center gap-2.5 font-bold tracking-tight"><span className="grid h-9 w-9 place-items-center rounded-xl bg-forest text-lg text-white" aria-hidden="true">✳</span>TripPilot</Link>
        <Link href={`${basePath ?? `/trip/${trip.id}`}/settings`} className="secondary-button" aria-current={active === "/settings" ? "page" : undefined}>Trip settings</Link>
      </div>
    </header>
    <div className="trip-content mx-auto max-w-7xl px-5 pt-6 sm:px-8 sm:pt-9">
      <Link href="/dashboard" className="inline-flex min-h-11 items-center text-sm text-slate-500 dark:text-slate-400">← All trips</Link>
      <div className="mt-3 flex flex-col justify-between gap-3 md:flex-row md:items-end">
        <div className="min-w-0"><p className="break-words text-sm font-medium text-forest dark:text-emerald-300">{trip.destination}</p><h1 className="mt-1 break-words text-3xl font-semibold tracking-tight sm:text-4xl">{trip.title}</h1></div>
        <p className="text-sm text-slate-500 dark:text-slate-400">{formatTripDates(trip.start_date, trip.end_date)}</p>
      </div>
      <div className="mt-6"><TripNav tripId={trip.id} active={active} basePath={basePath} /></div>
      <div className="mb-6 mt-6"><h2 className="text-xl font-semibold tracking-tight">{title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p></div>
      {children}
    </div>
    <TripNav tripId={trip.id} active={active} mobile basePath={basePath} />
  </main>;
}
