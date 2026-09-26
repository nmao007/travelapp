import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatTripDates, type Trip } from "@/lib/trips";
import { LogoutButton } from "@/components/auth/logout-button";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard");
  const { data } = await supabase.from("trips").select("id,title,destination,start_date,end_date").eq("user_id", user.id).order("start_date");
  const trips = (data ?? []) as Trip[];

  return (
    <main className="min-h-screen bg-canvas dark:bg-[#111713]">
      <header className="border-b border-slate-200/80 bg-white/75 dark:border-slate-800 dark:bg-[#171e19]"><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/dashboard" className="flex items-center gap-2.5 font-bold tracking-tight text-ink dark:text-white"><span className="grid h-9 w-9 place-items-center rounded-xl bg-forest text-lg text-white">✳</span>TripPilot</Link>
        <div className="flex max-w-[60%] items-center gap-4"><span className="hidden max-w-[45%] truncate text-sm text-slate-500 dark:text-slate-400 sm:inline">{user.email}</span><LogoutButton /></div>
      </div></header>
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><p className="text-sm font-medium text-forest dark:text-emerald-300">Your travel, together</p><h1 className="mt-2 text-4xl font-semibold tracking-[-.04em] text-ink dark:text-white">Your trips</h1><p className="mt-2 text-slate-600 dark:text-slate-400">The details are here. The memories are next.</p></div>
          <Link href="/trips/new" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-forest px-5 text-sm font-semibold text-white hover:bg-[#204f3b]">＋ New trip</Link>
        </div>
        {trips.length ? <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{trips.map((trip) => <Link key={trip.id} href={`/trip/${trip.id}`} className="group rounded-3xl border border-slate-200 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-card dark:border-slate-800 dark:bg-[#171e19]"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-mint text-xl dark:bg-[#263b2d]">✈</span><h2 className="mt-5 text-lg font-semibold text-ink group-hover:text-forest dark:text-white dark:group-hover:text-emerald-300">{trip.title}</h2><p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{trip.destination}</p><p className="mt-4 text-xs font-medium text-slate-500 dark:text-slate-500">{formatTripDates(trip.start_date, trip.end_date)}</p></Link>)}</div> : <div className="mt-9 rounded-3xl border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center dark:border-slate-700 dark:bg-[#171e19]"><span className="text-3xl" aria-hidden="true">✈</span><h2 className="mt-4 text-lg font-semibold text-ink dark:text-white">Your next trip is waiting</h2><p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Start with a destination and dates. You can fill in the rest later.</p><Link href="/trips/new" className="mt-5 inline-flex rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white">Create your first trip</Link></div>}
      </div>
    </main>
  );
}
