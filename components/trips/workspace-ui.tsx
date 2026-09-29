import Link from "next/link";
import type { ReactNode } from "react";
import { formatDate, type Activity } from "@/lib/domain";

export function Panel({ title, description, children }: { title?: string; description?: string; children: ReactNode }) {
  return <section className="workspace-panel">{title && <h2 className="text-lg font-semibold tracking-tight">{title}</h2>}{description && <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{description}</p>}<div className={title || description ? "mt-5" : ""}>{children}</div></section>;
}
export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-9 dark:border-slate-700"><h3 className="font-medium">{title}</h3><p className="mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">{children}</p></div>;
}
export function Directions({ location }: { location: string }) {
  if (!location.trim()) return null;
  return <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`} target="_blank" rel="noopener noreferrer" className="secondary-button">Open map <span aria-hidden="true">↗</span></a>;
}
export function ActivityDetails({ activity, showDate = false }: { activity: Activity; showDate?: boolean }) {
  return <div>
    <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-500 dark:text-slate-400"><span>{activity.category}</span><span aria-hidden="true">·</span>{showDate && <span>{formatDate(activity.date)} ·</span>}<span>{activity.time ? activity.time.slice(0, 5) : "Time flexible"}</span><span>{activity.time_zone.replaceAll("_", " ")}</span></div>
    <h3 className="mt-2 text-lg font-semibold">{activity.title}</h3>
    {activity.location && <p className="mt-2 break-words text-sm text-slate-600 dark:text-slate-300">⌖ {activity.location}</p>}
    {activity.notes && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-500 dark:text-slate-400">{activity.notes}</p>}
  </div>;
}
export function Stat({ label, value, detail, href }: { label: string; value: string; detail: string; href: string }) {
  return <Link href={href} className="workspace-panel block transition hover:border-forest dark:hover:border-emerald-400"><p className="text-sm text-slate-500 dark:text-slate-400">{label}</p><p className="mt-2 break-words text-2xl font-semibold tracking-tight">{value}</p><p className="mt-2 text-xs text-slate-500 dark:text-slate-400">{detail} <span aria-hidden="true">→</span></p></Link>;
}
