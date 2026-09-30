import { TripSection } from "@/components/trips/trip-section";
import { Panel } from "@/components/trips/workspace-ui";
import type { Trip } from "@/lib/domain";

export function PendingItinerary({ trip }: { trip: Trip }) {
  return <TripSection trip={trip} active="/timeline" title="Your itinerary" description="This trip is ready for day-by-day planning.">
    <Panel title="Itinerary setup is pending"><p className="text-sm leading-6 text-slate-500 dark:text-slate-400">Apply the trip itinerary migration to add destination stops and flight/train records. Your existing trip and plans are unchanged.</p></Panel>
  </TripSection>;
}
