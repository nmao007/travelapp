import Link from "next/link";
import { formatTripDates, getTrip } from "@/lib/trips";
import { TripNav } from "@/components/trips/trip-nav";

export async function TripSection({ tripId, active, title, description, icon }: {
  tripId: string;
  active: string;
  title: string;
  description: string;
  icon: string;
}) {
  const trip = await getTrip(tripId);
  return (
    <main className="min-h-screen bg-canvas dark:bg-[#111713]">
      <header className="border-b border-slate-200/80 bg-white/75 dark:border-slate-800 dark:bg-[#171e19]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <Link href="/dashboard" className="flex items-center gap-2.5 font-bold tracking-tight text-ink dark:text-white"><span className="grid h-9 w-9 place-items-center rounded-xl bg-forest text-lg text-white" aria-hidden="true">✳</span><span>TripPilot</span></Link>
          <Link href="/dashboard" className="text-sm font-medium text-slate-500 hover:text-ink dark:text-slate-400 dark:hover:text-white">All trips</Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <Link href="/dashboard" className="text-sm font-medium text-slate-500 hover:text-ink dark:text-slate-400 dark:hover:text-white">← All trips</Link>
        <div className="mt-7">
          <p className="text-sm font-medium text-forest dark:text-emerald-300">{trip.destination} <span className="px-1 text-slate-300">·</span> {formatTripDates(trip.start_date, trip.end_date)}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink dark:text-white sm:text-4xl">{trip.title}</h1>
        </div>
        <div className="mt-8"><TripNav tripId={tripId} active={active} /></div>
        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-card dark:border-slate-800 dark:bg-[#171e19] sm:p-9">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-mint text-2xl dark:bg-[#263b2d]" aria-hidden="true">{icon}</div>
          <h2 className="mt-5 text-xl font-semibold text-ink dark:text-white">{title}</h2>
          <p className="mt-2 max-w-xl leading-7 text-slate-600 dark:text-slate-400">{description}</p>
        </section>
      </div>
    </main>
  );
}
