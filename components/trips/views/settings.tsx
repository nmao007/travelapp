import { TripSection } from "@/components/trips/trip-section";
import { TripSettingsForm, DeleteTripForm } from "@/components/trips/workspace-forms";
import { Panel } from "@/components/trips/workspace-ui";

import type { Trip } from "@/lib/domain";

export function SettingsView({ trip, workspaceAvailable = true, basePath }: { trip: Trip; workspaceAvailable?: boolean; basePath?: string }) {
  const id = trip.id;
  return <TripSection trip={trip} basePath={basePath} active="/settings" title="Trip settings" description="Keep the essentials up to date as your plans change.">
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Panel title="The essentials"><TripSettingsForm trip={trip} workspaceAvailable={workspaceAvailable} /></Panel>
      <Panel title="Delete this trip" description="This permanently removes the trip and all its plans, expenses, and packing items."><DeleteTripForm tripId={id} /></Panel>
    </div>
  </TripSection>;
}
