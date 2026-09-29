import Link from "next/link";

const sections = [["Today", "", "◉"], ["Itinerary", "/timeline", "◷"], ["Budget", "/budget", "$"], ["Packing", "/packing", "✓"]] as const;

export function TripNav({ tripId, active = "", mobile = false, basePath }: { tripId: string; active?: string; mobile?: boolean; basePath?: string }) {
  return <nav aria-label={mobile ? "Trip navigation" : "Trip sections"} className={mobile ? "trip-bottom-nav fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden dark:border-slate-800 dark:bg-[#171e19]/95" : "hidden gap-2 border-b border-slate-200 md:flex dark:border-slate-800"}>
    {sections.map(([label, path, icon]) => <Link key={label} href={`${basePath ?? `/trip/${tripId}`}${path}`} aria-current={active === path ? "page" : undefined}
      className={`${mobile ? "flex min-h-16 flex-col items-center justify-center gap-1 px-2 text-xs" : "border-b-2 px-5 py-4 text-sm"} font-medium transition ${active === path ? "border-forest text-forest dark:border-emerald-400 dark:text-emerald-300" : "border-transparent text-slate-500 hover:text-ink dark:text-slate-400 dark:hover:text-white"}`}>
      {mobile && <span aria-hidden="true" className="text-xl">{icon}</span>}{label}
    </Link>)}
  </nav>;
}
