"use client";
import { useState, type FormEvent } from "react";
import { activityCategories, expenseCategories, packingCategories, type Activity, type Expense } from "@/lib/domain";
import { captureJourney, type Booking, type Capture, type JourneyState } from "@/lib/journey";

export const captureLabels: Record<Capture, string> = { activity: "Add a plan", expense: "Log an expense", booking: "Save a reservation", packing: "Add a packing item", task: "Add a task", note: "Save a note" };
export function CaptureForm({ kind, state, initial, save, close, defaultDate }: { kind: Capture; state: JourneyState; initial?: Partial<Activity & Expense & Booking>; save: (state: JourneyState, message: string) => void; close: () => void; defaultDate: string }) {
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = captureJourney(state, kind, new FormData(event.currentTarget), crypto.randomUUID());
    if (!result.state) { setError(result.error ?? "Please check your details."); return; }
    save(result.state, initial?.id ? "Changes saved" : "Added to your trip"); close();
  }
  const dated = ["activity", "expense", "booking"].includes(kind), timed = ["activity", "booking"].includes(kind);
  const categories = kind === "activity" ? activityCategories : kind === "expense" ? expenseCategories : kind === "booking" ? ["Flight", "Stay", "Transport"] : kind === "packing" ? packingCategories : kind === "task" ? ["Documents", "Travel", "Home", "Return"] : [];
  return <form className="j-form" onSubmit={submit}>
    {initial?.id && <input type="hidden" name="id" value={initial.id} />}
    <label>{kind === "packing" ? "Item" : kind === "task" ? "Task" : "Name"}<input name="title" defaultValue={initial?.title} placeholder={kind === "activity" ? "Dinner, a flight, a little adventure…" : kind === "expense" ? "Lunch, tickets, a taxi…" : undefined} required maxLength={160} autoFocus /></label>
    {kind === "expense" && <label>Amount ({state.trip.currency})<input name="amount" inputMode="decimal" defaultValue={initial?.amount_minor ? String(initial.amount_minor / (state.trip.currency === "JPY" || state.trip.currency === "KRW" ? 1 : state.trip.currency === "BHD" ? 1000 : 100)) : undefined} required placeholder="0" /></label>}
    {dated && <div className="j-form-row"><label>Date<input name="date" type="date" defaultValue={initial?.date ?? defaultDate} required min={kind === "expense" ? undefined : state.trip.start_date} max={kind === "expense" ? undefined : state.trip.end_date} /></label>{timed && <label>Time · optional<input name="time" type="time" defaultValue={initial?.time?.slice(0, 5)} /></label>}</div>}
    {categories.length > 0 && <label>Category<select name="category" defaultValue={initial?.category ?? initial?.kind ?? categories[0]}>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>}
    {timed && <label>Place or address<input name="location" defaultValue={initial?.location} maxLength={300} placeholder="Where should you go?" /></label>}
    {kind === "booking" && <label>Booking reference<input name="reference" defaultValue={initial?.reference} maxLength={160} placeholder="Save the reference you received" /></label>}
    <details className="j-advanced" open={kind === "note"}><summary>{kind === "note" ? "Note" : "More details"}</summary><div>
      {timed && <label>Local time zone<input name="timeZone" defaultValue={initial?.time_zone ?? state.trip.time_zone} maxLength={100} /></label>}
      <label>Notes<textarea name="notes" rows={3} defaultValue={initial?.notes} maxLength={4000} placeholder="Useful details for later" /></label>
    </div></details>
    {error && <p role="alert" className="j-error">{error}</p>}
    <footer className="j-form-footer"><button type="button" className="j-button secondary" onClick={close}>Cancel</button><button className="j-button primary" type="submit">{initial?.id ? "Save changes" : "Save"}</button></footer>
  </form>;
}
