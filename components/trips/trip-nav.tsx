import Link from "next/link";

const sections = [
  ["Overview", ""],
  ["Timeline", "/timeline"],
  ["Budget", "/budget"],
  ["Packing", "/packing"],
] as const;

export function TripNav({ tripId, active = "" }: { tripId: string; active?: string }) {
  return (
    <nav aria-label="Trip sections" className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-800">
      {sections.map(([label, path]) => (
        <Link key={label} href={`/trip/${tripId}${path}`} aria-current={active === path ? "page" : undefined}
          className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition ${active === path ? "border-forest text-forest dark:border-emerald-400 dark:text-emerald-300" : "border-transparent text-slate-500 hover:text-ink dark:text-slate-400 dark:hover:text-white"}`}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
