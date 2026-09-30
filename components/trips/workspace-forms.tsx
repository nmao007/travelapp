import type { ReactNode } from "react";
import { ActionForm } from "@/components/trips/action-form";
import { saveActivity, saveExpense, savePackingItem, deleteItem, saveTripDestination, deleteTripDestination, saveTransportSegment, deleteTransportSegment } from "@/app/actions/workspace";
import { updateTrip, deleteTrip } from "@/app/actions/trips";
import { activityCategories, expenseCategories, packingCategories, currencies, moneyInput, currencyDigits, type Activity, type Expense, type PackingItem, type Trip } from "@/lib/domain";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block space-y-2"><span className="text-sm font-medium">{label}</span>{children}</label>;
}
function Hidden({ tripId, id }: { tripId: string; id?: string }) {
  return <><input type="hidden" name="tripId" value={tripId} />{id && <input type="hidden" name="id" value={id} />}</>;
}
function Options({ values }: { values: readonly string[] }) { return values.map((value) => <option key={value}>{value}</option>); }

export function ActivityForm({ trip, activity, defaultDate = trip.start_date }: { trip: Trip; activity?: Activity; defaultDate?: string }) {
  const categories = activity && ["Flight", "Transport"].includes(activity.category) ? activityCategories : activityCategories.filter((value) => value !== "Flight" && value !== "Transport");
  return <ActionForm action={saveActivity} operation="saveActivity" label={activity ? "Save changes" : "Add to itinerary"} reset={!activity}>
    <Hidden tripId={trip.id} id={activity?.id} />
    <Field label="What’s the plan?"><input name="title" defaultValue={activity?.title} maxLength={160} required className="form-input" placeholder="Museum visit, flight, dinner…" /></Field>
    <div className="grid grid-cols-2 gap-4">
      <Field label="Date"><input name="date" type="date" defaultValue={activity?.date ?? defaultDate} min={trip.start_date} max={trip.end_date} required className="form-input" /></Field>
      <Field label="Time (optional)"><input name="time" type="time" defaultValue={activity?.time?.slice(0, 5)} className="form-input" /></Field>
    </div>
    <Field label="Category"><select name="category" defaultValue={activity?.category ?? "Activity"} className="form-input"><Options values={categories} /></select></Field>
    <Field label="Location or address"><input name="location" defaultValue={activity?.location} maxLength={300} className="form-input" placeholder="A place you can find again" /></Field>
    <Field label="Time zone"><input name="timeZone" defaultValue={activity?.time_zone ?? trip.time_zone} required maxLength={100} className="form-input" placeholder="Europe/Paris" /></Field>
    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">Times use the zone above. For a flight, use the departure airport’s time zone.</p>
    <Field label="Notes"><textarea name="notes" defaultValue={activity?.notes} maxLength={4000} rows={3} className="form-input py-3" placeholder="Confirmation number, meeting point, things to remember…" /></Field>
  </ActionForm>;
}

export function TripDestinationForm({ trip, defaultDate = trip.start_date }: { trip: Trip; defaultDate?: string }) {
  return <ActionForm action={saveTripDestination} operation="saveTripDestination" label="Add destination" reset>
    <Hidden tripId={trip.id} />
    <Field label="Destination"><input name="name" required maxLength={160} className="form-input" placeholder="City or place" /></Field>
    <Field label="Visit date"><input name="date" type="date" defaultValue={defaultDate} min={trip.start_date} max={trip.end_date} required className="form-input" /></Field>
  </ActionForm>;
}

export function RemoveTripDestination({ tripId, id }: { tripId: string; id: string }) {
  return <ActionForm action={deleteTripDestination} operation="deleteTripDestination" label="Remove" confirm="Remove this destination from the itinerary?" compact quiet buttonClass="text-xs font-medium text-slate-500 hover:text-red-700 dark:text-slate-400 dark:hover:text-red-300">
    <Hidden tripId={tripId} id={id} />
  </ActionForm>;
}

export function TransportForm({ trip, defaultDate = trip.start_date, segment }: { trip: Trip; defaultDate?: string; segment?: import("@/lib/domain").TransportSegment }) {
  return <ActionForm action={saveTransportSegment} operation="saveTransportSegment" label={segment ? "Save transport" : "Add flight or train"} reset={!segment}>
    <Hidden tripId={trip.id} id={segment?.id} />
    <div className="grid grid-cols-2 gap-4">
      <Field label="Type"><select name="mode" defaultValue={segment?.mode ?? "Flight"} className="form-input"><option>Flight</option><option>Train</option></select></Field>
      <Field label="Flight/train ID"><input name="serviceId" defaultValue={segment?.service_id} maxLength={40} required className="form-input" placeholder="e.g. BA 117" /></Field>
    </div>
    <Field label="Departure location"><input name="departureLocation" defaultValue={segment?.departure_location} required maxLength={240} className="form-input" placeholder="Airport or station" /></Field>
    <div className="grid grid-cols-2 gap-4">
      <Field label="Departure date"><input name="departureDate" type="date" defaultValue={segment?.departure_date ?? defaultDate} min={trip.start_date} max={trip.end_date} required className="form-input" /></Field>
      <Field label="Local time"><input name="departureTime" type="time" defaultValue={segment?.departure_time?.slice(0, 5)} required className="form-input" /></Field>
    </div>
    <Field label="Departure time zone"><input name="departureTimeZone" defaultValue={segment?.departure_time_zone ?? trip.time_zone} required maxLength={100} className="form-input" placeholder="America/Los_Angeles" /></Field>
    <Field label="Arrival location"><input name="arrivalLocation" defaultValue={segment?.arrival_location} required maxLength={240} className="form-input" placeholder="Airport or station" /></Field>
    <div className="grid grid-cols-2 gap-4">
      <Field label="Arrival date"><input name="arrivalDate" type="date" defaultValue={segment?.arrival_date ?? defaultDate} min={trip.start_date} max={trip.end_date} required className="form-input" /></Field>
      <Field label="Local time"><input name="arrivalTime" type="time" defaultValue={segment?.arrival_time?.slice(0, 5)} required className="form-input" /></Field>
    </div>
    <Field label="Arrival time zone"><input name="arrivalTimeZone" defaultValue={segment?.arrival_time_zone ?? trip.time_zone} required maxLength={100} className="form-input" placeholder="Europe/London" /></Field>
    <Field label="Notes"><textarea name="notes" defaultValue={segment?.notes} maxLength={4000} rows={2} className="form-input py-3" placeholder="Platform, terminal, connection details…" /></Field>
  </ActionForm>;
}

export function RemoveTransport({ tripId, id }: { tripId: string; id: string }) {
  return <ActionForm action={deleteTransportSegment} operation="deleteTransportSegment" label="Remove transport" confirm="Remove this flight or train from the itinerary?" compact quiet buttonClass="secondary-button text-red-700 dark:text-red-300">
    <Hidden tripId={tripId} id={id} />
  </ActionForm>;
}

export function ExpenseForm({ trip, expense }: { trip: Trip; expense?: Expense }) {
  const digits = currencyDigits(trip.currency);
  return <ActionForm action={saveExpense} operation="saveExpense" label={expense ? "Save changes" : "Add expense"} reset={!expense}>
    <Hidden tripId={trip.id} id={expense?.id} />
    <Field label="Expense"><input name="title" defaultValue={expense?.title} required maxLength={160} className="form-input" placeholder="Lunch, hotel, train tickets…" /></Field>
    <div className="grid grid-cols-2 gap-4">
      <Field label={`Amount (${trip.currency})`}><input name="amount" type="text" inputMode={digits ? "decimal" : "numeric"} defaultValue={expense ? moneyInput(expense.amount_minor, trip.currency) : undefined} required className="form-input" placeholder={digits ? `0.${"0".repeat(digits)}` : "0"} /></Field>
      <Field label="Date"><input name="date" type="date" defaultValue={expense?.date ?? trip.start_date} required className="form-input" /></Field>
    </div>
    <Field label="Category"><select name="category" defaultValue={expense?.category ?? "Other"} className="form-input"><Options values={expenseCategories} /></select></Field>
    <Field label="Notes"><textarea name="notes" defaultValue={expense?.notes} rows={2} maxLength={4000} className="form-input py-3" /></Field>
  </ActionForm>;
}

export function PackingForm({ tripId, item }: { tripId: string; item?: PackingItem }) {
  return <ActionForm action={savePackingItem} operation="savePackingItem" label={item ? "Save changes" : "Add item"} reset={!item}>
    <Hidden tripId={tripId} id={item?.id} />
    <Field label="Item"><input name="name" defaultValue={item?.name} required maxLength={160} className="form-input" placeholder="Passport, charger, walking shoes…" /></Field>
    <Field label="Category"><select name="category" defaultValue={item?.category ?? "Essentials"} className="form-input"><Options values={packingCategories} /></select></Field>
  </ActionForm>;
}

export function RemoveItem({ tripId, id, table }: { tripId: string; id: string; table: string }) {
  return <ActionForm action={deleteItem} operation="deleteItem" label="Delete item" pendingLabel="Deleting…" confirm="Remove this item from your trip? This cannot be undone." compact quiet buttonClass="secondary-button text-red-700 dark:text-red-300">
    <Hidden tripId={tripId} id={id} /><input type="hidden" name="table" value={table} />
  </ActionForm>;
}

export function TripSettingsForm({ trip, workspaceAvailable = true }: { trip: Trip; workspaceAvailable?: boolean }) {
  return <ActionForm action={updateTrip} operation="updateTrip" label="Save trip settings">
    <Hidden tripId={trip.id} />
    <Field label="Trip name"><input name="title" defaultValue={trip.title} required maxLength={100} className="form-input" /></Field>
    <Field label="Destination"><input name="destination" defaultValue={trip.destination} required maxLength={120} className="form-input" /></Field>
    <div className="grid grid-cols-2 gap-4">
      <Field label="Departure"><input name="startDate" type="date" defaultValue={trip.start_date} required className="form-input" /></Field>
      <Field label="Return"><input name="endDate" type="date" defaultValue={trip.end_date} required className="form-input" /></Field>
    </div>
    {workspaceAvailable && <><Field label="Trip time zone"><input name="timeZone" defaultValue={trip.time_zone} required maxLength={100} className="form-input" placeholder="Europe/Paris" /></Field>
    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">Used for your trip’s Today view and new plans. Existing itinerary items keep their own time zones.</p>
    <div className="grid grid-cols-2 gap-4">
      <Field label="Currency"><select name="currency" defaultValue={trip.currency} className="form-input"><Options values={currencies} /></select></Field>
      <Field label="Budget (optional)"><input name="budget" inputMode="decimal" defaultValue={moneyInput(trip.budget_minor, trip.currency)} className="form-input" placeholder="No limit set" /></Field>
    </div>
    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">All expenses use this currency. Enter amounts in the new currency if you change it; totals are not converted.</p></>}
  </ActionForm>;
}

export function DeleteTripForm({ tripId }: { tripId: string }) {
  return <ActionForm action={deleteTrip} operation="deleteTrip" label="Delete trip" pendingLabel="Deleting trip…" confirm="Delete this trip and all of its itinerary, expenses, and packing items? This cannot be undone." buttonClass="secondary-button text-red-700 dark:text-red-300">
    <Hidden tripId={tripId} />
  </ActionForm>;
}
