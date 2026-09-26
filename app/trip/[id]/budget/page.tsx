import { TripSection } from "@/components/trips/trip-section";
export default async function BudgetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TripSection tripId={id} active="/budget" title="Trip budget" icon="$" description="Track trip expenses in one place and keep a clear view of what you spend along the way." />;
}
