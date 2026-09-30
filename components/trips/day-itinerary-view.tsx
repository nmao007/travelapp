import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, type Activity, type Trip, type TripDestination, type TransportSegment } from "@/lib/domain";
import { eventsForTripDay, tripDates } from "@/lib/trip-itinerary";
import { TripSection } from "@/components/trips/trip-section";
import { ActivityForm, TransportForm, TripDestinationForm } from "@/components/trips/workspace-forms";
import { Empty, Panel } from "@/components/trips/workspace-ui";
import { ItineraryActivityCard, ItineraryDestination, TransportCard } from "@/components/trips/itinerary-events";

export function DayItineraryView({ trip, date, activities, destinations, transport }: {
  trip: Trip; date: string; activities: Activity[]; destinations: TripDestination[]; transport: TransportSegment[];
}) {
  const dates = tripDates(trip.start_date, trip.end_date), index = dates.indexOf(date);
  if (index < 0) notFound();
  const events = eventsForTripDay(date, activities, transport);
  return <TripSection trip={trip} active="/timeline" title="Day itinerary" description="A focused timeline for the day. Flight and train times are shown in their departure and arrival time zones.">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <Link href={`/trip/${trip.id}/timeline`} className="secondary-button">← Full itinerary</Link>
      <div className="flex gap-2">
        {index > 0 ? <Link href={`/trip/${trip.id}/day/${dates[index - 1]}`} className="secondary-button">← Previous day</Link> : <span />}
        {index < dates.length - 1 && <Link href={`/trip/${trip.id}/day/${dates[index + 1]}`} className="secondary-button">Next day →</Link>}
      </div>
    </div>
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section>
        <h3 className="mb-5 text-xl font-semibold text-forest dark:text-emerald-300">{formatDate(date, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</h3>
        {destinations.length > 0 && <div className="mb-5 space-y-2">{destinations.map((stop) => <ItineraryDestination key={stop.id} id={stop.id} tripId={trip.id} name={stop.name} date={stop.date} primary={stop.is_primary} canRemove={!stop.is_primary} />)}</div>}
        {events.length ? <div className="space-y-3">{events.map((event) => event.kind === "activity"
          ? <ItineraryActivityCard key={`activity-${event.id}`} tripId={trip.id} trip={trip} activity={event.activity} />
          : <TransportCard key={`transport-${event.id}-${event.leg}`} trip={trip} segment={event.transport} leg={event.leg} manage={event.leg === "departure"} />)}</div>
          : <Empty title="An open day">Add a destination, transport, or a plan whenever you’re ready.</Empty>}
      </section>
      <aside className="space-y-4 lg:sticky lg:top-6">
        <Panel><details open><summary className="min-h-11 text-base font-semibold">＋ Add a plan</summary><div className="mt-4"><ActivityForm trip={trip} defaultDate={date} /></div></details></Panel>
        <Panel><details><summary className="min-h-11 text-base font-semibold">＋ Add flight or train</summary><div className="mt-4"><TransportForm trip={trip} defaultDate={date} /></div></details></Panel>
        <Panel><details><summary className="min-h-11 text-base font-semibold">＋ Add destination</summary><div className="mt-4"><TripDestinationForm trip={trip} defaultDate={date} /></div></details></Panel>
      </aside>
    </div>
  </TripSection>;
}
