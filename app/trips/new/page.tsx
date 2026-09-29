import Link from "next/link";
import { CreateTripForm } from "@/components/trips/create-trip-form";
import { getWorkspaceAvailability } from "@/lib/trips";

export default async function NewTripPage() {
  const workspaceAvailable = await getWorkspaceAvailability();
  return (
    <main className="min-h-screen bg-canvas dark:bg-[#111713]">
      <header className="mx-auto flex max-w-6xl items-center px-5 py-6 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight text-ink dark:text-white">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-forest text-lg text-white" aria-hidden="true">✳</span>
          <span className="text-lg">TripPilot</span>
        </Link>
      </header>
      <div className="mx-auto max-w-6xl px-5 pb-16 pt-4 sm:px-8 sm:pt-10">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition hover:text-ink dark:text-slate-400 dark:hover:text-white"><span aria-hidden="true">←</span> Back to trips</Link>
        <div className="mx-auto mt-8 grid max-w-5xl gap-10 lg:grid-cols-[.78fr_1.22fr] lg:gap-16">
          <aside className="pt-1">
            <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-mint text-2xl text-forest" aria-hidden="true">✈</div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-forest dark:text-emerald-300">A fresh adventure</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-[-.05em] text-ink dark:text-white sm:text-[2.75rem] sm:leading-tight">Let’s get your trip started.</h1>
            <p className="mt-4 max-w-sm leading-7 text-slate-600 dark:text-slate-400">Add a few details now. You can fill in the itinerary, budget, and packing list whenever you’re ready.</p>
            <div className="mt-8 hidden rounded-2xl border border-[#e6eae3] bg-white/70 p-5 dark:border-slate-800 dark:bg-[#171e19] lg:block">
              <p className="text-sm font-semibold text-ink dark:text-white">Small steps, happy travels.</p>
              <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">Your plans will have a home, so you can spend more time looking forward to the trip.</p>
            </div>
          </aside>

          <section className="rounded-[24px] border border-[#e9ece7] bg-white p-5 shadow-card dark:border-slate-800 dark:bg-[#171e19] sm:p-8">
            <div className="mb-7">
              <h2 className="text-xl font-semibold tracking-tight text-ink dark:text-white">The essentials</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">You can always change these later.</p>
            </div>
            <CreateTripForm workspaceAvailable={workspaceAvailable} />
          </section>
        </div>
      </div>
    </main>
  );
}
