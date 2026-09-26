import { TripSection } from "@/components/trips/trip-section";
export default async function TimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TripSection tripId={id} active="/timeline" title="Your timeline" icon="◷" description="Keep the moments of your trip in order. Activities and plans will appear here as you add them." />;
}
