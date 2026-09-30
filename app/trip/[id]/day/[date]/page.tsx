import { notFound } from "next/navigation";
import { isDate } from "@/lib/domain";
import { getActivities, getTrip, getTripDestinations, getTransportSegments, getItineraryAvailability } from "@/lib/trips";
import { DayItineraryView } from "@/components/trips/day-itinerary-view";
import { PendingWorkspace } from "@/components/trips/pending-workspace";
import { PendingItinerary } from "@/components/trips/pending-itinerary";

export default async function DayPage({ params }: { params: Promise<{ id: string; date: string }> }) {
  const { id, date } = await params;
  if (!isDate(date)) notFound();
  const trip = await getTrip(id);
  if (!trip.workspace_available) return <PendingWorkspace trip={trip} active="/timeline" />;
  if (!await getItineraryAvailability()) return <PendingItinerary trip={trip} />;
  const [activities, destinations, transport] = await Promise.all([getActivities(id), getTripDestinations(id), getTransportSegments(id)]);
  return <DayItineraryView trip={trip} date={date} activities={activities} destinations={destinations.filter((item) => item.date === date)} transport={transport} />;
}
