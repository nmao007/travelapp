import { PendingWorkspace } from "@/components/trips/pending-workspace";
import { getTrip, getActivities } from "@/lib/trips";
import { ItineraryView } from "@/components/trips/views/timeline";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ add?: string }> }) {
  const { id } = await params;
  const trip = await getTrip(id);
  if (!trip.workspace_available) return <PendingWorkspace trip={trip} active="/timeline" />;
  const activities = await getActivities(id);
  const { add } = await searchParams;
  return <ItineraryView trip={trip} activities={activities} showAdd={add === "1"} />;
}
