import Link from "next/link";
import type { Trip } from "@/lib/domain";
import { TripSection } from "@/components/trips/trip-section";
import { Panel } from "@/components/trips/workspace-ui";

export function PendingWorkspace({ trip, active = "" }: { trip: Trip; active?: string }) {
  return <TripSection trip={trip} active={active} title="Your trip is saved" description="Keep your destination and dates organized as your plans take shape.">
    <Panel title="Planning tools are being prepared" description="Your trip details are available. Itinerary, budget, and packing tools will be available here once setup is complete.">
      <div className="flex flex-wrap gap-3"><Link href={`/trip/${trip.id}/settings`} className="primary-button">Edit trip details</Link>{process.env.NODE_ENV === "development" && <Link href="/preview" className="secondary-button">Explore a sample trip</Link>}</div>
    </Panel>
  </TripSection>;
}
