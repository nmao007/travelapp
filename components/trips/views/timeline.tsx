import { formatDate } from "@/lib/domain";
import { TripSection } from "@/components/trips/trip-section";
import { ActivityForm, RemoveItem } from "@/components/trips/workspace-forms";
import { Panel, Empty, Directions, ActivityDetails } from "@/components/trips/workspace-ui";

import type { Trip, Activity } from "@/lib/domain";
import { ResponsiveComposer } from "@/components/trips/responsive-composer";

export function ItineraryView({ trip, activities, showAdd = false, basePath }: { trip: Trip; activities: Activity[]; showAdd?: boolean; basePath?: string }) {
  const id = trip.id;
  const sorted = [...activities].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "24:00").localeCompare(b.time ?? "24:00"));
  const dates = [...new Set(sorted.map((activity) => activity.date))];
  return <TripSection trip={trip} basePath={basePath} active="/timeline" title="Your itinerary" description="A clear plan for each day. Times follow each item’s local time zone; untimed plans stay flexible.">
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        {!activities.length && <Empty title="Make room for your first plan">Add a stay, flight, meal, or something you’re looking forward to. It will appear here by day.</Empty>}
        {dates.map((date) => <section key={date} aria-label={formatDate(date, { weekday: "long", month: "long", day: "numeric" })}>
          <h3 className="mb-4 text-sm font-semibold text-forest dark:text-emerald-300">{formatDate(date, { weekday: "long", month: "long", day: "numeric" })}</h3>
          <div className="space-y-3">{sorted.filter((activity) => activity.date === date).map((activity) => <Panel key={activity.id}>
            <ActivityDetails activity={activity} />
            <div className="mt-4"><Directions location={activity.location} /></div>
            <details className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800"><summary className="min-h-11 py-3 text-sm font-medium">Edit plan</summary><div className="mt-4 space-y-6"><ActivityForm trip={trip} activity={activity} /><RemoveItem tripId={id} id={activity.id} table="activities" /></div></details>
          </Panel>)}</div>
        </section>)}
      </div>
      <div className="order-first lg:order-last lg:sticky lg:top-6"><Panel><ResponsiveComposer label="＋ Add a plan" initiallyOpen={showAdd || !activities.length}><ActivityForm trip={trip} /></ResponsiveComposer></Panel></div>
    </div>
  </TripSection>;
}
