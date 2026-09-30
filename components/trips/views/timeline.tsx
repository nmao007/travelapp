import Link from "next/link";
import { formatDate, type Activity, type Trip, type TripDestination, type TransportSegment } from "@/lib/domain";
import { eventsForTripDay, tripCalendarMonths, tripDates } from "@/lib/trip-itinerary";
import { TripSection } from "@/components/trips/trip-section";
import { ActivityForm, TransportForm, TripDestinationForm } from "@/components/trips/workspace-forms";
import { Panel, Empty } from "@/components/trips/workspace-ui";
import { ResponsiveComposer } from "@/components/trips/responsive-composer";
import { ItineraryActivityCard, ItineraryDestination, TransportCard } from "@/components/trips/itinerary-events";

function ViewSwitch({ tripId, active }: { tripId: string; active: "list" | "calendar" }) {
  return <div className="flex w-fit rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-[#171e19]" aria-label="Itinerary view">
    {(["list", "calendar"] as const).map((view) => <Link key={view} href={`/trip/${tripId}/timeline?view=${view}`} aria-current={active === view ? "page" : undefined} className={`rounded-lg px-4 py-2 text-sm font-medium capitalize ${active === view ? "bg-forest text-white" : "text-slate-500 hover:text-ink dark:text-slate-400 dark:hover:text-white"}`}>{view}</Link>)}
  </div>;
}

function CalendarView({ trip, activities, transport, destinations }: { trip: Trip; activities: Activity[]; transport: TransportSegment[]; destinations: TripDestination[] }) {
  return <div className="space-y-8">{tripCalendarMonths(trip.start_date, trip.end_date).map((month) => <section key={month.key} aria-label={month.label}>
    <h3 className="mb-4 text-lg font-semibold">{month.label}</h3>
    <div className="grid grid-cols-7 gap-1 sm:gap-2">
      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <div key={day} className="pb-2 text-center text-xs font-medium text-slate-500">{day}</div>)}
      {month.cells.map((date, index) => {
        if (!date) return <div key={`${month.key}-blank-${index}`} aria-hidden="true" />;
        const eventCount = activities.filter((activity) => activity.date === date).length + transport.filter((item) => item.departure_date === date || item.arrival_date === date).length;
        const stops = destinations.filter((destination) => destination.date === date).length;
        return <Link key={date} href={`/trip/${trip.id}/day/${date}`} aria-label={`${formatDate(date, { weekday: "long", month: "long", day: "numeric" })}, ${eventCount} events`} className="flex min-h-20 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-1 text-sm transition hover:border-forest hover:shadow-sm dark:border-slate-800 dark:bg-[#171e19] dark:hover:border-emerald-400 sm:min-h-24">
          <span className="font-semibold">{Number(date.slice(-2))}</span>
          {(eventCount > 0 || stops > 0) && <span className="mt-1 text-[10px] text-forest dark:text-emerald-300">{eventCount ? `${eventCount} ${eventCount === 1 ? "plan" : "plans"}` : "Stop"}</span>}
        </Link>;
      })}
    </div>
  </section>)}</div>;
}

function DayList({ trip, date, activities, transport, destinations }: { trip: Trip; date: string; activities: Activity[]; transport: TransportSegment[]; destinations: TripDestination[] }) {
  const events = eventsForTripDay(date, activities, transport);
  return <section id={`day-${date}`} className="scroll-mt-6">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div><Link href={`/trip/${trip.id}/day/${date}`} className="text-base font-semibold text-forest hover:underline dark:text-emerald-300">{formatDate(date, { weekday: "long", month: "long", day: "numeric" })}</Link>
        {destinations.length > 0 && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{destinations.map((stop) => stop.name).join(" · ")}</p>}
      </div>
      <Link href={`/trip/${trip.id}/day/${date}`} className="text-sm font-medium text-slate-500 hover:text-ink dark:text-slate-400 dark:hover:text-white">Open day →</Link>
    </div>
    {events.length ? <div className="space-y-3">{events.map((event) => event.kind === "activity"
      ? <ItineraryActivityCard key={`activity-${event.id}`} tripId={trip.id} trip={trip} activity={event.activity} />
      : <TransportCard key={`transport-${event.id}-${event.leg}`} trip={trip} segment={event.transport} leg={event.leg} manage={event.leg === "departure"} />)}</div>
      : <div className="rounded-2xl border border-dashed border-slate-300 px-5 py-5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">Open day · Nothing scheduled yet. <Link href={`/trip/${trip.id}/day/${date}`} className="font-medium text-forest hover:underline dark:text-emerald-300">Plan this day</Link></div>}
  </section>;
}

export function ItineraryView({ trip, activities, destinations = [], transport = [], showAdd = false, view = "list", basePath }: {
  trip: Trip; activities: Activity[]; destinations?: TripDestination[]; transport?: TransportSegment[]; showAdd?: boolean; view?: "list" | "calendar"; basePath?: string;
}) {
  const path = basePath ?? `/trip/${trip.id}`;
  const dates = tripDates(trip.start_date, trip.end_date);
  return <TripSection trip={trip} basePath={basePath} active="/timeline" title="Your itinerary" description="See every day in order, including local flight and train times. Choose a list or calendar view, then open any day for its full timeline.">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4"><ViewSwitch tripId={trip.id} active={view} /><Link href={`${path}/timeline?add=1`} className="primary-button">＋ Add a plan</Link></div>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-8">
        {view === "calendar" ? <CalendarView trip={trip} activities={activities} transport={transport} destinations={destinations} /> : dates.map((date) => <DayList key={date} trip={trip} date={date} activities={activities} transport={transport} destinations={destinations.filter((destination) => destination.date === date)} />)}
        {!dates.length && <Empty title="No trip days found">Check the trip dates in settings to build its itinerary.</Empty>}
      </div>
      <aside className="order-first space-y-4 lg:order-last lg:sticky lg:top-6">
        <Panel title="Destinations" description="Stops appear on their visit date.">
          {destinations.length ? <div className="mb-4 space-y-2">{destinations.map((destination) => <ItineraryDestination key={destination.id} tripId={trip.id} id={destination.id} name={destination.name} date={destination.date} primary={destination.is_primary} canRemove={!destination.is_primary} />)}</div> : <p className="mb-4 text-sm text-slate-500">No destination stops yet.</p>}
          <ResponsiveComposer label="＋ Add destination"><TripDestinationForm trip={trip} /></ResponsiveComposer>
        </Panel>
        <Panel><ResponsiveComposer label="＋ Add flight or train" initiallyOpen={showAdd}><TransportForm trip={trip} /></ResponsiveComposer></Panel>
        <Panel><ResponsiveComposer label="＋ Add an activity" initiallyOpen={showAdd || !activities.length}><ActivityForm trip={trip} /></ResponsiveComposer></Panel>
      </aside>
    </div>
  </TripSection>;
}
