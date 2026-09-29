import { PendingWorkspace } from "@/components/trips/pending-workspace";
import { getTrip, getActivities, getExpenses, getPackingItems } from "@/lib/trips";
import { OverviewView } from "@/components/trips/views/overview";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trip = await getTrip(id);
  if (!trip.workspace_available) return <PendingWorkspace trip={trip} active="" />;
  const [activities, expenses, items] = await Promise.all([getActivities(id), getExpenses(id), getPackingItems(id)]);
  return <OverviewView trip={trip} activities={activities} expenses={expenses} items={items} />;
}
