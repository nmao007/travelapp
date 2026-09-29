import { PendingWorkspace } from "@/components/trips/pending-workspace";
import { getTrip, getExpenses } from "@/lib/trips";
import { BudgetView } from "@/components/trips/views/budget";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ add?: string }> }) {
  const { id } = await params;
  const trip = await getTrip(id);
  if (!trip.workspace_available) return <PendingWorkspace trip={trip} active="/budget" />;
  const expenses = await getExpenses(id);
  const { add } = await searchParams;
  return <BudgetView trip={trip} expenses={expenses} showAdd={add === "1"} />;
}
