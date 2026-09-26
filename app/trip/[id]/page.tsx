import { TripSection } from "@/components/trips/trip-section";

export default async function TripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TripSection tripId={id} active="" title="Your trip starts here" icon="✈" description="This is your trip home base. Add activities to build your timeline, keep an eye on spending, and make a packing list as plans come together." />;
}
