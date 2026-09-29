import { getTrip } from "@/lib/trips";
import { SettingsView } from "@/components/trips/views/settings";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const trip = await getTrip(id);
  return <SettingsView trip={trip} workspaceAvailable={trip.workspace_available} />;
}
