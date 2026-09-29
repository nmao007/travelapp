import Link from "next/link";
import { dateInZone, formatDate, formatMoney, nextActivity } from "@/lib/domain";
import { TripSection } from "@/components/trips/trip-section";
import { Panel, Empty, ActivityDetails, Directions, Stat } from "@/components/trips/workspace-ui";

import type { Trip, Activity, Expense, PackingItem } from "@/lib/domain";

export function OverviewView({ trip, activities, expenses, items, now = new Date(), basePath }: { trip: Trip; activities: Activity[]; expenses: Expense[]; items: PackingItem[]; now?: Date; basePath?: string }) {
  const id = trip.id;
  const path = basePath ?? `/trip/${id}`;
  const today = dateInZone(trip.time_zone, now);
  const before = today < trip.start_date, after = today > trip.end_date;
  const focusDate = before ? trip.start_date : today;
  const plans = activities.filter((activity) => activity.date === focusDate).sort((a, b) => (a.time ?? "24:00").localeCompare(b.time ?? "24:00"));
  const next = nextActivity(activities, now);
  const spent = expenses.reduce((sum, expense) => sum + expense.amount_minor, 0);
  const packed = items.filter((item) => item.packed).length;
  return <TripSection trip={trip} basePath={basePath} active="" title={before ? "Before you go" : after ? "Your trip, in one place" : "Your day, at a glance"} description={before ? "Get the essentials ready, then enjoy looking forward to the trip." : after ? "Revisit your plans and bring your final expenses up to date." : `What’s happening today, with the details close at hand. Today follows ${trip.time_zone.replaceAll("_", " ")}.`}>
    <div className="mb-6 flex flex-wrap gap-3"><Link href={`${path}/timeline?add=1`} className="primary-button">＋ Add a plan</Link><Link href={`${path}/budget?add=1`} className="secondary-button">Log an expense</Link></div>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <section className="rounded-3xl bg-forest p-6 text-white sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[.15em] text-emerald-100">{next ? "Up next" : before ? "You’re going places" : after ? "Welcome back" : "Room to explore"}</p>
          {next ? <><h3 className="mt-4 break-words text-2xl font-semibold">{next.title}</h3><p className="mt-3 text-sm text-emerald-100">{formatDate(next.date, { weekday: "short", month: "short", day: "numeric" })} · {next.time?.slice(0, 5)} · {next.time_zone.replaceAll("_", " ")}</p>{next.location && <p className="mt-3 break-words text-sm text-emerald-100">⌖ {next.location}</p>}<div className="mt-5 flex flex-wrap gap-3"><Link href={`${path}/timeline`} className="secondary-button border-white/30 text-white hover:bg-white/10 dark:border-white/30 dark:hover:bg-white/10">View details</Link>{next.location && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(next.location)}`} target="_blank" rel="noopener noreferrer" className="secondary-button border-white/30 text-white hover:bg-white/10 dark:border-white/30 dark:hover:bg-white/10">Open map ↗</a>}</div></> : <><h3 className="mt-4 text-2xl font-semibold">{before ? `Next stop: ${trip.destination}` : after ? "Keep the good parts close." : "No upcoming timed plans."}</h3><p className="mt-3 text-sm leading-6 text-emerald-100">{before ? "Add your first plan and give it a time to see it here." : after ? "Your itinerary and travel details are still here whenever you need them." : "Flexible plans are in your itinerary. Add a time when you’re ready."}</p></>}
        </section>
        <Panel title={before ? "Your first day" : after ? "Trip highlights" : "Today’s plans"} description={after ? `${activities.length} plans across your trip` : formatDate(focusDate, { weekday: "long", month: "long", day: "numeric" })}>
          {after ? <Link href={`${path}/timeline`} className="secondary-button">Revisit itinerary →</Link> : plans.length ? <div className="space-y-5">{plans.map((activity) => <div key={activity.id} className="border-b border-slate-100 pb-5 last:border-0 last:pb-0 dark:border-slate-800"><ActivityDetails activity={activity} /><div className="mt-3"><Directions location={activity.location} /></div></div>)}</div> : <Empty title="A little space in the day">Add your arrival, a reservation, or an activity to start bringing your day together.</Empty>}
        </Panel>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <Stat label="Itinerary" value={`${activities.length} plans`} detail="Organize your days" href={`${path}/timeline`} />
        <Stat label="Spending" value={formatMoney(spent, trip.currency)} detail={trip.budget_minor === null ? "Set a budget or log a cost" : `${formatMoney(trip.budget_minor, trip.currency)} trip budget`} href={`${path}/budget`} />
        <Stat label="Packing" value={`${packed} / ${items.length} packed`} detail={items.length && packed === items.length ? "Everything on your list is packed" : "Check your essentials"} href={`${path}/packing`} />
      </div>
    </div>
  </TripSection>;
}
