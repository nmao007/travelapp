import { formatDate, type Activity, type TransportSegment } from "@/lib/domain";
import { ActivityDetails, Directions, Panel } from "@/components/trips/workspace-ui";
import { ActivityForm, RemoveItem, RemoveTransport, RemoveTripDestination, TransportForm } from "@/components/trips/workspace-forms";

export function ItineraryActivityCard({ tripId, activity, trip, showDate = false }: { tripId: string; activity: Activity; trip: import("@/lib/domain").Trip; showDate?: boolean }) {
  return <Panel>
    <ActivityDetails activity={activity} showDate={showDate} />
    <div className="mt-4"><Directions location={activity.location} /></div>
    <details className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800"><summary className="min-h-11 py-3 text-sm font-medium">Edit plan</summary><div className="mt-4 space-y-6"><ActivityForm trip={trip} activity={activity} /><RemoveItem tripId={tripId} id={activity.id} table="activities" /></div></details>
  </Panel>;
}

export function TransportCard({ trip, segment, leg, manage = false }: { trip: import("@/lib/domain").Trip; segment: TransportSegment; leg: "departure" | "arrival"; manage?: boolean }) {
  const departing = leg === "departure";
  return <Panel>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-xs font-semibold uppercase tracking-[.12em] text-forest dark:text-emerald-300">{segment.mode}{segment.service_id ? ` · ${segment.service_id}` : ""}</p><h3 className="mt-2 text-lg font-semibold">{departing ? "Departure" : "Arrival"}</h3></div>
      <span className="rounded-full bg-mint px-3 py-1 text-xs font-medium text-forest dark:bg-emerald-950/50 dark:text-emerald-200">{departing ? "Fixed time" : "Local arrival"}</span>
    </div>
    <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
      <div><p className="text-xs text-slate-500 dark:text-slate-400">Departs · {formatDate(segment.departure_date, { weekday: "short", month: "short", day: "numeric" })}</p><p className="mt-1 text-xl font-semibold">{segment.departure_time.slice(0, 5)}</p><p className="mt-1 text-sm font-medium">{segment.departure_location}</p><p className="text-xs text-slate-500 dark:text-slate-400">{segment.departure_time_zone.replaceAll("_", " ")}</p></div>
      <span aria-hidden="true" className="hidden text-slate-400 sm:block">→</span>
      <div><p className="text-xs text-slate-500 dark:text-slate-400">Arrives · {formatDate(segment.arrival_date, { weekday: "short", month: "short", day: "numeric" })}</p><p className="mt-1 text-xl font-semibold">{segment.arrival_time.slice(0, 5)}</p><p className="mt-1 text-sm font-medium">{segment.arrival_location}</p><p className="text-xs text-slate-500 dark:text-slate-400">{segment.arrival_time_zone.replaceAll("_", " ")}</p></div>
    </div>
    {segment.notes && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-500 dark:text-slate-400">{segment.notes}</p>}
    {manage && <details className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800"><summary className="min-h-11 py-3 text-sm font-medium">Edit transportation</summary><div className="mt-4 space-y-6"><TransportForm trip={trip} segment={segment} /><RemoveTransport tripId={trip.id} id={segment.id} /></div></details>}
  </Panel>;
}

export function ItineraryDestination({ id, name, date, primary, tripId, canRemove = false }: { id?: string; name: string; date: string; primary: boolean; tripId: string; canRemove?: boolean }) {
  return <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-[#171e19]">
    <div className="min-w-0"><p className="truncate font-medium">⌖ {name}{primary && <span className="ml-2 text-xs font-normal text-slate-500">Main stop</span>}</p><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatDate(date, { weekday: "short", month: "short", day: "numeric" })}</p></div>
    {canRemove && id && <RemoveTripDestination tripId={tripId} id={id} />}
  </div>;
}
