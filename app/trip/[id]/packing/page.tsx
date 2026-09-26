import { TripSection } from "@/components/trips/trip-section";
export default async function PackingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TripSection tripId={id} active="/packing" title="Packing list" icon="✓" description="Collect the things you want to bring and check them off as you pack." />;
}
