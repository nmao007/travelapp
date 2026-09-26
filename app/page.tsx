import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-canvas dark:bg-[#111713]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight text-ink dark:text-white">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-forest text-lg text-white" aria-hidden="true">✳</span>
          <span className="text-lg">TripPilot</span>
        </Link>
        <span className="hidden text-sm text-slate-500 dark:text-slate-400 sm:block">A little more organized. A lot more present.</span>
        <Link href="/trips/new" className="rounded-xl bg-forest px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#204f3b]">New trip <span aria-hidden="true">＋</span></Link>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-5 pb-20 pt-10 sm:px-8 sm:pt-20 lg:grid-cols-[1.05fr_.95fr]">
        <div className="max-w-xl">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#dce7dd] bg-white px-3.5 py-2 text-xs font-semibold uppercase tracking-[.13em] text-forest">
            <span className="h-2 w-2 rounded-full bg-[#76a884]" /> Your trip, all together
          </p>
          <h1 className="text-5xl font-semibold leading-[1.07] tracking-[-.055em] text-ink dark:text-white sm:text-6xl">Make room for the <span className="font-serif italic text-forest dark:text-emerald-300">good parts.</span></h1>
          <p className="mt-6 max-w-md text-base leading-7 text-slate-600 dark:text-slate-400 sm:text-lg">A calm place for your plans, little details, and everything you don’t want to forget along the way.</p>
          <Link href="/trips/new" className="mt-8 inline-flex min-h-13 items-center gap-3 rounded-xl bg-forest px-6 py-3.5 text-sm font-semibold text-white shadow-card transition hover:-translate-y-0.5 hover:bg-[#204f3b]">
            Plan your first trip <span aria-hidden="true">→</span>
          </Link>
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Start with the basics. Add the fun stuff as you go.</p>
        </div>

        <div className="relative mx-auto w-full max-w-lg">
          <div className="absolute -right-3 -top-3 h-28 w-28 rounded-full bg-[#e9efe1] sm:-right-8 sm:-top-7 sm:h-40 sm:w-40" />
          <div className="absolute -bottom-4 -left-3 h-24 w-24 rounded-full bg-[#e3eee7] sm:-left-8 sm:h-32 sm:w-32" />
          <div className="relative overflow-hidden rounded-[28px] border border-white bg-white p-5 shadow-card dark:border-slate-800 dark:bg-[#171e19] sm:p-7">
            <div className="flex items-center justify-between">
              <div><p className="text-xs font-medium uppercase tracking-[.14em] text-slate-400">Your next chapter</p><p className="mt-1 text-lg font-semibold">Somewhere new</p></div>
              <span className="grid h-10 w-10 place-items-center rounded-full bg-mint text-xl" aria-hidden="true">↗</span>
            </div>
            <div className="mt-6 flex h-48 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#dcece3] via-[#e7eee3] to-[#f2dfc9] sm:h-56">
              <div className="relative h-full w-full overflow-hidden">
                <div className="absolute -bottom-10 left-[-5%] h-36 w-[110%] rotate-[-8deg] rounded-[50%] bg-[#a6c6ac]" />
                <div className="absolute -bottom-14 right-[-8%] h-44 w-[75%] rotate-[12deg] rounded-[50%] bg-[#6e9b79]" />
                <div className="absolute bottom-0 right-[18%] h-36 w-20 rounded-t-full bg-[#d3a87c]" />
                <div className="absolute bottom-10 right-[15%] h-24 w-28 rounded-[50%] bg-[#749374]" />
                <div className="absolute left-[17%] top-8 h-16 w-16 rounded-full bg-[#f6cc8e]/80 blur-[1px]" />
                <span className="absolute bottom-4 left-5 rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-ink backdrop-blur">Daydreams welcome</span>
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between">
              <div><div className="h-2 w-28 rounded bg-[#e9ede9]" /><div className="mt-2 h-2 w-20 rounded bg-[#f0f2ef]" /></div>
              <div className="flex -space-x-2"><span className="h-8 w-8 rounded-full border-2 border-white bg-[#f2d6bd]"/><span className="h-8 w-8 rounded-full border-2 border-white bg-[#d8e5d6]"/><span className="grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-[#f2f3ee] text-xs text-slate-500">＋</span></div>
            </div>
          </div>
          <div className="absolute -right-1 top-1/2 rounded-2xl border border-white bg-white px-4 py-3 shadow-card sm:-right-10">
            <span className="text-xs text-slate-500">The best part?</span><p className="mt-0.5 text-sm font-semibold text-ink">It’s all in one place <span aria-hidden="true">✦</span></p>
          </div>
        </div>
      </section>
    </main>
  );
}
