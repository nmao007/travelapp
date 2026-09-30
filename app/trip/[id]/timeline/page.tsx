import { PendingWorkspace } from "@/components/trips/pending-workspace";
import { getTrip, getActivities, getTripDestinations, getTransportSegments, getItineraryAvailability } from "@/lib/trips";
import { PendingItinerary } from "@/components/trips/pending-itinerary";
import { ItineraryView } from "@/components/trips/views/timeline";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ add?: string; view?: string }> }) {
  const { id } = await params;
  const trip = await getTrip(id);
  if (!trip.workspace_available) return <PendingWorkspace trip={trip} active="/timeline" />;
  if (!await getItineraryAvailability()) return <PendingItinerary trip={trip} />;
  const [activities, destinations, transport, query] = await Promise.all([getActivities(id), getTripDestinations(id), getTransportSegments(id), searchParams]);
  return <ItineraryView trip={trip} activities={activities} destinations={destinations} transport={transport} showAdd={query.add === "1"} view={query.view === "calendar" ? "calendar" : "list"} />;
}
