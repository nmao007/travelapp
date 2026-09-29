import { PendingWorkspace } from "@/components/trips/pending-workspace";
import { getTrip, getPackingItems } from "@/lib/trips";
import { PackingView } from "@/components/trips/views/packing";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trip = await getTrip(id);
  if (!trip.workspace_available) return <PendingWorkspace trip={trip} active="/packing" />;
  const items = await getPackingItems(id);
  return <PackingView trip={trip} items={items} />;
}
